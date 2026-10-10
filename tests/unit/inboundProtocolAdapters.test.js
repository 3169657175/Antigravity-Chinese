const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PROTOCOLS,
  detectInboundRoute,
  isGatewayAuthorized,
  chatCompletionsToResponses,
  responsesToChatCompletion,
  writeChatCompletion,
  geminiToResponses,
  responsesToGemini,
  writeGeminiResponse,
  buildGeminiModels,
  unsupportedCapabilityForPath
} = require('../../inboundProtocolAdapters.js');

function fakeResponse() {
  const chunks = [];
  return {
    status: 0,
    headers: {},
    chunks,
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    write(value) { chunks.push(String(value)); },
    end(value = '') { if (value) chunks.push(String(value)); this.ended = true; },
    text() { return chunks.join(''); }
  };
}

function responsesFixture() {
  return {
    id: 'resp_test', object: 'response', created_at: 10, model: 'gemini-3.8-flash-high',
    output: [
      { type: 'reasoning', summary: [{ type: 'summary_text', text: 'checked' }] },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'hello' }] },
      { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: '{"q":"x"}' }
    ],
    usage: { input_tokens: 7, output_tokens: 5, total_tokens: 12, input_tokens_details: { cached_tokens: 2 }, output_tokens_details: { reasoning_tokens: 1 } }
  };
}

test('detects Chat Completions and Gemini Native routes without stealing OpenAI /v1/models', () => {
  assert.equal(detectInboundRoute('POST', '/v1/chat/completions').protocol, PROTOCOLS.CHAT);
  assert.equal(detectInboundRoute('POST', '/chat/completions').protocol, PROTOCOLS.CHAT);
  const gemini = detectInboundRoute('POST', '/v1beta/models/gemini-3.8-flash-high:streamGenerateContent');
  assert.equal(gemini.protocol, PROTOCOLS.GEMINI);
  assert.equal(gemini.model, 'gemini-3.8-flash-high');
  assert.equal(gemini.stream, true);
  assert.equal(detectInboundRoute('GET', '/v1beta/models').kind, 'gemini-models');
  assert.equal(detectInboundRoute('GET', '/v1/models'), null);
});

test('accepts common OpenAI, Anthropic and Gemini API key placements', () => {
  const key = 'sk-local';
  assert.equal(isGatewayAuthorized({ authorization: `Bearer ${key}` }, key, new URL('http://x/v1')), true);
  assert.equal(isGatewayAuthorized({ 'x-api-key': key }, key, new URL('http://x/v1')), true);
  assert.equal(isGatewayAuthorized({ 'api-key': key }, key, new URL('http://x/v1')), true);
  assert.equal(isGatewayAuthorized({ 'x-goog-api-key': key }, key, new URL('http://x/v1')), true);
  assert.equal(isGatewayAuthorized({}, key, new URL(`http://x/v1beta/models?key=${key}`)), true);
  assert.equal(isGatewayAuthorized({ authorization: 'Bearer bad' }, key, new URL('http://x/v1')), false);
});

