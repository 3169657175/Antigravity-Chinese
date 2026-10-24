const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_VERSION = 1;
const CACHE_DIRNAME = '.agy-quota-cache-v1';

function assertAccountId(accountId) {
  const value = String(accountId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('无效账号 ID');
  return value;
}

function tokenFingerprint(refreshToken) {
  const token = String(refreshToken || '');
  if (!token) return '';
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function quotaCachePath(accountRoot, accountId) {
  return path.join(path.resolve(accountRoot), CACHE_DIRNAME, `${assertAccountId(accountId)}.json`);
}

function stripSecrets(value, seen = new WeakSet()) {
  if (Array.isArray(value)) return value.map(item => stripSecrets(item, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return null;
  seen.add(value);
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    if (/(?:^|_)(?:access|refresh)?token(?:$|_)|authorization|credential|client_secret/i.test(key)) continue;
    clean[key] = stripSecrets(item, seen);
  }
  return clean;
}

function readCachedQuota(options = {}) {
  const { accountRoot, accountId, refreshToken, fsModule = fs } = options;
  const fingerprint = tokenFingerprint(refreshToken);
  if (!fingerprint) return null;
  const filePath = quotaCachePath(accountRoot, accountId);
  try {
    const entry = JSON.parse(fsModule.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
    if (entry?.version !== CACHE_VERSION || entry?.tokenFingerprint !== fingerprint) return null;
    if (!entry?.result?.success || !entry?.result?.quota || !Number.isFinite(Number(entry.savedAt))) return null;
    return {
      ...stripSecrets(entry.result),
      fromCache: true,
      cachedAt: Number(entry.savedAt),
      quotaCacheVersion: CACHE_VERSION
    };
  } catch (_) {
    return null;
  }
}

function writeCachedQuota(options = {}) {
  const { accountRoot, accountId, refreshToken, result, fsModule = fs, now = Date.now() } = options;
  const fingerprint = tokenFingerprint(refreshToken);
  if (!fingerprint || !result?.success || !result?.quota) return false;
  const filePath = quotaCachePath(accountRoot, accountId);
  const dir = path.dirname(filePath);
  const payload = {
    version: CACHE_VERSION,
    accountId: assertAccountId(accountId),
    tokenFingerprint: fingerprint,
    savedAt: Number(now),
    result: stripSecrets(result)
  };
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fsModule.mkdirSync(dir, { recursive: true });
    fsModule.writeFileSync(tempPath, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 });
    fsModule.renameSync(tempPath, filePath);
    return true;
  } catch (_) {
    try { fsModule.unlinkSync(tempPath); } catch (_) {}
    return false;
  }
}

module.exports = {
  CACHE_VERSION,
  CACHE_DIRNAME,
  tokenFingerprint,
  quotaCachePath,
  readCachedQuota,
  writeCachedQuota,
  stripSecrets
};
