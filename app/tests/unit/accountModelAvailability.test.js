const test = require('node:test');
const assert = require('node:assert/strict');
const {
  setModelsForAccount,
  modelsForAccount,
  clearModelsForAccount,
  gatewayModelsForAccount
} = require('../../accountModelAvailability');

test('fresh Cloud Code model metadata augments the same account Language Server catalog', () => {
  const accountId = `availability-test-${Date.now()}`;
  try {
    setModelsForAccount(accountId, ['gemini-3.8-flash-high', 'claude-opus-4-6-thinking'], 'local-language-server');
    const merged = setModelsForAccount(accountId, [
      'gemini-4-argon-medium',
      'claude-opus-5-5-medium',
      'claude-sonnet-5-5-medium',
      'gemini-3.8-flash-high'
    ], 'oauth-cloud');
    assert.equal(merged.source, 'oauth-cloud+local-language-server');
    assert.ok(merged.modelIds.includes('gemini-4-argon-medium'));
    assert.ok(merged.modelIds.includes('claude-opus-5-5-medium'));
    assert.ok(merged.modelIds.includes('claude-sonnet-5-5-medium'));
    assert.ok(merged.modelIds.includes('gemini-3.8-flash-high'));
    assert.deepEqual(modelsForAccount(accountId).modelIds, merged.modelIds);
  } finally {
    clearModelsForAccount(accountId);
  }
});

test('account-scoped gateway model list does not leak another account cached models', () => {
  const accountId = `availability-isolation-${Date.now()}`;
  try {
    setModelsForAccount(accountId, ['claude-opus-5-5-medium'], 'oauth-cloud');
    assert.deepEqual(gatewayModelsForAccount(accountId, ['gemini-3.8-flash-high'], ['fallback-model']), [
      'agy-auto', 'claude-opus-5-5-medium'
    ]);
  } finally {
    clearModelsForAccount(accountId);
  }
});
