const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchAccountQuota, parseQuotaSummary } = require('../../accountQuota');
const { registerAccountIpc } = require('../../accountIpc');
const asar = require('@electron/asar');

const fields = ['gemini5h', 'geminiWeekly', 'claude5h', 'claudeWeekly'];
function summary(fraction = 0.73) {
  return { groups: [{ buckets: ['gemini-5h', 'gemini-weekly', '3p-5h', '3p-weekly'].map(bucketId => ({
    bucketId, remainingFraction: fraction, resetTime: '2026-10-17T00:00:00Z'
  })) }] };
}
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });

test('quota lookup obeys one overall deadline instead of stacking endpoint timeouts', async () => {
  const startedAt = Date.now();
  const abortingFetch = (_url, options = {}) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason || new Error('timeout')), { once: true });
  });
  const result = await fetchAccountQuota({
    fetch: abortingFetch,
    accessToken: 'mock',
    timeoutMs: 90,
    requestTimeoutMs: 35,
    supplementalQuotaSummary: summary(1)
  });
  assert.equal(result.success, true);
  assert.ok(Date.now() - startedAt < 350, 'overall deadline should not stack 15-second endpoint waits');
});

test('cloud CLI quota lookup uses empty bodies and retrieves account-scoped model metadata', async () => {
  const requests = [];
  for (const account of ['first', 'second']) {
    const result = await fetchAccountQuota({ accessToken: account, projectId: 'stale-project', fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, body, bearer: options.headers.Authorization });
      if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: { id: `${account}-project` } });
      assert.deepEqual(body, {});
      if (url.endsWith(':retrieveUserQuota')) return response({ models: {
        'gemini-4-argon-medium': { quotaInfo: { remainingFraction: account === 'first' ? 0.73 : 0 } },
        'claude-opus-5-5-medium': {}
      } });
      if (url.endsWith(':fetchAvailableModels')) return response({ models: {
        'gemini-4-argon-medium': {}, 'claude-opus-5-5-medium': {}, 'gemini-3.8-flash-high': {}
      } });
      return response(summary(account === 'first' ? 0.73 : 0));
    } });
    assert.equal(result.partial, false);
    for (const field of fields) assert.equal(result.quota[field], account === 'first' ? '73%' : '0%');
  }
  assert.equal(requests.length, 16);
  assert.ok(requests.filter(request => !request.url.endsWith(':loadCodeAssist')).every(request => Object.keys(request.body).length === 0));
});

test('incomplete HTTP 200 summary retries the other host with the discovered project', async () => {
  const requests = [];
  const result = await fetchAccountQuota({ accessToken: 'test', fetch: async (url, options) => {
    requests.push(url);
    if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'real-project' });
    assert.deepEqual(JSON.parse(options.body), {});
    if (url.endsWith(':retrieveUserQuota')) return response({ models: { 'gemini-4-argon-medium': { quotaInfo: { remainingFraction: 0.6 } } } });
    if (url.endsWith(':fetchAvailableModels')) return response({ models: { 'gemini-3.8-flash-high': {}, 'claude-sonnet-5-5-medium': {} } });
    const data = summary();
    if (url.includes('daily-cloudcode')) data.groups[0].buckets = data.groups[0].buckets.slice(2);
    return response(data);
  } });
  assert.equal(result.partial, false);
  assert.equal(result.quotaSourceHost, 'cloudcode-pa.googleapis.com');
  assert.equal(requests.length, 8);
});

test('model fallback supports 3.8 tiered quota and leaves missing weekly values unknown', async () => {
  const result = await fetchAccountQuota({ accessToken: 'test', projectId: 'saved-project', fetch: async url => {
    if (url.endsWith(':loadCodeAssist')) return response({}, 503);
    if (url.endsWith(':retrieveUserQuotaSummary')) return response({ groups: [] });
    return response({ models: {
      'gemini-3.8-flash-tiered': { quotaInfo: { remainingFraction: 0, resetTime: '2026-10-17T00:00:00Z' } },
      'claude-sonnet-4-6': { quotaInfo: { remainingFraction: 0.5 } }
    } });
  } });
  assert.equal(result.partial, true);
  assert.equal(result.quota.gemini5h, '0%');
  assert.equal(result.quota.claude5h, '50%');
  assert.equal(result.quota.geminiWeekly, '--');
  assert.equal(result.quota.claudeWeekly, '--');
  assert.deepEqual(result.missingQuotaFields, ['geminiWeekly', 'claudeWeekly']);
  assert.deepEqual(result.confirmedMissingQuotaFields, ['geminiWeekly', 'claudeWeekly']);
  assert.deepEqual(result.unconfirmedQuotaFields, []);
});

