// Positive evidence only, scoped to the account credential fingerprint.
// Keeps *last observed* capability separate from live quota and never stores tokens.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
function readJsonSafe(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return fallback; }
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  try { fs.writeFileSync(temp, JSON.stringify(value), 'utf8'); fs.renameSync(temp, file); }
  finally { try { if (fs.existsSync(temp)) fs.unlinkSync(temp); } catch (_) {} }
}
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
function fingerprint(accountId, refreshToken) {
  return crypto.createHash('sha256').update(String(accountId) + '\0' + String(refreshToken || '')).digest('hex');
}
function evidencePath(home) { return path.join(home, '.gemini', 'antigravity', 'tools', 'argon-evidence.json'); }
function validPercent(value) { return /^\d{1,3}%$/.test(String(value || '')) && Number.parseInt(value, 10) <= 100; }
function readEvidence(home, accountId, refreshToken, now = Date.now()) {
  if (!refreshToken || !/^[A-Za-z0-9_-]{1,128}$/.test(String(accountId))) return null;
  const key = fingerprint(accountId, refreshToken);
  const db = readJsonSafe(evidencePath(home), { version: 1, accounts: {} });
  const record = db?.accounts?.[key];
  const age = now - Number(record?.checkedAt);
  if (!record || !Number.isFinite(age) || age < 0 || age > MAX_AGE) return null;
  return { checkedAt: Number(record.checkedAt), lastPercent: validPercent(record.lastPercent) ? record.lastPercent : null, lastReset: typeof record.lastReset === 'string' ? record.lastReset : null };
}
function rememberEvidence(home, accountId, refreshToken, result, now = Date.now()) {
  if (!refreshToken || !/^[A-Za-z0-9_-]{1,128}$/.test(String(accountId)) || result?.capabilities?.argon !== true) return false;
  const file = evidencePath(home);
  const db = readJsonSafe(file, { version: 1, accounts: {} });
  const accounts = db?.accounts && typeof db.accounts === 'object' && !Array.isArray(db.accounts) ? db.accounts : {};
  const key = fingerprint(accountId, refreshToken);
  const old = accounts[key];
  const found = result.quota?.argonWeekly;
  accounts[key] = {
    checkedAt: now,
    lastPercent: validPercent(found) ? found : (validPercent(old?.lastPercent) ? old.lastPercent : null),
    lastReset: result.quota?.argonWeeklyReset || old?.lastReset || null
  };
  for (const [id, record] of Object.entries(accounts)) {
    if (!record?.checkedAt || now - Number(record.checkedAt) > MAX_AGE || Number(record.checkedAt) > now) delete accounts[id];
  }
  writeJsonAtomic(file, { version: 1, accounts });
  return true;
}
function decorateQuotaWithEvidence(result, evidence) {
  if (!result || !evidence) return result;
  if (result.capabilities?.argon === true) return result;
  return {
    ...result,
    capabilities: { ...result.capabilities, argon: true },
    argonCapabilityStatus: 'previously-available',
    argonLastKnown: evidence,
    // Retain unknown live quota. Never copy lastPercent into quota.argonWeekly.
  };
}
module.exports = { fingerprint, evidencePath, readEvidence, rememberEvidence, decorateQuotaWithEvidence };
