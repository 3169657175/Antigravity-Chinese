const test = require('node:test');
const assert = require('node:assert/strict');
const { failureCopy } = require('../../accountUi');
const {
  quotaFieldState,
  quotaPercent,
  calculateQuotaScore,
  quotaSectionsForResult,
  withQuotaUiDeadline,
  quotaRequestOptions,
  createCurrentQuotaPoller
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

test('removed historical Argon evidence cannot resurrect a card from an old account cache', () => {
  const stale = {
    quota: { gemini5h: '100%', geminiWeekly: '100%' },
    capabilities: { argon: true },
    argonCapabilityStatus: 'previously-available',
    argonLastKnown: { lastPercent: '9%', checkedAt: Date.now() - 3600000 }
  };
  assert.equal(quotaSectionsForResult(stale).some(section => section.title === 'Gemini 4 Argon'), false);
});

test('only the current account selects Language Server quota', () => {
  assert.deepEqual(quotaRequestOptions({ current: true }, true), { force: true, source: 'language-server' });
  assert.deepEqual(quotaRequestOptions({ current: false }, true), { force: true, source: 'cloud' });
});

test('current-account poller schedules serial refreshes and stops off-page', async () => {
  const callbacks = [];
  const cleared = [];
  let timerId = 0;
  let active = true;
  let refreshes = 0;
  const poller = createCurrentQuotaPoller({
    intervalMs: 15000,
    isActive: () => active,
    refresh: async () => { refreshes += 1; },
    setTimeout: callback => { callbacks.push(callback); timerId += 1; return timerId; },
    clearTimeout: id => cleared.push(id)
  });
  poller.start();
  assert.equal(callbacks.length, 1);
  await callbacks.shift()();
  assert.equal(refreshes, 1);
  assert.equal(callbacks.length, 1, 'successful tick schedules exactly one next refresh');
  active = false;
  await callbacks.shift()();
  assert.equal(refreshes, 1, 'hidden page performs no quota read');
  assert.equal(callbacks.length, 0, 'hidden page does not keep a polling timer alive');
  active = true;
  poller.start();
  assert.equal(callbacks.length, 1);
  poller.stop();
  assert.deepEqual(cleared, [3]);
});
