const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { CodexGateway } = require('../../codexGateway.js');

async function createGateway() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-inbound-routes-'));
  const gateway = new CodexGateway({
    fetch: async () => { throw new Error('unexpected external fetch'); },
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'test',
    clientSecret: 'test'
  });
  gateway.config.port = 0;
  gateway.config.apiKey = 'local-test-key';
  gateway.openUpstream = async body => ({
    response: new Response(JSON.stringify({
      response: {
        candidates: [{ content: { parts: body.tools?.length
          ? [{ text: 'working' }, { functionCall: { name: body.tools[0].name, args: { q: 'x' } } }]
          : [{ text: 'hello from agy' }] } }],
        usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 }
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    model: body.model || 'gemini-3.8-flash-high',
    resolvedModel: body.model || 'gemini-3.8-flash-high'
  });
  await gateway.start();
  const port = gateway.server.address().port;
  return { gateway, root, base: `http://127.0.0.1:${port}`, headers: { Authorization: 'Bearer local-test-key', 'Content-Type': 'application/json' } };
}

async function withGateway(fn) {
  const ctx = await createGateway();
  try { await fn(ctx); } finally { await ctx.gateway.stop(); fs.rmSync(ctx.root, { recursive: true, force: true }); }
}

test('real local gateway serves OpenAI Chat Completions JSON and SSE', async () => withGateway(async ({ base, headers }) => {
  const jsonResponse = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model: 'gemini-3.8-flash-high', messages: [{ role: 'user', content: 'hi' }] })
  });
  assert.equal(jsonResponse.status, 200);
  const json = await jsonResponse.json();
  assert.equal(json.object, 'chat.completion');
  assert.equal(json.choices[0].message.content, 'hello from agy');
  assert.equal(json.usage.total_tokens, 7);

  const streamResponse = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({ model: 'gemini-3.8-flash-high', stream: true, stream_options: { include_usage: true }, messages: [{ role: 'user', content: 'hi' }] })
  });
  assert.equal(streamResponse.status, 200);
  assert.match(streamResponse.headers.get('content-type'), /text\/event-stream/);
  const text = await streamResponse.text();
  assert.match(text, /chat\.completion\.chunk/);
  assert.match(text, /hello from agy/);
  assert.match(text, /data: \[DONE\]/);
}));

test('real local gateway serves Chat Completions tool calls', async () => withGateway(async ({ base, headers }) => {
  const response = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({
      model: 'gemini-3.8-flash-high',
      messages: [{ role: 'user', content: 'lookup x' }],
      tools: [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object', properties: { q: { type: 'string' } } } } }]
    })
  });
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.choices[0].finish_reason, 'tool_calls');
  assert.equal(json.choices[0].message.tool_calls[0].function.name, 'lookup');
}));

test('real local gateway serves Gemini Native generation and model discovery', async () => withGateway(async ({ base }) => {
  const headers = { 'x-goog-api-key': 'local-test-key', 'Content-Type': 'application/json' };
  const response = await fetch(`${base}/v1beta/models/gemini-3.8-flash-high:generateContent`, {
    method: 'POST', headers,
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'hi' }] }] })
  });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.candidates[0].content.parts.some(part => part.text === 'hello from agy'), true);
  assert.equal(json.usageMetadata.totalTokenCount, 7);

  const modelsResponse = await fetch(`${base}/v1beta/models?key=local-test-key`);
  assert.equal(modelsResponse.status, 200);
  const models = await modelsResponse.json();
  assert.equal(Array.isArray(models.models), true);
  assert.equal(models.models.some(model => model.name === 'models/gemini-3.8-flash-high'), true);
}));

test('public OpenAI model discovery exposes real Antigravity ids instead of Codex aliases', async () => withGateway(async ({ base, headers }) => {
  const response = await fetch(`${base}/v1/models`, { headers });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.object, 'list');
  const ids = json.data.map(item => item.id);
  assert.equal(ids.includes('gemini-3.8-flash-high'), true);
  assert.equal(ids.includes('claude-sonnet-4-6'), true);
  assert.equal(ids.includes('agy-auto'), false);
  assert.equal(ids.some(id => ['gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.6'].includes(id)), false);
}));

test('unsupported mainstream API capability returns explicit 501', async () => withGateway(async ({ base, headers }) => {
  const response = await fetch(`${base}/v1/embeddings`, { method: 'POST', headers, body: JSON.stringify({ model: 'x', input: 'hello' }) });
  assert.equal(response.status, 501);
  const json = await response.json();
  assert.match(json.error.message, /embeddings.*not supported/i);
}));