test('converts Chat Completions text, images, tools and tool results into Responses input', () => {
  const body = chatCompletionsToResponses({
    model: 'gemini-3.8-flash-high',
    messages: [
      { role: 'system', content: 'system text' },
      { role: 'user', content: [{ type: 'text', text: 'see' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,AAAA' } }] },
      { role: 'assistant', content: 'checking', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"q":"x"}' } }] },
      { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' }
    ],
    tools: [{ type: 'function', function: { name: 'lookup', description: 'Lookup', parameters: { type: 'object', properties: { q: { type: 'string' } } } } }],
    max_completion_tokens: 123,
    reasoning_effort: 'medium',
    temperature: 0.2
  });
  assert.equal(body.instructions, 'system text');
  assert.equal(body.max_output_tokens, 123);
  assert.equal(body.reasoning.effort, 'medium');
  assert.equal(body.tools[0].name, 'lookup');
  assert.equal(body.input[0].content[1].type, 'input_image');
  assert.equal(body.input.some(item => item.type === 'function_call' && item.call_id === 'call_1'), true);
  assert.equal(body.input.some(item => item.type === 'function_call_output' && item.call_id === 'call_1'), true);
});

test('converts Responses output into Chat Completions JSON and valid SSE framing', () => {
  const payload = responsesToChatCompletion(responsesFixture());
  assert.equal(payload.object, 'chat.completion');
  assert.equal(payload.choices[0].message.content, 'hello');
  assert.equal(payload.choices[0].message.reasoning_content, 'checked');
  assert.equal(payload.choices[0].message.tool_calls[0].function.name, 'lookup');
  assert.equal(payload.choices[0].finish_reason, 'tool_calls');
  assert.equal(payload.usage.prompt_tokens, 7);
  const res = fakeResponse();
  writeChatCompletion(res, responsesFixture(), { stream: true, includeUsage: true });
  assert.match(res.headers['Content-Type'], /text\/event-stream/);
  assert.match(res.text(), /chat\.completion\.chunk/);
  assert.match(res.text(), /"tool_calls"/);
  assert.match(res.text(), /data: \[DONE\]/);
});

test('converts Gemini Native contents, inline data, function calls, responses and tools', () => {
  const body = geminiToResponses({
    systemInstruction: { parts: [{ text: 'system' }] },
    contents: [
      { role: 'user', parts: [{ text: 'look' }, { inlineData: { mimeType: 'image/png', data: 'AAAA' } }] },
      { role: 'model', parts: [{ functionCall: { id: 'call_2', name: 'lookup', args: { q: 'x' } } }] },
      { role: 'user', parts: [{ functionResponse: { id: 'call_2', name: 'lookup', response: { ok: true } } }] }
    ],
    tools: [{ functionDeclarations: [{ name: 'lookup', description: 'Lookup', parameters: { type: 'object', properties: {} } }] }],
    generationConfig: { maxOutputTokens: 222, temperature: 0.3, thinkingConfig: { thinkingLevel: 'HIGH' } }
  }, 'gemini-3.8-flash-high');
  assert.equal(body.instructions, 'system');
  assert.equal(body.input[0].content[1].image_url, 'data:image/png;base64,AAAA');
  assert.equal(body.input.some(item => item.type === 'function_call' && item.call_id === 'call_2'), true);
  assert.equal(body.input.some(item => item.type === 'function_call_output' && item.call_id === 'call_2'), true);
  assert.equal(body.tools[0].name, 'lookup');
  assert.equal(body.max_output_tokens, 222);
  assert.equal(body.reasoning.effort, 'high');
});

test('converts Responses output into Gemini JSON and SSE framing', () => {
  const payload = responsesToGemini(responsesFixture());
  assert.equal(payload.candidates[0].content.parts.some(part => part.text === 'hello'), true);
  assert.equal(payload.candidates[0].content.parts.some(part => part.thought === true), true);
  assert.equal(payload.candidates[0].content.parts.find(part => part.functionCall).functionCall.name, 'lookup');
  assert.equal(payload.usageMetadata.promptTokenCount, 7);
  const res = fakeResponse();
  writeGeminiResponse(res, responsesFixture(), { stream: true });
  assert.match(res.headers['Content-Type'], /text\/event-stream/);
  assert.match(res.text(), /^data: /);
  assert.match(res.text(), /"candidates"/);
});

test('builds Gemini model discovery payloads from real model ids', () => {
  const payload = buildGeminiModels([{ id: 'gemini-3.8-flash-high', label: 'Gemini 3.8 Flash (High)', group: 'Gemini' }]);
  assert.equal(payload.models[0].name, 'models/gemini-3.8-flash-high');
  assert.equal(payload.models[0].displayName, 'Gemini 3.8 Flash (High)');
  assert.deepEqual(payload.models[0].supportedGenerationMethods, ['generateContent', 'streamGenerateContent']);
});

test('marks unsupported mainstream capability endpoints explicitly', () => {
  assert.equal(unsupportedCapabilityForPath('POST', '/v1/embeddings').capability, 'embeddings');
  assert.equal(unsupportedCapabilityForPath('POST', '/v1/audio/transcriptions').capability, 'audio');
  assert.equal(unsupportedCapabilityForPath('POST', '/v1/images/generations').capability, 'image generation');
  assert.equal(unsupportedCapabilityForPath('POST', '/v1/chat/completions'), null);
});
