const test = require('node:test');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const vm = require('node:vm');
const { buildUtils, enhanceNativeLanguageServerQuota } = require('../../patch-workbench/compatibility');
const legacy = name => asar.extractFile('patch-workbench/legacy-payload.asar', `dist/${name}.js`).toString().replace(/\r\n/g, '\n');

test('2.34 window overlay preserves bootstrap loading and accepts formatting changes', () => {
  const official = `function createWindow(url) {\n const win = makeWindow();\n void loadHubWindowUrl(win, url, { skipBootstrapMint });\n return win;\n}\n/**\n * Focuses a window if it exists, or creates a new one.\n */`;
  const result = buildUtils(official, legacy('utils'));
  new vm.Script(result);
  assert.match(result, /void loadHubWindowUrl\(win, url, \{ skipBootstrapMint \}\)/);
  assert.equal(result.match(/win.on\('close'/g).length, 1);
  assert.throws(() => buildUtils(official.replace('void loadHubWindowUrl', 'void unknownLoader'), legacy('utils')), /extension point/);
});

test('current quota polls structured LS summary and pushes to WebContentsView windows', async () => {
  const built = enhanceNativeLanguageServerQuota(legacy('ipcHandlers'));
  const start = built.indexOf('let agyLocalQuotaPollInFlight');
  const end = built.indexOf('function requestGrpc(', start);
  const sent = [];
  const ctx = {
    Buffer, console, Date,
    electron_1: { BrowserWindow: { getAllWindows: () => [] }, webContents: { getAllWebContents: () => [{ isDestroyed: () => false, send: (channel, value) => sent.push(value) }] } },
    appendQuotaDebugLog() {},
    require(name) {
      if (name === './languageServer') return { getLsPort: () => 123, getLsCsrf: () => 'csrf', getLsCsrfToken: () => 'csrf' };
      if (name === './accountQuota') return require('../../accountQuota');
      if (name === 'fs') return { readFileSync: () => JSON.stringify({ current_account_id: 'a' }) };
      if (name === 'os') return { homedir: () => '/test' };
      return require(name);
    },
    requestGrpc: async () => Buffer.alloc(0),
    requestQuotaJson: async () => ({ groups: [{ buckets: [
      { bucketId: 'gemini-5h', remainingFraction: 0 },
      { bucketId: 'gemini-weekly', remainingFraction: 0.7 },
      { bucketId: '3p-5h', remainingFraction: 1 }
    ] }] })
  };
  // Only execute the generated polling path, never the actual Electron lifecycle.
  vm.runInNewContext(built.slice(start, end) + '\nglobalThis.poll = pollLocalQuota;', ctx);
  const result = await ctx.poll();
  assert.equal(result.success, true);
  assert.equal(result.quota.gemini5h, '0%');
  assert.equal(result.quota.geminiWeekly, '70%');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].quota.gemini5h, '0%');
});

test('Hub registers export and import handlers behind its existing preload contract', () => {
  const handlers = new Map();
  require('../../accountIpc').registerAccountIpc({ ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, app: {}, net: {}, safeStorage: {} });
  assert.equal(typeof handlers.get('export-local-account'), 'function');
  assert.equal(typeof handlers.get('import-local-account-file'), 'function');
});

