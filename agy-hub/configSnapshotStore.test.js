const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ConfigSnapshotStore } = require('./configSnapshotStore.js');

test('creates, lists and restores an atomic local configuration snapshot', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-snapshot-'));
  fs.writeFileSync(path.join(dir, 'codex-gateway.json'), JSON.stringify({ port: 8046 }));
  const store = new ConfigSnapshotStore(dir);
  const snapshot = store.create('before change');
  fs.writeFileSync(path.join(dir, 'codex-gateway.json'), JSON.stringify({ port: 9000 }));
  assert.equal(store.list()[0].id, snapshot.id);
  assert.equal(store.restore(snapshot.id).requiresRestart, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'codex-gateway.json'))).port, 8046);
  fs.rmSync(dir, { recursive: true, force: true });
});
