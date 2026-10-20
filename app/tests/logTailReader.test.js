const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LogTailReader, detectLatestRouteState } = require('../src/logTailReader');

test('reads only the configured tail of a large log and reuses unchanged content', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-log-tail-'));
  const file = path.join(dir, 'main.log');
  fs.writeFileSync(file, `${'x'.repeat(1024 * 1024)}\n[Token Monitor] Routing model traffic through http://127.0.0.1:31000\n`);
  const reader = new LogTailReader({ maxBytes: 64 * 1024, cacheTtlMs: 5000 });

  const first = await reader.read(file);
  const second = await reader.read(file);

  assert.ok(first.bytesRead <= 64 * 1024);
  assert.equal(first.size > first.bytesRead, true);
  assert.equal(second.cached, true);
  assert.equal(detectLatestRouteState(first.text), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('route detection uses the newest routing marker', () => {
  assert.equal(detectLatestRouteState('[Token Monitor] Routing model traffic through\n[Token Monitor] AGY Hub is unavailable'), false);
  assert.equal(detectLatestRouteState('[Token Monitor] AGY Hub is unavailable\n[Token Monitor] Routing model traffic through'), true);
});
