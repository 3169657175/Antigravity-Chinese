const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createQuotaSnapshotState } = require('../../patch-workbench/compatibility');

const read = file => fs.readFileSync(file, 'utf8');

test('local accounts poll only the current account through Language Server', () => {
  const controller = read('localAccountsController.js');
  const renderer = read('renderer.js');
  const preload = read('preload.js');
  assert.match(controller, /source: account\?\.current \? 'language-server' : 'cloud'/);
  assert.match(controller, /fetchAccountQuota\(accountId, \{ force: true, source: 'language-server' \}\)/);
  assert.match(controller, /CURRENT_ACCOUNT_QUOTA_POLL_INTERVAL_MS = 15000/);
  assert.match(controller, /loadLocalAccounts\(\{ logToTerminal, forceQuotaRefresh: false \}\)/);
  assert.match(renderer, /btnRefreshLocalAccounts\.addEventListener\('click', \(\) => loadLocalAccounts\(\{ forceQuotaRefresh: true \}\)\)/);
  assert.match(renderer, /stopCurrentAccountQuotaPolling/);
  assert.match(renderer, /startCurrentAccountQuotaPolling/);
  assert.match(preload, /accountId: id,[\s\S]*force: options\.force === true,[\s\S]*source: options\.source === 'language-server'/);
});

test('gateway account selection is cache-first and only refresh buttons force cloud quota', () => {
  const source = read('gatewayController.js');
  assert.match(source, /fetchAccountQuota\(selectedId, \{ force: options\.force === true \}\)/);
  assert.match(source, /refreshQuotaButton\.addEventListener\('click', \(\) => refreshSelectedQuota\(\{ force: true, showResult: true \}\)\)/);
  assert.match(source, /claudeGatewayRefreshQuotaButton\?\.addEventListener\('click', \(\) => refreshClaudeSelectedQuota\(\{ force: true, showResult: true \}\)\)/);
  assert.doesNotMatch(source, /scheduleAfterPaint\(\(\) => refresh\(\{ force: true, includeQuota: true \}\)\)/);
});

test('current quota snapshot is stable across repeated renders and transient Language Server failures', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
  const state = createQuotaSnapshotState(storage);
  state.setAccount('account-a');
  state.publish({
    success: true,
    quota: {
      geminiWeekly: '100%',
      gemini5h: '99%',
      claudeWeekly: '100%',
      claude5h: '100%',
      argonWeekly: '8%'
    },
    capabilities: { argon: true },
    fetchedAt: Date.now()
  });

  assert.deepEqual(state.getResult().quota, {
    geminiWeekly: '100%',
    gemini5h: '99%',
    claudeWeekly: '100%',
    claude5h: '100%',
    argonWeekly: '8%'
  });
  state.publish({ success: false, error: 'temporary failure' });
  assert.equal(state.getResult().quota.argonWeekly, '8%');
  state.setAccount('account-a');
  assert.equal(state.getResult().quota.gemini5h, '99%');

  const restored = createQuotaSnapshotState(storage);
  restored.setAccount('account-a');
  assert.equal(restored.getResult().quota.claudeWeekly, '100%');
  assert.equal(restored.getResult().cached, true);
  restored.setAccount('account-b');
  assert.equal(restored.getResult().success, false);
});

test('injected current account uses one pushed Language Server snapshot while inactive accounts use Hub cloud lookup', () => {
  const source = read('patch-workbench/compatibility.js');
  assert.match(source, /ipcRenderer\.on\('agy:quota:updated'/);
  assert.match(source, /ipcRenderer\.invoke\('agy:quota:get-current'\)/);
  assert.match(source, /contents\.send\('agy:quota:updated', result\)/);
  assert.match(source, /ipcRenderer\.invoke\('agy:quota:refresh-current'\)/);
  assert.match(source, /isCurrent \? Promise\.resolve\(getAgyCurrentQuotaResult\(\)\)/);
  assert.match(source, /gemini-argon-wtu-weekly/);
  assert.match(source, /buildLanguageServerQuotaResult\(summary\)/);
  assert.match(source, /agy_current_account_id/);
  assert.match(source, /agy_quota_snapshot_v3_/);
  assert.doesNotMatch(source, /invoke\('fetch-account-quota', \{ accountId: id/);
  assert.doesNotMatch(source, /executeJavaScript\(`/);
  assert.doesNotMatch(source, /window\.dispatchEvent\(new CustomEvent\('agy-language-server-quota'/);
  assert.doesNotMatch(source, /isArgon && argonWeekly === '待查询'[\s\S]*refreshAgyActiveQuota/);
  assert.match(source, /force: Boolean\(forceQuota\)/);
  assert.match(source, /btn-refresh'\)\.onclick = async \(\) =>/);
  assert.match(source, /prevSig !== nextSig\) loadAccounts\(true, false\)/);
});
