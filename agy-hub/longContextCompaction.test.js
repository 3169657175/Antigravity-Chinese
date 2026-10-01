const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const {
  buildCodexModelsResponse,
  CUSTOM_PROVIDER_CONTEXT_WINDOW,
  CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT
} = require('./codexModels.js');

test('custom Responses providers advertise enough headroom for native Codex compaction', () => {
  const model = buildCodexModelsResponse(['gpt-5.6-sol'], {
    contextWindow: CUSTOM_PROVIDER_CONTEXT_WINDOW,
    autoCompactPercent: CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT
  }).models[0];
  assert.equal(model.context_window, 300000);
  assert.equal(model.auto_compact_token_limit, 240000);
  assert.ok(model.auto_compact_token_limit < 291749, 'compaction limit must stay below the observed disconnect point');
});

test('all custom-provider connection and model endpoints use the shared context policy', () => {
  const gateway = fs.readFileSync('codexGateway.js', 'utf8');
  const ipc = fs.readFileSync('gatewayIpc.js', 'utf8');
  const config = fs.readFileSync('codexConfig.js', 'utf8');
  for (const source of [gateway, ipc, config]) {
    assert.match(source, /CUSTOM_PROVIDER_CONTEXT_WINDOW/);
    assert.doesNotMatch(source, /contextWindow:\s*400000/);
  }
});
