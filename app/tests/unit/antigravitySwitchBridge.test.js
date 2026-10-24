const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  PROTOCOL_VERSION,
  bridgePaths,
  requestNativeAccountSwitch
} = require('../../antigravitySwitchBridge');

test('native account switch bridge accepts only the matching response and removes request files', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-native-switch-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nonce = 'a'.repeat(36);
  const paths = bridgePaths(root);
  let replied = false;
  const result = await requestNativeAccountSwitch({
    accountRoot: root,
    accountId: 'account_2',
    nonce,
    timeoutMs: 1000,
    sleep: async () => {
      if (replied || !fs.existsSync(paths.requestPath)) return;
      const request = JSON.parse(fs.readFileSync(paths.requestPath, 'utf8'));
      assert.equal(request.accountId, 'account_2');
      fs.writeFileSync(paths.responsePath, JSON.stringify({
        protocol: PROTOCOL_VERSION,
        nonce,
        success: true,
        restartScheduled: true
      }));
      replied = true;
    }
  });
  assert.equal(result.nativeBridge, true);
  assert.equal(result.restarted, true);
  assert.equal(fs.existsSync(paths.requestPath), false);
  assert.equal(fs.existsSync(paths.responsePath), false);
});

test('native account switch bridge times out without falling back to an external kill', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-native-timeout-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let clock = 1000;
  await assert.rejects(requestNativeAccountSwitch({
    accountRoot: root,
    accountId: 'account_2',
    nonce: 'b'.repeat(36),
    timeoutMs: 500,
    now: () => clock,
    sleep: async milliseconds => { clock += milliseconds; }
  }), error => error && error.code === 'NATIVE_SWITCH_TIMEOUT');
  assert.equal(fs.existsSync(bridgePaths(root).requestPath), false);
});
