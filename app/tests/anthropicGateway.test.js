const test = require('node:test');
const assert = require('node:assert/strict');
const {
  anthropicToResponsesRequest,
  createAnthropicMessage,
  estimateAnthropicInputTokens,
  isLocalGatewayAuthorized
} = require('../src/anthropicGateway');

test('converts Claude Messages history, tools and images into Responses input', () => {
  const request = anthropicToResponsesRequest({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: [{ type: 'text', text: 'Be precise.' }],
    messages: [
      { role: 'user', content: [
        { type: 'text', text: 'Inspect this.' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'YWJj' } }
      ] },
      { role: 'assistant', content: [
        { type: 'text', text: 'Calling a tool.' },
        { type: 'tool_use', id: 'toolu_123', name: 'read_file', input: { path: 'a.txt' } }
      ] },
      { role: 'user', content: [
        { type: 'tool_result', tool_use_id: 'toolu_123', content: 'hello' }
      ] }
    ],
    tools: [{ name: 'read_file', description: 'Read a file', input_schema: { type: 'object', properties: { path: { type: 'string' } } } }],
    stream: true
  });

  assert.equal(request.instructions, 'Be precise.');
  assert.equal(request.model, 'claude-sonnet-4-6');
  assert.equal(request.max_output_tokens, 4096);
  assert.equal(request.stream, true);
  assert.equal(request.tools[0].parameters.properties.path.type, 'string');
  assert.ok(request.input.some(item => item.type === 'function_call' && item.call_id === 'toolu_123'));
  assert.ok(request.input.some(item => item.type === 'function_call_output' && item.output === 'hello'));
  const image = request.input.flatMap(item => item.content || []).find(item => item.type === 'input_image');
  assert.equal(image.image_url, 'data:image/png;base64,YWJj');
});

test('creates Anthropic Messages output with tool use and official usage', () => {
  const remembered = [];
  const output = createAnthropicMessage([
    { text: 'I will inspect it.' },
    { functionCall: { name: 'read_file', args: { path: 'a.txt' } }, thoughtSignature: 'sig-1' }
  ], 'claude-sonnet-4-6', 'msg_test', {
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      thoughtsTokenCount: 5,
      cachedContentTokenCount: 60
    },
    onToolCall: (item, metadata) => remembered.push({ item, metadata })
  });

  assert.equal(output.type, 'message');
  assert.equal(output.stop_reason, 'tool_use');
  assert.equal(output.content[0].type, 'text');
  assert.equal(output.content[1].type, 'tool_use');
  assert.deepEqual(output.content[1].input, { path: 'a.txt' });
  assert.equal(output.usage.input_tokens, 100);
  assert.equal(output.usage.output_tokens, 25);
  assert.equal(output.usage.cache_read_input_tokens, 60);
  assert.equal(remembered[0].item.call_id, output.content[1].id);
  assert.equal(remembered[0].metadata.thoughtSignature, 'sig-1');
});

test('accepts Claude Code bearer or x-api-key authentication', () => {
  assert.equal(isLocalGatewayAuthorized({ authorization: 'Bearer local-key' }, 'local-key'), true);
  assert.equal(isLocalGatewayAuthorized({ 'x-api-key': 'local-key' }, 'local-key'), true);
  assert.equal(isLocalGatewayAuthorized({ authorization: 'Bearer wrong' }, 'local-key'), false);
});

test('provides a conservative local token count fallback', () => {
  const count = estimateAnthropicInputTokens({
    system: '你是代码助手',
    messages: [{ role: 'user', content: 'Explain this function in detail.' }],
    tools: [{ name: 'read_file', input_schema: { type: 'object' } }]
  });
  assert.ok(Number.isInteger(count));
  assert.ok(count > 10);
});