test('shared quota state rejects old-account pushes and clears fields explicitly unavailable', () => {
  const values = new Map();
  const storage = { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  const state = require('../../patch-workbench/compatibility').createQuotaSnapshotState(storage);
  state.setAccount('a');
  state.publish({ success: true, accountId: 'a', quota: { gemini5h: '100%', argonWeekly: '9%' } });
  state.publish({ success: true, accountId: 'b', quota: { gemini5h: '20%' } });
  assert.equal(state.getResult().quota.gemini5h, '100%');
  state.publish({ success: true, accountId: 'a', quota: { gemini5h: '0%', argonWeekly: '--' } });
  assert.equal(state.getResult().quota.gemini5h, '0%');
  assert.equal(state.getResult().quota.argonWeekly, undefined);
  state.publish({ success: false, error: 'offline' });
  assert.equal(state.getResult().cached, true);
});

async function verifyRegistration(t, built, fixture = false) {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-ipc-registration-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const handlers = new Map();
  const timers = [];
  const electron = {
    ipcMain: { handle: (name, handler) => { name = String(name); assert.equal(handlers.has(name), false, name); handlers.set(name, handler); }, on() {} },
    app: { on() {}, getPath: () => home },
    webContents: { getAllWebContents: () => [] },
    BrowserWindow: { getAllWindows: () => [] }, safeStorage: {}, net: {}
  };
  // Official browser integrations are inert; execute the real registration
  // body and AGY account/bridge logic, not a rewritten copy of that function.
  function inert(name) {
    return new Proxy(function () {}, { get(_target, key) {
      if (key === '__esModule') return true;
      if (key === Symbol.toPrimitive) return () => name;
      return inert(name + '.' + String(key));
    } });
  }
  const ctx = {
    exports: {}, console: { log() {}, error() {}, warn() {} }, Buffer, URL, URLSearchParams, process: { env: {} },
    setInterval(fn, ms) { timers.push({ fn, ms }); return { unref() {} }; }, clearInterval() {}, setTimeout() {},
    require(name) {
      if (name === 'electron') return electron;
      if (name === './accountVault') return { readAccountToken: detail => ({ token: detail.token, needsMigration: false }) };
      if (name === 'child_process') return { execSync() { throw new Error('Test must never invoke system credentials'); } };
      if (name === './languageServer') return { getLsPort: () => 0, getLsCsrf: () => '' };
      if (name === 'os') return { homedir: () => home };
      if (name === './accountTransfer') return { registerAccountTransferIpc: options => require('../../accountTransfer').registerAccountTransferIpc({ ...options, accountRoot: path.join(home, '.gemini/antigravity/tools') }) };
      if (name.startsWith('./') || name === 'electron-log/main') return inert(name);
      return require(name);
    }
  };
  vm.runInNewContext(built, ctx);
  const result = ctx.exports.registerIpcHandlers({});
  assert.equal(typeof result.closeContextMenu, 'function');
  if (fixture) assert.equal(result.closeContextMenu(), 42);
  for (const channel of [fixture ? 'official:retained' : 'dialog:open-workspaces', 'accounts:list', 'accounts:switch', 'agy:quota:get-current', 'agy:quota:refresh-current', 'export-local-account', 'import-local-account-file']) {
    assert.equal(typeof handlers.get(channel), 'function', `${channel} must be registered at startup`);
  }
  assert.ok(timers.some(timer => timer.ms === 200), 'native account-switch request bridge must start');
  assert.ok(timers.some(timer => timer.ms === 5000), 'quota scheduler must start');
  const accounts = await handlers.get('accounts:list')();
  assert.equal(accounts.currentAccountId, '');
  assert.equal(accounts.accounts.length, 0);
  const root = path.join(home, '.gemini/antigravity/tools');
  fs.mkdirSync(path.join(root, 'accounts'), { recursive: true });
  const registry = { current_account_id: 'a', accounts: [{ id: 'a', email: 'a@example.test' }, { id: 'b', email: 'b@example.test' }] };
  fs.writeFileSync(path.join(root, 'accounts.json'), JSON.stringify(registry));
  for (const account of registry.accounts) {
    fs.writeFileSync(path.join(root, 'accounts', account.id + '.json'), JSON.stringify({ ...account, token: { access_token: 'test-access', refresh_token: 'test-refresh', expiry_timestamp: 2000000000 } }));
  }
  assert.equal((await handlers.get('accounts:list')()).accounts.length, 2);
  fs.writeFileSync(path.join(root, '.agy-native-switch-request.json'), JSON.stringify({ protocol: 1, nonce: 'a'.repeat(32), accountId: 'b', createdAt: Date.now() }));
  await timers.find(timer => timer.ms === 200).fn();
  const response = JSON.parse(fs.readFileSync(path.join(root, '.agy-native-switch-response.json')));
  assert.equal(response.success, true, response.error);
  assert.equal(response.restartScheduled, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'accounts.json'))).current_account_id, 'b');
}

test('actual injected registration runs accounts, quota and switch bridge before official return', async t => {
  const official = `const electron_1 = require("electron");
function registerIpcHandlers(storageManager, deps = {}) {
  electron_1.ipcMain.handle('official:retained', () => 42);
  return { closeContextMenu: () => 42 };
}
function helperAfterRegistration() { return 'retained'; }
exports.registerIpcHandlers = registerIpcHandlers;`;
  await verifyRegistration(t, require('../../patch-workbench/compatibility').buildIpcHandlers(official, legacy('ipcHandlers')), true);
});

test('release ASAR executes complete official and injected IPC startup plus native switch roundtrip', async t => {
  const archive = process.env.AGY_TEST_PATCH_ASAR || 'assets/app.asar';
  await verifyRegistration(t, asar.extractFile(archive, 'dist/ipcHandlers.js').toString());
});
