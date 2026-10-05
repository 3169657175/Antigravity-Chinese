const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { LOCAL_API_CAPABILITIES, LOCAL_API_ROUTES } = require('./localApiCapabilities.js');
const gatewayUi = require('./gatewayUi.js');

test('API access page is a dedicated secondary page without replacing Codex', () => {
  const html = fs.readFileSync('index.html', 'utf8');
    assert.equal(html.includes('data-codex-page="overview">Codex</button>'), true);
    assert.equal(html.includes('data-codex-page="api">API 接入</button>'), true);
  assert.equal(html.includes('id="codex-page-api"'), true);
  assert.equal(html.includes('id="codex-page-overview"'), true);
});

test('local API capabilities only advertise routes the gateway really handles', () => {
  const paths = LOCAL_API_CAPABILITIES.routes.map(route => route.path);
  assert.ok(paths.includes('/v1/models'));
  assert.ok(paths.includes('/v1/responses'));
  assert.ok(paths.includes('/v1/responses/compact'));
  assert.ok(paths.includes('/v1/messages'));
  assert.ok(paths.includes('/v1/messages/count_tokens'));
  assert.ok(paths.includes('/v1/chat/completions'));
  assert.ok(paths.includes('/v1beta/models'));
  assert.ok(paths.includes('/v1beta/models/{model}:generateContent'));
  assert.ok(LOCAL_API_CAPABILITIES.protocols.some(item => item.id === 'openai-chat-completions'));
  assert.ok(LOCAL_API_CAPABILITIES.protocols.some(item => item.id === 'gemini-native'));
  assert.deepEqual(LOCAL_API_ROUTES.responses, ['/v1/responses', '/responses']);
});

test('API access view keeps real model ids and produces copyable config', () => {
  const view = gatewayUi.buildApiAccessView({
    running: true,
    host: '127.0.0.1',
    port: 8046,
    apiKey: 'local-secret',
    baseUrl: 'http://127.0.0.1:8046/v1',
    codexAntigravityModel: 'gemini-3.8-flash-high',
    apiCapabilities: LOCAL_API_CAPABILITIES,
    antigravityModelEntries: [
      { id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)', group: 'Gemini' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', group: 'Claude' }
    ]
  }, 'demo@example.com');
  assert.equal(view.baseUrl, 'http://127.0.0.1:8046/v1');
  assert.equal(view.openaiBaseUrl, 'http://127.0.0.1:8046/v1');
  assert.equal(view.anthropicBaseUrl, 'http://127.0.0.1:8046');
  assert.equal(view.geminiBaseUrl, 'http://127.0.0.1:8046/v1beta');
  assert.equal(view.account, 'demo@example.com');
  assert.equal(view.defaultModel, 'gemini-3.8-flash-high');
  assert.equal(view.models[0].id, 'gemini-3.8-flash-high');
  const copied = gatewayUi.formatApiConnectionText(view);
  assert.equal(copied.includes('OpenAI Base URL: http://127.0.0.1:8046/v1'), true);
  assert.equal(copied.includes('Anthropic Base URL: http://127.0.0.1:8046'), true);
  assert.equal(copied.includes('Gemini Base URL: http://127.0.0.1:8046/v1beta'), true);
  assert.equal(copied.includes('API Key: local-secret'), true);
  assert.equal(copied.includes('模型: gemini-3.8-flash-high'), true);
});
