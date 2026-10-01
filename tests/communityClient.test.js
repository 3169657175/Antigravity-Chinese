const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CommunityClient, classifyCommunityError } = require('../src/communityClient');
const { allowedCommunityPath } = require('../src/communityIpc');

test('community errors are converted to readable authentication and retry states', () => {
  assert.equal(classifyCommunityError(401, {}).code, 'AUTH_EXPIRED');
  assert.equal(classifyCommunityError(429, {}).retryable, true);
  assert.equal(classifyCommunityError(503, {}).message, '社区服务暂时不可用，请稍后重试');
});

test('generic renderer bridge only permits known community endpoints', () => {
  assert.equal(allowedCommunityPath('/api/announcement?all=true'), true);
  assert.equal(allowedCommunityPath('https://nhw1029.pages.dev/api/reply/like'), true);
  assert.equal(allowedCommunityPath('file:///C:/Windows/win.ini'), false);
  assert.equal(allowedCommunityPath('https://evil.example/api/announcement'), false);
});

test('auth session is written atomically and authorization is owned by the main client', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-community-'));
  const calls = [];
  const client = new CommunityClient({
    authFilePath: path.join(dir, 'auth.json'),
    fetch: async (_url, options) => {
      calls.push(options);
      return new Response(JSON.stringify({ success: true, token: 'secret', username: 'niu', role: 'user' }), { status: 200 });
    }
  });
  const result = await client.login('niu', 'password');
  assert.equal(result.success, true);
  await client.request('/api/announcement');
  assert.equal(calls[1].headers.Authorization, 'Bearer secret');
  fs.rmSync(dir, { recursive: true, force: true });
});


test('read-only requests fall back to a secondary HTTPS origin and cache the last success', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-community-fallback-'));
  const calls = [];
  let failAll = false;
  const client = new CommunityClient({
    authFilePath: path.join(dir, 'auth.json'),
    cacheFilePath: path.join(dir, 'cache.json'),
    apiBase: 'https://primary.example/api',
    fallbackApiBase: 'https://backup.example/api',
    fetch: async url => {
      calls.push(url);
      if (failAll) throw new Error('offline');
      if (url.startsWith('https://primary.example/')) return new Response(JSON.stringify({ error: 'down' }), { status: 503 });
      return new Response(JSON.stringify([{ id: 1, content: 'cached' }]), { status: 200 });
    }
  });
  const first = await client.request('/api/feedback?sort=newest', { cacheKey: 'feedback:newest' });
  assert.equal(first.success, true);
  assert.equal(first.endpoint, 'https://backup.example');
  assert.equal(calls.length, 2);
  failAll = true;
  const cached = await client.request('/api/feedback?sort=newest', { cacheKey: 'feedback:newest' });
  assert.equal(cached.success, true);
  assert.equal(cached.stale, true);
  assert.deepEqual(cached.data, [{ id: 1, content: 'cached' }]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('write requests are never replayed against the fallback origin', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-community-write-'));
  const calls = [];
  const client = new CommunityClient({
    authFilePath: path.join(dir, 'auth.json'),
    apiBase: 'https://primary.example/api',
    fallbackApiBase: 'https://backup.example/api',
    fetch: async url => { calls.push(url); throw new Error('offline'); }
  });
  const result = await client.request('/api/reply', { method: 'POST', body: { feedback_id: 1, content: 'x' } });
  assert.equal(result.success, false);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^https:\/\/primary\.example\//);
  fs.rmSync(dir, { recursive: true, force: true });
});
