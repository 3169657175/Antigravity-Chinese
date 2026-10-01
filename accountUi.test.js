const test = require('node:test');
const assert = require('node:assert/strict');
const { failureCopy } = require('./accountUi');

test('account failure copy exposes a clear reauthorization action', () => {
  const copy = failureCopy({
    title: '账号授权已失效', message: '需要登录', advice: '重新授权',
    action: 'reauthorize', actionLabel: '重新登录授权'
  });
  assert.equal(copy.requiresReauth, true);
  assert.equal(copy.actionLabel, '重新登录授权');
});
