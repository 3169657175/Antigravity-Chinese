const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBaseUrl, authenticate, requestFor, responsesPayload, responsesResponseToSse, fetchResponsesCompatible, extractModels } = require('./providerProtocol.js');

test('normalizes protocol endpoints without damaging version paths', () => {
  assert.equal(normalizeBaseUrl('https://example.com/v1/responses', 'responses'), 'https://example.com/v1');
  assert.equal(normalizeBaseUrl('https://example.com/v1/chat/completions', 'chat-completions'), 'https://example.com/v1');
  assert.equal(normalizeBaseUrl('https://example.com/v1/messages', 'anthropic-messages'), 'https://example.com/v1');
});

test('supports header, query and templated authentication', () => {
  assert.equal(authenticate({ apiKey: 'secret', authMode: 'x-api-key' }, { url: 'https://x.test/v1', headers: {} }).headers['x-api-key'], 'secret');
  assert.equal(new URL(authenticate({ apiKey: 'secret', authMode: 'query', authQueryName: 'key' }, { url: 'https://x.test/v1', headers: {} }).url).searchParams.get('key'), 'secret');
  assert.equal(authenticate({ apiKey: 'secret', authMode: 'custom', customHeaders: { 'X-Token': 'Token {{API_KEY}}' } }, { url: 'https://x.test/v1', headers: {} }).headers['X-Token'], 'Token secret');
});

test('converts Responses input to chat, anthropic and gemini requests', () => {
  const body = { model: 'demo', input: [{ role: 'user', content: [{ type: 'input_text', text: 'hello' }] }], max_output_tokens: 100 };
  assert.equal(requestFor({ protocol: 'chat-completions', baseUrl: 'https://x.test/v1', apiKey: 'k' }, body).body.messages[0].content, 'hello');
  assert.equal(requestFor({ protocol: 'anthropic-messages', baseUrl: 'https://x.test/v1', apiKey: 'k' }, body).body.max_tokens, 100);
  assert.match(requestFor({ protocol: 'gemini-native', baseUrl: 'https://x.test/v1beta', apiKey: 'k' }, body).url, /models\/demo:generateContent/);
});

test('normalizes provider responses and model catalogs', () => {
  const result = responsesPayload('chat-completions', { id: 'x', choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 } }, 'demo');
  assert.equal(result.output[0].content[0].text, 'ok');
  assert.deepEqual(extractModels({ models: [{ name: 'models/gemini-pro' }, 'gemini-flash'] }), ['gemini-pro', 'gemini-flash']);
});

test('normalizes a complete Responses JSON payload into SSE for streaming clients', async () => {
  const payload = {
    id: 'resp_json',
    object: 'response',
    model: 'demo',
    status: 'completed',
    output: [{
      id: 'msg_json',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'hello from json', annotations: [] }]
    }]
  };
  const sse = responsesResponseToSse(payload, 'demo');
  assert.match(sse, /event: response\.created/);
  assert.match(sse, /hello from json/);
  assert.match(sse, /data: \[DONE\]/);

  const result = await fetchResponsesCompatible(async () => new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  }), { protocol: 'responses', baseUrl: 'https://provider.test/v1', apiKey: 'secret' }, {
    model: 'demo', stream: true, input: [{ role: 'user', content: [{ type: 'input_text', text: 'hi' }] }]
  });
  assert.match(await result.text(), /response\.completed/);
  assert.match(result.headers.get('content-type'), /text\/event-stream/);
});
