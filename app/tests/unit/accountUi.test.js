const test = require('node:test');
const assert = require('node:assert/strict');
const { failureCopy } = require('../../accountUi');
const {
  quotaFieldState,
  quotaPercent,
  calculateQuotaScore,
  quotaSectionsForResult,
  withQuotaUiDeadline
} = require('../../localAccountsController');

test('quota UI deadline always releases a refresh that never settles', async () => {
  let fireTimeout = null;
  let cleared = false;
  const resultPromise = withQuotaUiDeadline(new Promise(() => {}), 9000, {
    setTimeout: callback => { fireTimeout = callback; return 7; },
    clearTimeout: id => { if (id === 7) cleared = true; }
  });
  fireTimeout();
  const result = await resultPromise;
  assert.equal(result.code, 'QUOTA_REFRESH_TIMEOUT');
  assert.equal(result.retryable, true);
  assert.equal(cleared, true);
});

test('account failure copy exposes a clear reauthorization action', () => {
  const copy = failureCopy({
    title: '账号授权已失效', message: '需要登录', advice: '重新授权',
    action: 'reauthorize', actionLabel: '重新登录授权'
  });
  assert.equal(copy.requiresReauth, true);
  assert.equal(copy.actionLabel, '重新登录授权');
});

test('confirmed absent quotas are hidden only after evidence is complete', () => {
  const result = {
    quota: { claude5h: '100%', claudeWeekly: '80%', gemini5h: '71%', geminiWeekly: '--' },
    missingQuotaFields: ['geminiWeekly'],
    confirmedMissingQuotaFields: ['geminiWeekly'],
    unconfirmedQuotaFields: []
  };
  assert.equal(quotaFieldState(result, 'geminiWeekly'), 'missing');
  assert.equal(quotaPercent(result, 'geminiWeekly'), null);
  assert.deepEqual(quotaSectionsForResult(result).find(section => section.title === 'Gemini').fields.map(item => item.field), ['gemini5h']);
});

test('unconfirmed quotas remain visible and available short quota still drives recommendations', () => {
  const result = {
    quota: { claude5h: '100%', claudeWeekly: '80%', gemini5h: '71%', geminiWeekly: '--' },
    missingQuotaFields: ['geminiWeekly'],
    confirmedMissingQuotaFields: [],
    unconfirmedQuotaFields: ['geminiWeekly']
  };
  assert.equal(quotaFieldState(result, 'geminiWeekly'), 'unconfirmed');
  assert.deepEqual(quotaSectionsForResult(result).find(section => section.title === 'Gemini').fields.map(item => item.state), ['available', 'unconfirmed']);
  assert.equal(calculateQuotaScore(null, quotaPercent(result, 'gemini5h')), 71);
});

test('Argon appears as a distinct card only when this account has positive capability evidence', () => {
  const base = { quota: { gemini5h: '100%', claudeWeekly: '90%' }, capabilities: { argon: false } };
  assert.equal(quotaSectionsForResult(base).some(section => section.title === 'Gemini 4 Argon'), false);
  const visible = quotaSectionsForResult({ ...base, capabilities: { argon: true } });
  assert.equal(visible.find(section => section.title === 'Gemini 4 Argon').fields[0].state, 'unconfirmed');
  const verified = quotaSectionsForResult({ ...base, capabilities: { argon: true }, quota: { ...base.quota, argonWeekly: '37%' } });
  assert.equal(verified.find(section => section.title === 'Gemini 4 Argon').fields[0].state, 'available');
});
