function toFiniteNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
}

function firstNumber(object, keys) {
  for (const key of keys) {
    if (!object || object[key] === undefined) continue;
    const value = toFiniteNumber(object[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function readJsonUsage(value, depth = 0, seen = new Set(), knownUsage = false) {
  if (!value || typeof value !== 'object' || depth > 12 || seen.has(value)) return null;
  seen.add(value);

  const namedUsageKeys = ['usageMetadata', 'usage_metadata', 'usage', 'tokenUsage', 'token_usage'];
  let usage = null;
  for (const key of namedUsageKeys) {
    if (value[key] && typeof value[key] === 'object') {
      usage = mergeUsage(usage, readJsonUsage(value[key], depth + 1, seen, true));
    }
  }

  const input = firstNumber(value, [
    'promptTokenCount', 'prompt_token_count', 'prompt_tokens', 'inputTokenCount',
    'input_token_count', 'input_tokens', 'inputTokens', 'promptTokens'
  ]);
  const output = firstNumber(value, [
    'candidatesTokenCount', 'candidates_token_count', 'completion_tokens',
    'outputTokenCount', 'output_token_count', 'output_tokens', 'outputTokens', 'completionTokens'
  ]);
  const cachedDetails = value.prompt_tokens_details || value.input_tokens_details || {};
  const directCached = firstNumber(value, [
    'cachedContentTokenCount', 'cached_content_token_count', 'cachedTokenCount',
    'cached_token_count', 'cached_tokens', 'cachedTokens'
  ]);
  const nestedCached = firstNumber(cachedDetails, ['cached_tokens', 'cachedTokens']);
  const cached = directCached ?? nestedCached;

  if (input !== undefined || output !== undefined || cached !== undefined) {
    usage = mergeUsage(usage, {
      input: input || 0,
      output: output || 0,
      cached: cached || 0,
      cacheKnown: knownUsage || cached !== undefined,
      protocol: 'json'
    });
  }

  if (Array.isArray(value)) {
    for (const child of value) usage = mergeUsage(usage, readJsonUsage(child, depth + 1, seen, knownUsage));
  } else {
    for (const [key, child] of Object.entries(value)) {
      if (namedUsageKeys.includes(key)) continue;
      usage = mergeUsage(usage, readJsonUsage(child, depth + 1, seen, false));
    }
  }
  return usage;
}

function mergeUsage(current, next) {
  if (!next) return current;
  if (!current) return next;
  const currentTotal = (current.input || 0) + (current.output || 0);
  const nextTotal = (next.input || 0) + (next.output || 0);
  const primary = nextTotal >= currentTotal ? next : current;
  return {
    input: Math.max(current.input || 0, next.input || 0),
    output: Math.max(current.output || 0, next.output || 0),
    cached: Math.max(current.cached || 0, next.cached || 0),
    cacheKnown: Boolean(current.cacheKnown || next.cacheKnown),
    protocol: primary.protocol || current.protocol || next.protocol
  };
}

function extractUsageFromText(text) {
  if (!text || !text.trim()) return null;
  let usage = null;
  const tryJson = (candidate) => {
    const normalized = candidate.trim().replace(/^\)\]\}'\s*/, '');
    if (!normalized) return;
    try {
      usage = mergeUsage(usage, readJsonUsage(JSON.parse(normalized)));
    } catch (_) {}
  };

  tryJson(text);
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line === 'data: [DONE]') continue;
    if (line.startsWith('data:')) line = line.slice(5).trim();
    tryJson(line);
  }

  if (!usage) {
    const prompt = /["'](?:promptTokenCount|prompt_token_count|prompt_tokens|inputTokenCount|input_tokens)["']\s*:\s*(\d+)/i.exec(text);
    const output = /["'](?:candidatesTokenCount|candidates_token_count|completion_tokens|outputTokenCount|output_tokens)["']\s*:\s*(\d+)/i.exec(text);
    const cached = /["'](?:cachedContentTokenCount|cached_content_token_count|cached_tokens)["']\s*:\s*(\d+)/i.exec(text);
    if (prompt || output || cached) {
      usage = {
        input: prompt ? Number(prompt[1]) : 0,
        output: output ? Number(output[1]) : 0,
        cached: cached ? Number(cached[1]) : 0,
        cacheKnown: Boolean(cached),
        protocol: 'text'
      };
    }
  }
  return usage;
}

function readVarint(buffer, start) {
  let value = 0n;
  let shift = 0n;
  let offset = start;
  while (offset < buffer.length && offset - start < 10) {
    const byte = buffer[offset++];
    value |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      return { value: Number(value), offset };
    }
    shift += 7n;
  }
  return null;
}

function parseProtoMessage(buffer, depth = 0, candidates = []) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || depth > 14) return candidates;
  let offset = 0;
  const varints = new Map();
  const children = [];

  while (offset < buffer.length) {
    const keyResult = readVarint(buffer, offset);
    if (!keyResult || keyResult.value === 0) return candidates;
    offset = keyResult.offset;
    const field = Math.floor(keyResult.value / 8);
    const wire = keyResult.value & 7;
    if (field <= 0 || field > 100000) return candidates;

    if (wire === 0) {
      const valueResult = readVarint(buffer, offset);
      if (!valueResult) return candidates;
      offset = valueResult.offset;
      if (!varints.has(field)) varints.set(field, []);
      varints.get(field).push(valueResult.value);
    } else if (wire === 1) {
      if (offset + 8 > buffer.length) return candidates;
      offset += 8;
    } else if (wire === 2) {
      const lengthResult = readVarint(buffer, offset);
      if (!lengthResult) return candidates;
      offset = lengthResult.offset;
      const end = offset + lengthResult.value;
      if (lengthResult.value < 0 || end > buffer.length) return candidates;
      if (lengthResult.value > 0) children.push(buffer.subarray(offset, end));
      offset = end;
    } else if (wire === 5) {
      if (offset + 4 > buffer.length) return candidates;
      offset += 4;
    } else {
      return candidates;
    }
  }

  const input = varints.get(1)?.[0];
  const output = varints.get(2)?.[0];
  const total = varints.get(3)?.[0];
  const cachedValues = varints.get(5);
  if (
    input !== undefined && output !== undefined && total !== undefined &&
    (input > 0 || output > 0) &&
    input <= 1_000_000_000 && output <= 1_000_000_000 && total <= 2_000_000_000 &&
    total >= input + output
  ) {
    candidates.push({
      input,
      output,
      cached: cachedValues?.[0] || 0,
      cacheKnown: true,
      protocol: 'protobuf',
      score: (cachedValues ? 4 : 0) + Math.min(3, varints.size)
    });
  }

  for (const child of children) parseProtoMessage(child, depth + 1, candidates);
  return candidates;
}

