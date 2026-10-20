const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyAccountError } = require('../src/accountErrorClassifier');

test('invalid_grant becomes a reauthorization instruction without raw JSON', () => {
  const result = classifyAccountError(new Error('令牌获取失败: {"error":"invalid_grant","error_description":"Bad Request"}'));
  assert.equal(result.code, 'ACCOUNT_REAUTH_REQUIRED');
  assert.equal(result.action, 'reauthorize');
  assert.match(result.message, /Google/);
  assert.doesNotMatch(result.message, /invalid_grant|Bad Request/);
});

test('temporary quota and network errors remain retryable', () => {
  assert.equal(classifyAccountError(new Error('Quota response is incomplete')).code, 'ACCOUNT_QUOTA_UNAVAILABLE');
  assert.equal(classifyAccountError(new Error('fetch failed ECONNRESET')).code, 'ACCOUNT_NETWORK_ERROR');
});

test('Google OAuth error payloads are recognized even when nested in an HTTP error message', () => {
  const result = classifyAccountError(new Error(
    '令牌获取失败: {"error":"invalid_grant","error_description":"Token has been expired or revoked."}'
  ));

  assert.deepEqual(
    { code: result.code, action: result.action, retryable: result.retryable },
    { code: 'ACCOUNT_REAUTH_REQUIRED', action: 'reauthorize', retryable: false }
  );
  assert.equal(result.actionLabel, '重新登录授权');
  assert.doesNotMatch(`${result.title}${result.message}${result.advice}`, /invalid_grant|expired or revoked/i);
});
