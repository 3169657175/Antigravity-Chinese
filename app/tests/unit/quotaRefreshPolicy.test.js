const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const read = file => fs.readFileSync(file, 'utf8');

test('local accounts reuse quota cache after switching and reserve live reads for manual refresh', () => {
  const controller = read('localAccountsController.js');
  const renderer = read('renderer.js');
  const preload = read('preload.js');
  assert.match(controller, /fetchAccountQuota\(account\.id, \{ force: quotaOptions\.force === true \}\)/);
  assert.match(controller, /loadLocalAccounts\(\{ logToTerminal, forceQuotaRefresh: false \}\)/);
  assert.match(renderer, /btnRefreshLocalAccounts\.addEventListener\('click', \(\) => loadLocalAccounts\(\{ forceQuotaRefresh: true \}\)\)/);
  assert.match(preload, /accountId: id,[\s\S]*force: options\.force === true/);
});

test('gateway account selection is cache-first and only refresh buttons force cloud quota', () => {
  const source = read('gatewayController.js');
  assert.match(source, /fetchAccountQuota\(selectedId, \{ force: options\.force === true \}\)/);
  assert.match(source, /refreshQuotaButton\.addEventListener\('click', \(\) => refreshSelectedQuota\(\{ force: true, showResult: true \}\)\)/);
  assert.match(source, /claudeGatewayRefreshQuotaButton\?\.addEventListener\('click', \(\) => refreshClaudeSelectedQuota\(\{ force: true, showResult: true \}\)\)/);
  assert.doesNotMatch(source, /scheduleAfterPaint\(\(\) => refresh\(\{ force: true, includeQuota: true \}\)\)/);
});

test('injected account UI has no periodic quota polling and explicit refresh bypasses cache', () => {
  const source = read('patch-workbench/compatibility.js');
  assert.doesNotMatch(source, /setInterval\(refreshAgyActiveQuota/);
  assert.match(source, /force: Boolean\(forceQuota\)/);
  assert.match(source, /btn-refresh'\)\.onclick = \(\) => loadAccounts\(true, true\)/);
  assert.match(source, /prevSig !== nextSig\) loadAccounts\(true, false\)/);
});
