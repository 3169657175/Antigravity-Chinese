const test = require('node:test');
const assert = require('node:assert/strict');
const { runCodexThreeLevelTest, runClaudeThreeLevelTest } = require('../../gatewayTestRunner');
const { CodexGateway } = require('../../codexGateway');
const { setModelsForAccount, clearModelsForAccount } = require('../../accountModelAvailability');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function createGateway() {
  const accountModels = ['agy-auto', 'gemini-4-argon-high', 'claude-opus-5-5-high'];
  return {
    config: { stable: true },
    configurationFingerprint: () => 'stable-route',
    status: () => ({
      running: true,
      baseUrl: 'http://127.0.0.1:8046/v1',
      claudeBaseUrl: 'http://127.0.0.1:8046',
      apiKey: 'test-key',
      antigravityModels: ['agy-auto', 'gemini-3.8-flash-high'],
      profiles: {
        codexAntigravity: { accountId: 'old-account', model: 'gemini-3.8-flash-high' },
        claudeAntigravity: { accountId: 'old-account', model: 'claude-sonnet-4-6' }
      }
    }),
    antigravityModels: accountId => accountId === 'selected-account'
      ? accountModels
      : ['agy-auto', 'gemini-3.8-flash-high'],
    probeUpstream: async (_body, _signal, options) => {
      assert.equal(options.accountId, 'selected-account');
      return {
        model: options.modelOverride,
        resolvedModel: options.modelOverride,
        text: JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: '连接正常' }] } }] } })
      };
    }
  };
}

test('Codex three-level test uses the selected accounts model catalog and diagnostic route', async () => {
  const gateway = createGateway();
  let diagnosticHeaders = null;
  const result = await runCodexThreeLevelTest({
    gateway,
    settings: { accountId: 'selected-account', model: 'gemini-4-argon-high' },
    fetch: async (url, options = {}) => {
      if (String(url).endsWith('/models')) return jsonResponse({ data: [{ id: 'gpt-5.6-sol' }] });
      diagnosticHeaders = options.headers;
      return jsonResponse({ id: 'resp_test', output: [{ type: 'message' }] });
    }
  });
  assert.equal(result.success, true);
  assert.equal(result.model, 'gemini-4-argon-high');
  assert.equal(diagnosticHeaders['x-agy-account-id'], 'selected-account');
  assert.equal(diagnosticHeaders['x-agy-diagnostic-model'], 'gemini-4-argon-high');
  assert.equal(result.routePreserved, true);
});

test('Claude three-level test builds the dynamic route from the selected accounts model catalog', async () => {
  const gateway = createGateway();
  const requestedModels = [];
  const result = await runClaudeThreeLevelTest({
    gateway,
    settings: { accountId: 'selected-account', claudeModel: 'claude-opus-5-5-high' },
    fetch: async (_url, options = {}) => {
      const body = JSON.parse(options.body);
      requestedModels.push(body.model);
      if (body.messages?.[0]?.content === '连接检查') return jsonResponse({ input_tokens: 3 });
      return jsonResponse({ id: 'msg_test', model: 'claude-opus-5-5-high', content: [{ type: 'text', text: 'CLAUDE_CLIENT_OK' }] });
    }
  });
  assert.equal(result.success, true);
  assert.ok(requestedModels.every(model => /^claude-opus-4-5-agy-/.test(model)));
  assert.equal(result.model, 'claude-opus-5-5-high');
  assert.equal(result.routePreserved, true);
});

test('diagnostic Responses request reaches the selected account and model without changing the saved route', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-diagnostic-route-'));
  const accountId = 'selected-account';
  const port = 32000 + Math.floor(Math.random() * 10000);
  t.after(() => {
    clearModelsForAccount(accountId);
    fs.rmSync(root, { recursive: true, force: true });
  });
  setModelsForAccount(accountId, ['gemini-4-argon-high']);
  let loadedAccountId = '';
  let forwardedModel = '';
  const upstream = JSON.stringify({
    response: {
      candidates: [{ content: { parts: [{ text: 'CLIENT_OK' }] } }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2 }
    }
  });
  const gateway = new CodexGateway({
    fetch: async (_url, options) => {
      forwardedModel = JSON.parse(options.body).model;
      return new Response(upstream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'test',
    clientSecret: 'test'
  });
  gateway.loadAccount = id => {
    loadedAccountId = id;
    return { id, token: {}, detail: {} };
  };
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'projects/selected';
  const status = await gateway.start({
    port,
    mode: 'custom',
    customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'provider-key',
    customModels: ['gpt-5.6-sol'],
    model: 'gpt-5.6-sol'
  });
  const fingerprint = gateway.configurationFingerprint();
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${status.apiKey}`,
        'Content-Type': 'application/json',
        'x-agy-account-id': accountId,
        'x-agy-diagnostic-model': 'gemini-4-argon-high'
      },
      body: JSON.stringify({ model: 'gpt-5.6-sol', input: 'hello', stream: false })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(loadedAccountId, accountId);
    assert.equal(forwardedModel, 'gemini-4-argon-high');
    assert.ok(Array.isArray(body.output) && body.output.length > 0);
    assert.equal(gateway.configurationFingerprint(), fingerprint);
    assert.equal(gateway.status().mode, 'custom');
  } finally {
    await gateway.stop();
  }
});
