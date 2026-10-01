const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('token polling is visibility-aware and has explicit cleanup', () => {
  const source = fs.readFileSync('src/tokenMonitorController.js', 'utf8');
  assert.match(source, /document\.hidden/);
  assert.match(source, /tab-local-accounts/);
  assert.match(source, /function stopPolling\(\)/);
  assert.match(source, /clearInterval\(statsTimer\)/);
  assert.match(source, /clearInterval\(statusTimer\)/);
  assert.match(source, /visibilitychange/);
  assert.doesNotMatch(source, /setInterval\(async \(\) =>/);
});
