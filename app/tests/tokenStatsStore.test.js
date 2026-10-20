const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { TokenStatsStore } = require('../src/tokenStatsStore');

function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-token-store-'));
  return {
    root,
    snapshotPath: path.join(root, 'token_stats.json'),
    journalPath: path.join(root, 'token-events.jsonl'),
    store: new TokenStatsStore({
      snapshotPath: path.join(root, 'token_stats.json'),
      journalPath: path.join(root, 'token-events.jsonl'),
      flushDelayMs: 60_000,
      ...options
    })
  };
}

test('migrates the existing token_stats snapshot and appends new records without rereading it', () => {
  const env = fixture();
  fs.writeFileSync(env.snapshotPath, JSON.stringify({ logs: [{ id: 'old', time: '2026-07-25T00:00:00Z', input: 1 }] }));
  const stats = env.store.record({ id: 'new', time: '2026-07-26T00:00:00Z', input: 2, output: 3 });
  assert.deepEqual(stats.logs.map(item => item.id), ['new', 'old']);
  assert.match(fs.readFileSync(env.journalPath, 'utf8'), /"id":"new"/);
});

test('recovers journal records after an interrupted snapshot flush and deduplicates them', () => {
  const env = fixture();
  fs.writeFileSync(env.snapshotPath, JSON.stringify({ logs: [{ id: 'one', time: '2026-07-26T00:00:00Z' }] }));
  fs.writeFileSync(env.journalPath, `${JSON.stringify({ id: 'two', time: '2026-07-26T01:00:00Z' })}\n${JSON.stringify({ id: 'one', time: '2026-07-26T00:00:00Z' })}\n`);
  assert.deepEqual(env.store.getStats().logs.map(item => item.id), ['two', 'one']);
});

test('keeps a bounded detail history and compacts the journal atomically', () => {
  const env = fixture({ maxRecords: 50 });
  for (let index = 0; index < 70; index += 1) {
    env.store.record({ id: String(index), time: new Date(1_700_000_000_000 + index).toISOString(), input: index });
  }
  env.store.flush();
  const snapshot = JSON.parse(fs.readFileSync(env.snapshotPath, 'utf8'));
  assert.equal(snapshot.logs.length, 50);
  assert.equal(fs.readFileSync(env.journalPath, 'utf8'), '');
});
