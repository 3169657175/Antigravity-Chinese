const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('export/import round trip preserves current ID and encrypts imported credentials', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-transfer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const handlers = new Map();
  const file = path.join(root, 'export.json');
  const token = { refresh_token: 'synthetic-refresh', access_token: 'synthetic-access' };
  fs.mkdirSync(path.join(root, 'accounts'));
  fs.writeFileSync(path.join(root, 'accounts/a.json'), JSON.stringify({ id: 'a', email: 'a@example.test', name: 'A', token }));
  fs.writeFileSync(path.join(root, 'accounts.json'), JSON.stringify({ accounts: [{ id: 'a', email: 'a@example.test' }], current_account_id: 'a' }));
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from(text), decryptString: buf => buf.toString() };
  require('../../accountIpc').registerAccountIpc({
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, safeStorage,
    accountRoot: root, app: {}, net: {},
    dialog: { showSaveDialog: async () => ({ filePath: file }), showOpenDialog: async () => ({ filePaths: [file] }) }
  });
  assert.equal(typeof handlers.get('export-local-account'), 'function');
  const exported = await handlers.get('export-local-account')({}, 'a');
  assert.equal(exported.success, true);
  assert.equal(exported.token, undefined);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).token, token);
  assert.equal((await handlers.get('import-local-account-file')({})).success, true);
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'accounts.json')));
  assert.equal(registry.current_account_id, 'a');
  assert.equal(registry.accounts.length, 1);
  const stored = JSON.parse(fs.readFileSync(path.join(root, 'accounts/a.json')));
  assert.equal(stored.token, undefined);
  assert.equal(stored.token_storage, 'electron-safe-storage-v1');
  assert.deepEqual(JSON.parse(safeStorage.decryptString(Buffer.from(stored.token_encrypted, 'base64'))), token);
  assert.equal((await handlers.get('export-local-account')({}, '../escape')).success, false);
  assert.equal((await handlers.get('export-local-account')({}, 'a')).success, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).token, token);
  fs.writeFileSync(file, JSON.stringify({ email: 'bad@example.test', token: {} }));
  assert.equal((await handlers.get('import-local-account-file')({})).success, false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'accounts.json'))), registry);
});