test('missing quota stays unconfirmed when a required host has not answered', async () => {
  const result = await fetchAccountQuota({ accessToken: 'test', projectId: 'saved-project', fetch: async url => {
    if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'real-project' });
    if (url.includes('cloudcode-pa.googleapis.com') && !url.includes('daily-cloudcode')) throw new Error('secondary unavailable');
    if (url.endsWith(':retrieveUserQuotaSummary')) return response({ groups: [{ buckets: [{
      bucketId: '3p-weekly', remainingFraction: 0.8
    }] }] });
    return response({ models: {
      'gemini-3.8-flash-tiered': { quotaInfo: { remainingFraction: 0.6 } }
    } });
  } });
  assert.equal(result.quota.gemini5h, '60%');
  assert.equal(result.quota.geminiWeekly, '--');
  assert.ok(result.unconfirmedQuotaFields.includes('geminiWeekly'));
  assert.ok(!result.confirmedMissingQuotaFields.includes('geminiWeekly'));
});

test('quota discovery runs independent host and endpoint requests concurrently', async () => {
  let active = 0;
  let maximumActive = 0;
  const result = await fetchAccountQuota({ accessToken: 'test', fetch: async url => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise(resolve => setTimeout(resolve, 15));
    active -= 1;
    if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'real-project' });
    if (url.endsWith(':retrieveUserQuotaSummary')) return response({ groups: [{ buckets: [
      { bucketId: '3p-5h', remainingFraction: 1 },
      { bucketId: '3p-weekly', remainingFraction: 1 }
    ] }] });
    return response({ models: {
      'gemini-3.8-flash-tiered': { quotaInfo: { remainingFraction: 0.9 } }
    } });
  } });
  assert.equal(result.quota.gemini5h, '90%');
  assert.ok(maximumActive >= 4, `expected at least four concurrent requests, got ${maximumActive}`);
});

test('absent or invalid remainingFraction is never fabricated as 100 percent', () => {
  assert.deepEqual(parseQuotaSummary({ groups: [{ buckets: [
    { bucketId: 'gemini-5h' }, { bucketId: 'gemini-weekly', remainingFraction: null },
    { bucketId: '3p-5h', remainingFraction: '1' }, { bucketId: '3p-weekly', remainingFraction: NaN }
  ] }] }), {});
});

test('local Argon snapshot is not presented as a live cloud quota when Cloud Code cannot confirm it', async () => {
  const seenAgents = [];
  const result = await fetchAccountQuota({
    accessToken: 'test',
    clientVersion: '2.26.0',
    supplementalQuotaSummary: { groups: [{ buckets: [{ bucketId: 'gemini-argon-wtu-weekly', remainingFraction: 0.42 }] }] },
    fetch: async (url, options) => {
      seenAgents.push(options.headers['User-Agent']);
      if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'real-project' });
      return response(summary());
    }
  });
  assert.ok(seenAgents.includes('antigravity/2.26.0'));
  assert.ok(seenAgents.some(value => value.startsWith('antigravity/cli/1.4.5 ')));
  assert.equal(result.quota.argonWeekly, undefined);
  assert.deepEqual(result.capabilities, { argon: false });
  assert.equal(result.argonCapabilityStatus, 'unconfirmed');
  assert.equal(result.partial, false);
});

test('current-account local quota survives cloud outage without inventing values', async () => {
  const local = { groups: [{ buckets: [
    { bucketId: 'gemini-5h', remainingFraction: 0.61 },
    { bucketId: 'gemini-weekly', remainingFraction: 0.82 },
    { bucketId: '3p-5h', remainingFraction: 0 },
    { bucketId: '3p-weekly', remainingFraction: 0.9 },
    { bucketId: 'gemini-argon-wtu-weekly', remainingFraction: 0.43 }
  ] }] };
  const result = await fetchAccountQuota({
    accessToken: 'mock-only', supplementalQuotaSummary: local,
    fetch: async url => url.endsWith(':loadCodeAssist')
      ? response({ cloudaicompanionProject: 'real-project' })
      : response({}, 503)
  });
  assert.equal(result.success, true);
  assert.equal(result.quotaSource, 'local-language-service');
  assert.deepEqual([result.quota.gemini5h, result.quota.geminiWeekly, result.quota.claude5h, result.quota.claudeWeekly, result.quota.argonWeekly],
    ['61%', '82%', '0%', '90%', undefined]);
  assert.equal(result.argonCapabilityStatus, 'unconfirmed');
  assert.deepEqual(result.missingQuotaFields, []);
});

test('inactive-account Argon is shown only with scoped evidence, never by another accounts local quota', async () => {
  const result = await fetchAccountQuota({ accessToken: 'inactive-only', fetch: async url => {
    if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'inactive-project' });
    if (url.endsWith(':fetchAvailableModels')) return response({ models: {
      'gemini-4-argon-medium': { displayName: 'Gemini 4 Argon Medium' }
    } });
    return response(summary(0.6));
  } });
  assert.equal(result.capabilities.argon, true);
  assert.equal(result.argonCapabilityStatus, 'available');
  assert.equal(result.quota.argonWeekly, undefined);
});

