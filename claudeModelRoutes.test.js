const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CLAUDE_MODEL_ROUTES,
  claudeRoutesForModels,
  routeForClaudeModel,
  modelForClaudeRoute,
  claudePickerModels
} = require('./claudeModelRoutes');

test('Claude picker routes display real models but send Anthropic-compatible aliases', () => {
  const picker = claudePickerModels('gemini-3.6-flash-high');
  assert.equal(picker.length, CLAUDE_MODEL_ROUTES.length);
  assert.equal(picker[0].labelOverride, 'Gemini 3.6 Flash (High)');
  assert.equal(picker[0].name, 'claude-haiku-4-5-agy-36fh');
  assert.equal(picker[0].isFamilyDefault, true);
  for (const entry of picker) {
    assert.match(entry.name, /^claude-(?:haiku|sonnet|opus)-/);
    assert.doesNotMatch(entry.name, /gemini|gpt-oss/);
  }
});

test('Claude route aliases resolve back to the real Antigravity model', () => {
  assert.equal(routeForClaudeModel('gemini-3.1-pro-high'), 'claude-sonnet-4-5-agy-31ph');
  assert.equal(modelForClaudeRoute('claude-sonnet-4-5-agy-31ph'), 'gemini-3.1-pro-high');
  assert.equal(modelForClaudeRoute('claude-opus-4-6'), 'claude-opus-4-6-thinking');
  assert.equal(modelForClaudeRoute('unknown', 'gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite');
});


test('Claude picker follows the live Antigravity catalog and generates a safe route for new models', () => {
  const live = ['agy-auto', 'gemini-3.6-flash-high', 'gemini-4-new-agent'];
  const routes = claudeRoutesForModels(live);
  assert.equal(routes.some(entry => entry.model === 'claude-opus-4-6-thinking'), false);
  const dynamic = routes.find(entry => entry.model === 'gemini-4-new-agent');
  assert.ok(dynamic);
  assert.match(dynamic.route, /^claude-sonnet-4-5-agy-[a-f0-9]{10}$/);
  assert.equal(modelForClaudeRoute(dynamic.route, 'claude-sonnet-4-6', live), 'gemini-4-new-agent');
  const picker = claudePickerModels('gemini-4-new-agent', live);
  assert.equal(picker[0].name, dynamic.route);
  assert.equal(picker[0].isFamilyDefault, true);
});
