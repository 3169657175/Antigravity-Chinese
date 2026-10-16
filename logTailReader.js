const fs = require('fs');

const DEFAULT_MAX_BYTES = 128 * 1024;
const DEFAULT_CACHE_TTL_MS = 1500;

class LogTailReader {
  constructor(options = {}) {
    this.maxBytes = Math.max(1024, Number(options.maxBytes) || DEFAULT_MAX_BYTES);
    this.cacheTtlMs = Math.max(0, Number(options.cacheTtlMs) || DEFAULT_CACHE_TTL_MS);
    this.cache = new Map();
  }

  async read(filePath) {
    const now = Date.now();
    let stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') return { text: '', bytesRead: 0, size: 0, missing: true, cached: false };
      throw error;
    }

    const cached = this.cache.get(filePath);
    if (cached
      && cached.size === stats.size
      && cached.mtimeMs === stats.mtimeMs
      && now - cached.readAt < this.cacheTtlMs) {
      return { ...cached.result, cached: true };
    }

    const bytesRead = Math.min(stats.size, this.maxBytes);
    const offset = Math.max(0, stats.size - bytesRead);
    const handle = await fs.promises.open(filePath, 'r');
    try {
      const buffer = Buffer.allocUnsafe(bytesRead);
      const result = bytesRead > 0 ? await handle.read(buffer, 0, bytesRead, offset) : { bytesRead: 0 };
      const payload = {
        text: result.bytesRead > 0 ? buffer.subarray(0, result.bytesRead).toString('utf8') : '',
        bytesRead: result.bytesRead,
        size: stats.size,
        missing: false,
        cached: false
      };
      this.cache.set(filePath, { size: stats.size, mtimeMs: stats.mtimeMs, readAt: now, result: payload });
      return payload;
    } finally {
      await handle.close();
    }
  }

  invalidate(filePath) {
    if (filePath) this.cache.delete(filePath);
    else this.cache.clear();
  }
}

function detectLatestRouteState(text) {
  const content = String(text || '');
  const routedMarker = '[Token Monitor] Routing model traffic through';
  const directMarker = '[Token Monitor] AGY Hub is unavailable';
  const routedIndex = content.lastIndexOf(routedMarker);
  const directIndex = content.lastIndexOf(directMarker);
  return routedIndex >= 0 && routedIndex > directIndex;
}

module.exports = {
  LogTailReader,
  detectLatestRouteState,
  DEFAULT_MAX_BYTES,
  DEFAULT_CACHE_TTL_MS
};
