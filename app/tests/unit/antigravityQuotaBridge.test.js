const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { discoverRuntime, isLoopbackUrl, parseAppConfig, fetchLiveQuotaSummary, clearQuotaBridgeCache } = require('../../antigravityQuotaBridge');

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

test('language-service quota cache isolates accounts and retries transient startup failures', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-quota-retry-'));
  t.after(() => { clearQuotaBridgeCache(); fs.rmSync(root, { recursive: true, force: true }); });
  const portFile = path.join(root, 'DevToolsActivePort');
  fs.writeFileSync(portFile, '9222\n');
  clearQuotaBridgeCache();
  let reads = 0;
  const options = {
    portFile, cacheKey: 'account-A', timeoutMs: 500, maxAttempts: 2,
    requestText: async () => '<script>window.__APP_CONFIG__ = {"csrfToken":"local","appVersion":"2.26.0"};</script>',
    requestJson: async url => {
      if (url.endsWith('/json/list')) return [{ type: 'page', url: 'https://127.0.0.1:33123/' }];
      reads++;
      if (reads === 1) throw new Error('service not ready');
      return { groups: [{ buckets: [{ bucketId: 'gemini-argon-wtu-weekly', remainingFraction: 0.5 }] }] };
    }
  };
  assert.equal((await fetchLiveQuotaSummary(options)).summary.groups[0].buckets[0].remainingFraction, 0.5);
  assert.equal(reads, 2);
  await fetchLiveQuotaSummary(options);
  assert.equal(reads, 2, 'same active account reuses short cache');
  await fetchLiveQuotaSummary({ ...options, cacheKey: 'account-B' });
  assert.equal(reads, 3, 'different account never reads another cache key');
  clearQuotaBridgeCache();
  await fetchLiveQuotaSummary(options);
  assert.equal(reads, 4, 'switch invalidates cached quota');
});