test('Argon absence is confirmed only when all three CLI endpoints answer on both hosts', async () => {
  const fetch = async url => {
    if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'real-project' });
    if (url.endsWith(':retrieveUserQuotaSummary')) return response(summary());
    return response({ models: { 'gemini-3.8-flash-high': {}, 'claude-sonnet-4-6': {} } });
  };
  const remote = await fetchAccountQuota({ accessToken: 'mock', fetch });
  assert.equal(remote.capabilities.argon, false);
  assert.equal(remote.argonCapabilityStatus, 'unavailable');
  const local = await fetchAccountQuota({ accessToken: 'mock', fetch, supplementalQuotaSummary: summary() });
  assert.equal(local.capabilities.argon, false);
  assert.equal(local.argonCapabilityStatus, 'unavailable');
});

test('OAuth-scoped Argon bucket is recognized for inactive accounts', async () => {
  const result = await fetchAccountQuota({ accessToken: 'mock', fetch: async url => {
    if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'p' });
    const data = summary();
    if (url.endsWith(':retrieveUserQuotaSummary')) data.groups[0].buckets.push({ bucketId: 'gemini-argon-wtu-weekly', remainingFraction: 0.12 });
    return response(data);
  } });
  assert.equal(result.quota.argonWeekly, '12%');
  assert.equal(result.capabilities.argon, true);
});

test('hub quota IPC queries non-current accounts without writing the registry or credentials', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-quota-isolation-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, '.gemini/antigravity/tools');
  fs.mkdirSync(path.join(root, 'accounts'), { recursive: true });
  const registry = path.join(root, 'accounts.json');
  fs.writeFileSync(registry, JSON.stringify({ current_account_id: 'first', accounts: [{ id: 'first' }, { id: 'second' }] }));
  for (const id of ['first', 'second']) fs.writeFileSync(path.join(root, 'accounts', `${id}.json`), JSON.stringify({ token: { refresh_token: id } }));
  const files = [registry, ...['first', 'second'].map(id => path.join(root, 'accounts', `${id}.json`))];
  const before = files.map(file => fs.readFileSync(file, 'utf8'));
  const handlers = new Map();
  registerAccountIpc({ app: { getPath: () => home }, safeStorage: {}, getMainWindow: () => null,
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, net: { fetch: async (url, options) => {
      if (url.includes('oauth2.googleapis.com')) return response({ access_token: new URLSearchParams(options.body).get('refresh_token') });
      const id = options.headers.Authorization.slice(7);
      if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: `${id}-project` });
      assert.equal(JSON.parse(options.body).project, `${id}-project`);
      return response(summary(id === 'first' ? 0.73 : 0.28));
    } }
  });
  const first = await handlers.get('fetch-account-quota')(null, 'first');
  const second = await handlers.get('fetch-account-quota')(null, 'second');
  assert.equal(first.quota.geminiWeekly, '73%');
  assert.equal(second.quota.geminiWeekly, '28%');
  assert.deepEqual(files.map(file => fs.readFileSync(file, 'utf8')), before);
});

test('shipped Antigravity preload isolates quota cache without periodic cloud polling', () => {
  const preload = asar.extractFile(path.join(__dirname, '../../assets/app.asar'), 'dist/preload.js').toString('utf8');
  assert.match(preload, /function setAgyCurrentQuotaAccount\(accountId\)/);
  assert.match(preload, /function refreshAgyActiveQuota\(\)/);
  assert.match(preload, /window\.antigravityCurrentAccount !== id/);
  assert.match(preload, /_checked_at/);
  assert.doesNotMatch(preload, /setInterval\(refreshAgyActiveQuota/);
  assert.match(preload, /fetch-account-quota', \{ accountId: acc\.id, force: Boolean\(forceQuota\) \}/);
  assert.match(preload, /Gemini 4 Argon 每周额度/);
});

test('hub quota IPC reuses shared account cache unless refresh is explicitly forced', async t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-quota-cache-ipc-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const root = path.join(home, '.gemini/antigravity/tools');
  fs.mkdirSync(path.join(root, 'accounts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'accounts.json'), JSON.stringify({ current_account_id: 'other', accounts: [{ id: 'cached' }] }));
  fs.writeFileSync(path.join(root, 'accounts', 'cached.json'), JSON.stringify({ token: { refresh_token: 'refresh-cached' } }));
  const handlers = new Map();
  let networkCalls = 0;
  registerAccountIpc({
    app: { getPath: () => home }, safeStorage: {}, getMainWindow: () => null,
    ipcMain: { handle: (name, fn) => handlers.set(name, fn) },
    net: { fetch: async (url, options) => {
      networkCalls += 1;
      if (url.includes('oauth2.googleapis.com')) return response({ access_token: 'cached-access' });
      if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'cached-project' });
      return response(summary(0.64));
    } }
  });
  const handler = handlers.get('fetch-account-quota');
  const first = await handler(null, 'cached');
  const callsAfterFirst = networkCalls;
  const second = await handler(null, { accountId: 'cached' });
  assert.equal(second.fromCache, true);
  assert.equal(second.quota.geminiWeekly, first.quota.geminiWeekly);
  assert.equal(networkCalls, callsAfterFirst);
  const forced = await handler(null, { accountId: 'cached', force: true });
  assert.equal(forced.fromCache, false);
  assert.ok(networkCalls > callsAfterFirst);
});
