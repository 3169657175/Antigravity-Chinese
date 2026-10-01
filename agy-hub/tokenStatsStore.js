const fs = require('fs');
const path = require('path');
const { buildTokenStats } = require('./tokenUsage');

const DEFAULT_MAX_RECORDS = 500;
const DEFAULT_FLUSH_DELAY_MS = 800;

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')); }
  catch (_) { return fallback; }
}

function recordKey(record) {
  return `${record?.id || ''}|${record?.time || ''}|${record?.source || ''}|${record?.model || ''}`;
}

class TokenStatsStore {
  constructor(options = {}) {
    this.snapshotPath = options.snapshotPath;
    this.journalPath = options.journalPath || `${this.snapshotPath}.journal.jsonl`;
    this.maxRecords = Math.max(50, Number(options.maxRecords) || DEFAULT_MAX_RECORDS);
    this.flushDelayMs = Math.max(50, Number(options.flushDelayMs) || DEFAULT_FLUSH_DELAY_MS);
    this.records = null;
    this.flushTimer = null;
  }

  load() {
    if (this.records) return this.records;
    const snapshot = readJson(this.snapshotPath, { logs: [] });
    const candidates = Array.isArray(snapshot.logs) ? [...snapshot.logs] : [];
    try {
      for (const line of fs.readFileSync(this.journalPath, 'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        try { candidates.unshift(JSON.parse(line)); } catch (_) {}
      }
    } catch (_) {}
    const seen = new Set();
    this.records = candidates.filter(record => {
      const key = recordKey(record);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).sort((a, b) => String(b.time || '').localeCompare(String(a.time || ''))).slice(0, this.maxRecords);
    return this.records;
  }

  record(entry) {
    const records = this.load();
    records.unshift(entry);
    if (records.length > this.maxRecords) records.length = this.maxRecords;
    fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });
    fs.appendFileSync(this.journalPath, `${JSON.stringify(entry)}\n`, 'utf8');
    this.scheduleFlush();
    return buildTokenStats(records);
  }

  getStats() {
    return buildTokenStats(this.load());
  }

  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      try { this.flush(); } catch (error) { console.error('[Token Store] Flush failed:', error); }
    }, this.flushDelayMs);
    this.flushTimer.unref?.();
  }

  flush() {
    if (!this.records) return;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    fs.mkdirSync(path.dirname(this.snapshotPath), { recursive: true });
    const temporary = `${this.snapshotPath}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, `${JSON.stringify(buildTokenStats(this.records), null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, this.snapshotPath);
    fs.writeFileSync(this.journalPath, '', 'utf8');
  }
}

module.exports = { TokenStatsStore, DEFAULT_MAX_RECORDS };
