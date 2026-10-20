const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  normalizeAvailableModels,
  describeAntigravityModels,
  modelDisplayName,
  configureAntigravityModelCatalog,
  captureAntigravityModelCatalog,
  getAntigravityModelCatalog,
  resetAntigravityModelCatalogForTests
} = require('../src/antigravityModelCatalog');

test('normalizes Antigravity fetchAvailableModels into client-facing agent models', () => {
  const result = normalizeAvailableModels({
    models: {
      'gemini-3.8-flash-tiered': {},
      'gemini-3.7-flash-tiered': {},
      'gemini-3.6-flash-tiered': {},
      'gemini-3.5-flash-low': {},
      'gemini-pro-agent': {},
      'claude-sonnet-4-6': {},
      'future-coder': {},
      'gemini-image-generation': {}
    }
  });
  assert.deepEqual(result.models, [
    'gemini-3.8-flash-high',
    'gemini-3.8-flash-medium',
    'gemini-3.8-flash-low',
    'gemini-3.7-flash-high',
    'gemini-3.7-flash-medium',
    'gemini-3.7-flash-low',
    'gemini-3.6-flash-high',
    'gemini-3.6-flash-medium',
    'gemini-3.6-flash-low',
    'gemini-3.1-pro-high',
    'claude-sonnet-4-6'
  ]);
});

test('persists the last live catalog so gateway restarts do not fall back to stale hardcoded models', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-model-catalog-'));
  resetAntigravityModelCatalogForTests();
  configureAntigravityModelCatalog(root);
  const captured = captureAntigravityModelCatalog(JSON.stringify({
    models: {
      'gemini-3.8-flash-high': {},
      'claude-opus-4-6-thinking': {},
      'gemini-3.7-flash-low': {}
    }
  }), { source: 'test', endpoint: '/v1internal:fetchAvailableModels' });
  assert.equal(captured.updated, true);
  assert.deepEqual(captured.models, ['gemini-3.8-flash-high', 'gemini-3.7-flash-low', 'claude-opus-4-6-thinking']);

  resetAntigravityModelCatalogForTests();
  configureAntigravityModelCatalog(root);
  const reloaded = getAntigravityModelCatalog();
  assert.equal(reloaded.live, true);
  assert.deepEqual(reloaded.models, captured.models);
  fs.rmSync(root, { recursive: true, force: true });
  resetAntigravityModelCatalogForTests();
});

test('keeps model order, labels and groups stable when upstream order changes', () => {
  const first = normalizeAvailableModels({
    models: {
      'claude-sonnet-4-6': {},
      'gemini-3.1-pro-low': {},
      'gemini-4-new-agent': {},
      'gemini-3.6-flash-low': {},
      'gemini-3.7-flash-medium': {},
      'claude-opus-4-6-thinking': {},
      'gemini-3.8-flash-high': {}
    }
  });
  const second = normalizeAvailableModels({
    models: {
      'gemini-3.8-flash-high': {},
      'claude-opus-4-6-thinking': {},
      'gemini-3.6-flash-low': {},
      'gemini-4-new-agent': {},
      'gemini-3.7-flash-medium': {},
      'gemini-3.1-pro-low': {},
      'claude-sonnet-4-6': {}
    }
  });

  assert.deepEqual(first.models, second.models);
  assert.deepEqual(first.models, [
    'gemini-3.8-flash-high',
    'gemini-3.7-flash-medium',
    'gemini-3.6-flash-low',
    'gemini-3.1-pro-low',
    'claude-opus-4-6-thinking',
    'claude-sonnet-4-6'
  ]);

  const entries = describeAntigravityModels(['gpt-oss-120b-medium', 'agy-auto', 'claude-sonnet-4-6', 'gemini-3.6-flash-high']);
  assert.deepEqual(entries.map(entry => [entry.id, entry.group]), [
    ['agy-auto', '自动路由'],
    ['gemini-3.6-flash-high', 'Gemini'],
    ['claude-sonnet-4-6', 'Claude'],
    ['gpt-oss-120b-medium', 'GPT-OSS']
  ]);
  assert.equal(modelDisplayName('gemini-3.6-flash-high'), 'Gemini 3.6 Flash (High)');
  assert.equal(modelDisplayName('gemini-4-new-agent'), 'gemini-4-new-agent');
});

