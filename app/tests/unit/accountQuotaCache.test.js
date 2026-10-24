const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { quotaCachePath, readCachedQuota, writeCachedQuota } = require('../../accountQuotaCache');

test('quota cache is shared per account without persisting OAuth secrets', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-quota-cache-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const result = {
    success: true,
    quota: { geminiWeekly: '57%' },
    access_token: 'must-not-persist',
    nested: { authorization: 'Bearer secret', safe: 'kept' }
  };
  assert.equal(writeCachedQuota({ accountRoot: root, accountId: 'account_1', refreshToken: 'refresh-secret', result, now: 1234 }), true);
  const text = fs.readFileSync(quotaCachePath(root, 'account_1'), 'utf8');
  assert.doesNotMatch(text, /refresh-secret|must-not-persist|Bearer secret/);
  const cached = readCachedQuota({ accountRoot: root, accountId: 'account_1', refreshToken: 'refresh-secret' });
  assert.equal(cached.quota.geminiWeekly, '57%');
  assert.equal(cached.nested.safe, 'kept');
  assert.equal(cached.fromCache, true);
  assert.equal(cached.cachedAt, 1234);
});

test('quota cache cannot leak across accounts or refreshed credentials', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-quota-scope-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeCachedQuota({ accountRoot: root, accountId: 'first', refreshToken: 'token-a', result: { success: true, quota: { geminiWeekly: '91%' } } });
  assert.equal(readCachedQuota({ accountRoot: root, accountId: 'first', refreshToken: 'token-b' }), null);
  assert.equal(readCachedQuota({ accountRoot: root, accountId: 'second', refreshToken: 'token-a' }), null);
});
