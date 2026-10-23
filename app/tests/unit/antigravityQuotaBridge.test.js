const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discoverRuntime, isLoopbackUrl, parseAppConfig } = require('../../antigravityQuotaBridge');

test('quota bridge accepts only loopback Antigravity targets and parses runtime config', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-quota-bridge-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const portFile = path.join(root, 'DevToolsActivePort');
  fs.writeFileSync(portFile, '9222\n/devtools/browser/test\n');
  const runtime = await discoverRuntime({
    portFile,
    requestJson: async url => {
      assert.equal(url, 'http://127.0.0.1:9222/json/list');
      return [{ type: 'page', url: 'https://127.0.0.1:33123/' }];
    },
    requestText: async () => '<script>window.__APP_CONFIG__ = {"csrfToken":"safe-token","appVersion":"2.26.0"};</script>'
  });
  assert.deepEqual(runtime, { origin: 'https://127.0.0.1:33123', csrfToken: 'safe-token', appVersion: '2.26.0' });
  assert.equal(isLoopbackUrl('https://example.com'), false);
  assert.equal(parseAppConfig('window.__APP_CONFIG__ = {"csrfToken":"x"};').csrfToken, 'x');
});
