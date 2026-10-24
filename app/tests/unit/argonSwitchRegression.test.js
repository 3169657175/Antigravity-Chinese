const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerAccountIpc } = require('../../accountIpc');
const { readEvidence, rememberEvidence, decorateQuotaWithEvidence, evidencePath } = require('../../argonEvidence');
const { credentialDocument } = require('../../windowsAccountCredential');

test('Argon verified evidence survives without live server; it cannot leak across accounts or refresh token changes', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-argon-evidence-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  assert.equal(rememberEvidence(home, 'first', 'refresh-first', { capabilities: { argon: true }, quota: { argonWeekly: '57%' } }), true);
  assert.equal(fs.readFileSync(evidencePath(home), 'utf8').includes('refresh-first'), false);
  const evidence = readEvidence(home, 'first', 'refresh-first');
  assert.equal(evidence.lastPercent, '57%');
  assert.equal(readEvidence(home, 'first', 'refresh-new'), null);
  assert.equal(readEvidence(home, 'second', 'refresh-first'), null);
  const result = decorateQuotaWithEvidence({ success: true, quota: { geminiWeekly: '100%' }, capabilities: { argon: false } }, evidence);
  assert.equal(result.capabilities.argon, true);
  assert.equal(result.argonCapabilityStatus, 'previously-available');
  assert.equal(result.quota.argonWeekly, undefined);
  assert.equal(result.argonLastKnown.lastPercent, '57%');
});

test('offline desktop switching rolls back on credential failure and stages the account for next launch', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-switch-atomic-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, '.gemini/antigravity/tools');
  fs.mkdirSync(path.join(root, 'accounts'), { recursive: true });
  const registry = path.join(root, 'accounts.json');
  fs.writeFileSync(registry, JSON.stringify({ accounts: [{ id: 'first' }, { id: 'second' }], current_account_id: 'first' }));
  fs.writeFileSync(path.join(root, 'accounts', 'first.json'), JSON.stringify({
    token: { refresh_token: 'old-refresh', access_token: 'old-access', expiry_timestamp: 1800000000 }
  }));
  fs.writeFileSync(path.join(root, 'accounts', 'second.json'), JSON.stringify({
    token: { refresh_token: 'mock-refresh', access_token: 'mock-access', expiry_timestamp: 1800000000 }
  }));
  const events = [];
  const handlers = new Map();
  let shouldFail = true;
  registerAccountIpc({
    app: { getPath: () => home }, safeStorage: {}, net: { fetch: async () => ({ ok: true, json: async () => ({}) }) },
    getMainWindow: () => null,
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    isClientRunning: async () => false,
    writeCredential: async token => { events.push(`keyring:${token.refresh_token}`); if (shouldFail) throw Error('simulated keyring failure'); },
    restartClient: async () => { events.push('restart'); return { restarted: true }; }
  });
  const failed = await handlers.get('switch-local-account')(null, 'second');
  assert.equal(failed.success, false);
  assert.equal(JSON.parse(fs.readFileSync(registry, 'utf8')).current_account_id, 'first');
  assert.deepEqual(events, ['keyring:mock-refresh']);
  shouldFail = false;
  const done = await handlers.get('switch-local-account')(null, 'second');
  assert.equal(done.success, true);
  assert.equal(done.credentialUpdated, true);
  assert.equal(done.willApplyOnNextLaunch, true);
  assert.equal(JSON.parse(fs.readFileSync(registry, 'utf8')).current_account_id, 'second');
  assert.deepEqual(events, ['keyring:mock-refresh', 'keyring:mock-refresh']);
  assert.equal(JSON.parse(credentialDocument({ refresh_token: 'mock-refresh', expiry_timestamp: 1800000000 })).auth_method, 'consumer');
});

test('running desktop delegates to Antigravity native switch without external credential writes or force kill', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-switch-native-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, '.gemini/antigravity/tools');
  fs.mkdirSync(path.join(root, 'accounts'), { recursive: true });
  const registryPath = path.join(root, 'accounts.json');
  fs.writeFileSync(registryPath, JSON.stringify({ accounts: [{ id: 'first' }, { id: 'second' }], current_account_id: 'first' }));
  for (const id of ['first', 'second']) {
    fs.writeFileSync(path.join(root, 'accounts', `${id}.json`), JSON.stringify({
      token: { refresh_token: `${id}-refresh`, access_token: `${id}-access`, expiry_timestamp: 1800000000 }
    }));
  }
  const handlers = new Map();
  const events = [];
  registerAccountIpc({
    app: { getPath: () => home }, safeStorage: {}, net: { fetch: async () => ({ ok: true, json: async () => ({}) }) },
    getMainWindow: () => null,
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    isClientRunning: async () => true,
    nativeSwitch: async ({ accountId }) => {
      events.push(`native:${accountId}`);
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
      registry.current_account_id = accountId;
      fs.writeFileSync(registryPath, JSON.stringify(registry));
      return { success: true, nativeBridge: true, restarted: true };
    },
    writeCredential: async () => { throw new Error('external credential writer must not run'); },
    restartClient: async () => { throw new Error('external force restart must not run'); }
  });
  const result = await handlers.get('switch-local-account')(null, 'second');
  assert.equal(result.success, true);
  assert.equal(result.nativeBridge, true);
  assert.equal(result.restarted, true);
  assert.deepEqual(events, ['native:second']);
  assert.equal(JSON.parse(fs.readFileSync(registryPath, 'utf8')).current_account_id, 'second');
});
