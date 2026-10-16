const fs = require('fs');
const path = require('path');
const os = require('os');

const CONVERSATION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INPUT_TYPES = new Set(['USER_INPUT']);
const OUTPUT_TYPES = new Set(['PLANNER_RESPONSE', 'MODEL_RESPONSE', 'ASSISTANT_RESPONSE']);

function estimateTextTokens(value) {
  const text = String(value || '');
  let cjk = 0;
  let ascii = 0;
  let other = 0;
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (
      (codePoint >= 0x3400 && codePoint <= 0x4dbf) ||
      (codePoint >= 0x4e00 && codePoint <= 0x9fff) ||
      (codePoint >= 0x3000 && codePoint <= 0x303f) ||
      (codePoint >= 0xff00 && codePoint <= 0xffef)
    ) {
      cjk += 1;
    } else if (codePoint >= 32 && codePoint <= 126) {
      ascii += 1;
    } else if (!/\s/u.test(character)) {
      other += 1;
    }
  }
  return Math.max(0, Math.round(cjk * 1.5 + ascii * 0.25 + other));
}

function cleanUserContent(value) {
  return String(value || '')
    .replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '')
    .replace(/<USER_REQUEST>|<\/USER_REQUEST>/gi, '')
    .trim();
}

function transcriptEntryToLog(entry, conversationId) {
  if (!entry || entry.status === 'PENDING' || entry.status === 'RUNNING') return null;

  const type = String(entry.type || '').toUpperCase();
  let input = 0;
  let output = 0;
  if (INPUT_TYPES.has(type)) {
    input = estimateTextTokens(cleanUserContent(entry.content));
  } else if (OUTPUT_TYPES.has(type)) {
    output = estimateTextTokens(`${entry.content || ''}\n${entry.thinking || ''}`);
  } else {
    return null;
  }
  if (input === 0 && output === 0) return null;

  const createdAt = Date.parse(entry.created_at || '');
  const identity = [conversationId, entry.step_index, type, entry.created_at].join(':');
  return {
    id: `local-${identity}`,
    time: Number.isFinite(createdAt) ? new Date(createdAt).toISOString() : new Date().toISOString(),
    model: `Antigravity 本地会话 ${conversationId.slice(0, 8)}`,
    input,
    output,
    cached: 0,
    duration: 0,
    estimated: true,
    source: 'local-transcript',
    conversationId,
    stepIndex: entry.step_index
  };
}

class BrainTokenMonitor {
  constructor(options = {}) {
    this.brainRoot = options.brainRoot || path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
    this.pollIntervalMs = Math.max(500, Number(options.pollIntervalMs) || 1500);
    this.onLog = typeof options.onLog === 'function' ? options.onLog : () => {};
    this.states = new Map();
    this.seen = new Set();
    this.timer = null;
    this.scanning = false;
    this.initialized = false;
    this.status = {
      ready: false,
      brainRoot: this.brainRoot,
      watchedFiles: 0,
      lastActivityAt: null,
      lastError: ''
    };
  }

  async start() {
    if (this.timer) return this.getStatus();
    await this.scan();
    this.status.ready = fs.existsSync(this.brainRoot);
    this.timer = setInterval(() => {
      this.scan().catch(error => this.captureError(error));
    }, this.pollIntervalMs);
    return this.getStatus();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.status.ready = false;
  }

  getStatus() {
    return { ...this.status };
  }

  captureError(error) {
    this.status.lastError = error && error.message ? error.message : String(error);
  }

  listTranscriptFiles() {
    if (!fs.existsSync(this.brainRoot)) return [];
    const files = [];
    for (const entry of fs.readdirSync(this.brainRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !CONVERSATION_ID.test(entry.name)) continue;
      const transcriptPath = path.join(
        this.brainRoot,
        entry.name,
        '.system_generated',
        'logs',
        'transcript.jsonl'
      );
      if (fs.existsSync(transcriptPath)) files.push({ path: transcriptPath, conversationId: entry.name });
    }
    return files;
  }

  async scan() {
    if (this.scanning) return;
    this.scanning = true;
    try {
      const files = this.listTranscriptFiles();
      const activePaths = new Set(files.map(file => file.path));
      for (const knownPath of this.states.keys()) {
        if (!activePaths.has(knownPath)) this.states.delete(knownPath);
      }

      for (const file of files) this.readAppendedLines(file);
      this.status.watchedFiles = files.length;
      this.status.ready = fs.existsSync(this.brainRoot);
      this.status.lastError = '';
      this.initialized = true;
    } catch (error) {
      this.captureError(error);
    } finally {
      this.scanning = false;
    }
  }

  readAppendedLines(file) {
    const stat = fs.statSync(file.path);
    let state = this.states.get(file.path);
    if (!state) {
      state = { offset: this.initialized ? 0 : stat.size, carry: Buffer.alloc(0) };
      this.states.set(file.path, state);
    }
    if (stat.size < state.offset) {
      state.offset = stat.size;
      state.carry = Buffer.alloc(0);
      return;
    }
    if (stat.size === state.offset) return;

    const length = stat.size - state.offset;
    const handle = fs.openSync(file.path, 'r');
    const chunk = Buffer.allocUnsafe(length);
    try {
      fs.readSync(handle, chunk, 0, length, state.offset);
    } finally {
      fs.closeSync(handle);
    }
    state.offset = stat.size;

    const combined = state.carry.length ? Buffer.concat([state.carry, chunk]) : chunk;
    let lineStart = 0;
    for (let index = 0; index < combined.length; index += 1) {
      if (combined[index] !== 0x0a) continue;
      const line = combined.subarray(lineStart, index).toString('utf8').trim();
      lineStart = index + 1;
      if (line) this.processLine(line, file.conversationId);
    }
    state.carry = combined.subarray(lineStart);
  }

  processLine(line, conversationId) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch (_) {
      return;
    }
    const logEntry = transcriptEntryToLog(entry, conversationId);
    if (!logEntry || this.seen.has(logEntry.id)) return;
    this.seen.add(logEntry.id);
    if (this.seen.size > 5000) {
      this.seen = new Set(Array.from(this.seen).slice(-2500));
    }
    this.status.lastActivityAt = new Date().toISOString();
    try {
      this.onLog(logEntry);
    } catch (error) {
      this.captureError(error);
    }
  }
}

module.exports = {
  BrainTokenMonitor,
  estimateTextTokens,
  transcriptEntryToLog
};
