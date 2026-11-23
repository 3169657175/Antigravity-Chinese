// Legacy compatibility shim.
//
// Argon availability must come from the current live quota response. Older
// releases persisted positive evidence and later used it to re-enable the
// Argon card when a live response did not contain an Argon bucket. That made
// an old percentage look like it belonged to the current account.
//
// Keep this module so already-generated patch code can still require it, but
// stop reading, writing, or applying historical evidence.
const path = require('path');
const crypto = require('crypto');

function fingerprint(accountId, refreshToken) {
  return crypto.createHash('sha256').update(String(accountId) + '\0' + String(refreshToken || '')).digest('hex');
}

function evidencePath(home) {
  return path.join(home, '.gemini', 'antigravity', 'tools', 'argon-evidence.json');
}

function readEvidence() { return null; }
function rememberEvidence() { return false; }
function decorateQuotaWithEvidence(result) { return result; }

module.exports = { fingerprint, evidencePath, readEvidence, rememberEvidence, decorateQuotaWithEvidence };
