const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchAccountQuota, parseQuotaSummary } = require('../../accountQuota');
const { registerAccountIpc } = require('../../accountIpc');

const fields = ['gemini5h', 'geminiWeekly', 'claude5h', 'claudeWeekly'];
function summary(fraction = 0.73) {
  return { groups: [{ buckets: ['gemini-5h', 'gemini-weekly', '3p-5h', '3p-weekly'].map(bucketId => ({
    bucketId, remainingFraction: fraction, resetTime: '2026-10-17T00:00:00Z'
  })) }] };
}
const response = (data, status = 200) => ({ ok: status === 200, status, json: async () => data });

test('quota lookup resolves each account project before accepting HTTP 200 from summary', async () => {
  const requests = [];
  for (const account of ['first', 'second']) {
    const result = await fetchAccountQuota({ accessToken: account, projectId: 'stale-project', fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, body, bearer: options.headers.Authorization });
      if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: { id: `${account}-project` } });
      assert.equal(body.project, `${account}-project`);
      return response(summary(account === 'first' ? 0.73 : 0));
    } });
    assert.equal(result.partial, false);
    for (const field of fields) assert.equal(result.quota[field], account === 'first' ? '73%' : '0%');
  }
  assert.equal(requests.length, 12);
  assert.ok(requests.every(request => request.body.project !== 'gemini_virtual_primary'));
});

test('incomplete HTTP 200 summary retries the other host with the discovered project', async () => {
  const requests = [];
  const result = await fetchAccountQuota({ accessToken: 'test', fetch: async (url, options) => {
    requests.push(url);
    if (url.endsWith(':loadCodeAssist')) return response({ cloudaicompanionProject: 'real-project' });
    assert.equal(JSON.parse(options.body).project, 'real-project');
    const data = summary();
    if (url.includes('daily-cloudcode')) data.groups[0].buckets = data.groups[0].buckets.slice(2);
    return response(data);
  } });
  assert.equal(result.partial, false);
  assert.equal(result.quotaSourceHost, 'cloudcode-pa.googleapis.com');
  assert.equal(requests.length, 6);
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

test('official Antigravity user agent preserves Gemini weekly quota and Argon remains optional', async () => {
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
  assert.ok(seenAgents.every(value => value === 'antigravity/2.26.0'));
  assert.equal(result.quota.argonWeekly, '42%');
  assert.deepEqual(result.capabilities, { argon: true });
  assert.equal(result.partial, false);
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