function extractGrpcFrames(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 5) return [];
  const frames = [];
  let offset = 0;
  while (offset + 5 <= buffer.length) {
    const flag = buffer[offset];
    if ((flag & 0x7e) !== 0) return [];
    const length = buffer.readUInt32BE(offset + 1);
    const end = offset + 5 + length;
    if (end > buffer.length) return [];
    if ((flag & 0x80) === 0 && length > 0) {
      let payload = buffer.subarray(offset + 5, end);
      if ((flag & 1) === 1 && payload[0] === 0x1f && payload[1] === 0x8b) {
        try { payload = require('zlib').gunzipSync(payload); } catch (_) {}
      }
      frames.push(payload);
    }
    offset = end;
  }
  return offset === buffer.length ? frames : [];
}

function extractUsageFromProtobuf(buffer) {
  const payloads = extractGrpcFrames(buffer);
  const targets = payloads.length > 0 ? payloads : [buffer];
  const candidates = [];
  for (const payload of targets) parseProtoMessage(payload, 0, candidates);
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.score - left.score || (right.input + right.output) - (left.input + left.output));
  const best = candidates[0];
  return {
    input: best.input,
    output: best.output,
    cached: best.cached,
    cacheKnown: best.cacheKnown,
    protocol: payloads.length > 0 ? 'grpc-protobuf' : 'protobuf'
  };
}

function looksTextual(buffer, contentType = '') {
  if (/json|text|event-stream|javascript|xml/i.test(String(contentType))) return true;
  if (!buffer || buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 128)).toString('utf8').trimStart();
  return sample.startsWith('{') || sample.startsWith('[') || sample.startsWith('data:') || sample.startsWith(")]}'");
}

function extractOfficialUsage(buffer, contentType = '') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
  let usage = null;
  if (looksTextual(buffer, contentType)) usage = extractUsageFromText(buffer.toString('utf8'));
  if (!usage) usage = extractUsageFromProtobuf(buffer);
  return usage;
}

function shouldTrackModelRequest(method, requestUrl) {
  if (!['POST', 'PUT', 'PATCH'].includes(String(method || '').toUpperCase())) return false;
  const lower = String(requestUrl || '').toLowerCase();
  if (/(oauth|auth\/|tokeninfo|quota|feedback|telemetry|health|models(?:\?|$)|counttokens)/.test(lower)) return false;
  return /(?:stream)?generatecontent|completions?|chat(?:\/|:|\?|$)|cascade|assist|prompt/.test(lower);
}

function buildTokenStats(logs) {
  const normalizedLogs = Array.isArray(logs) ? logs.slice(0, 500) : [];
  const stats = {
    schemaVersion: 2,
    logs: normalizedLogs,
    total_input: 0,
    total_output: 0,
    total_cached: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    cachedTokens: 0,
    cachePromptTokens: 0,
    cacheSamples: 0,
    cacheDataAvailable: false,
    officialRequests: 0,
    estimatedRequests: 0
  };
  for (const log of normalizedLogs) {
    stats.total_input += toFiniteNumber(log.input ?? log.promptTokens) || 0;
    stats.total_output += toFiniteNumber(log.output ?? log.completionTokens) || 0;
    if (log.estimated) stats.estimatedRequests += 1;
    else stats.officialRequests += 1;
    if (log.cacheKnown) {
      stats.total_cached += toFiniteNumber(log.cached ?? log.cachedTokens) || 0;
      stats.cachePromptTokens += toFiniteNumber(log.input ?? log.promptTokens) || 0;
      stats.cacheSamples += 1;
    }
  }
  stats.promptTokens = stats.total_input;
  stats.completionTokens = stats.total_output;
  stats.cachedTokens = stats.total_cached;
  stats.totalTokens = stats.total_input + stats.total_output;
  stats.cacheDataAvailable = stats.cacheSamples > 0;
  return stats;
}

module.exports = {
  buildTokenStats,
  extractOfficialUsage,
  extractUsageFromProtobuf,
  extractUsageFromText,
  shouldTrackModelRequest,
  toFiniteNumber
};
