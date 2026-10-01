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
