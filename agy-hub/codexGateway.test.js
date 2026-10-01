const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const {
  CodexGateway, mapModel, selectRequestedModel, cleanSchema, toClaudeSafeSchema, convertResponsesRequest, parseUpstreamEvents, collectParts, createResponsesOutput,
  decodeRequestBody, isCompactionRequest, isUserProjectDenied, isUserLocationUnsupported, optimizeCompactionBody, sanitizeResponsesHistoryIds,
  normalizeResponsesToolHistory, classifyUpstreamError, buildEmergencyCompactionSummary,
  optimizeCustomRequestBody, responsesRequestReadLimit
} = require('./codexGateway');
const { buildCodexConfig, connectCodex, restoreCodex } = require('./codexConfig');
const {
  MODELS,
  CODEX_VISIBLE_MODEL_ALIASES,
  buildCodexModelsResponse,
  buildAntigravityCodexModelsResponse,
  codexVisibleModelAliasesForModels,
  codexAliasForModel
} = require('./codexModels');
const { readProfiles, saveProfile, deleteProfile } = require('./codexProviderProfiles');

test('cleans Claude Desktop JSON Schema into Cloud Code function schema', () => {
  const schema = cleanSchema({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    propertyNames: { pattern: '^[a-z]+$' },
    properties: {
      files: {
        type: 'object',
        propertyNames: { minLength: 1 },
        additionalProperties: { type: 'string' }
      },
      retries: { type: 'integer', exclusiveMinimum: 0, maximum: 10 },
      mode: { anyOf: [{ const: 'fast' }, { const: 'safe' }, { type: 'null' }] },
      nested: { allOf: [
        { type: 'object', properties: { enabled: { type: 'boolean' } } },
        { type: 'object', required: ['enabled'] }
      ] }
    },
    required: ['files', 'mode']
  });
  const serialized = JSON.stringify(schema);
  for (const keyword of ['$schema', 'additionalProperties', 'propertyNames', 'exclusiveMinimum', 'maximum', 'const', 'allOf', 'oneOf']) {
    assert.equal(serialized.includes(`"${keyword}"`), false, keyword);
  }
  assert.equal(schema.type, 'object');
  assert.deepEqual(schema.required, ['files', 'mode']);
  assert.equal(schema.properties.files.type, 'object');
  assert.equal(schema.properties.retries.type, 'integer');
  assert.equal(schema.properties.mode.nullable, true);
  assert.deepEqual(schema.properties.mode.anyOf.map(item => item.enum), [['fast'], ['safe']]);
  assert.equal(schema.properties.nested.properties.enabled.type, 'boolean');
  assert.deepEqual(schema.properties.nested.required, ['enabled']);
});

test('converts Claude upstream tools to the Cloud Code Schema subset', () => {
  const source = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    propertyNames: { pattern: '^[a-z]+$' },
    properties: {
      retries: { type: 'integer', exclusiveMinimum: 0 },
      mode: { anyOf: [{ const: 'safe' }, { type: 'null' }] }
    },
    strict: true,
    external_web_access: true
  };
  const request = convertResponsesRequest({
    model: 'claude-sonnet-4-6',
    input: 'inspect',
    tools: [{ type: 'function', name: 'inspect', parameters: source }]
  });
  const schema = request.tools[0].functionDeclarations[0].parameters;
  const serialized = JSON.stringify(schema);
  for (const keyword of ['$schema', 'propertyNames', 'additionalProperties', 'exclusiveMinimum', 'const', 'strict', 'external_web_access']) {
    assert.equal(serialized.includes(`"${keyword}"`), false, keyword);
  }
  assert.equal(schema.type, 'object');
  assert.equal(schema.properties.retries.type, 'integer');
  assert.equal(schema.properties.mode.nullable, true);
  assert.deepEqual(schema.properties.mode.enum, ['safe']);
});

test('relaxes only the rejected Claude tool schema and retries automatically', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-claude-schema-repair-'));
  const forwarded = [];
  const gateway = new CodexGateway({
    fetch: async (_url, options) => {
      forwarded.push(JSON.parse(options.body));
      if (forwarded.length === 1) {
        return new Response(JSON.stringify({ error: { message: 'tools.24.custom.input_schema: JSON schema is invalid' } }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response('data: {"response":{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {}, detail: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project';
  const tools = Array.from({ length: 25 }, (_, index) => ({
    type: 'function', name: `tool_${index}`, description: `Tool ${index}`,
    parameters: index === 24
      ? { type: 'object', properties: { mode: { anyOf: [{ const: 'safe' }, { type: 'null' }] } } }
      : { type: 'object', properties: { value: { type: 'string' } } }
  }));
  const upstream = await gateway.openUpstream({ model: 'claude-sonnet-4-6', input: 'hello', tools }, new AbortController().signal, {
    modelOverride: 'claude-sonnet-4-6'
  });
  assert.equal(upstream.response.status, 200);
  assert.equal(forwarded.length, 2);
  const first = forwarded[0].request.tools[0].functionDeclarations;
  const second = forwarded[1].request.tools[0].functionDeclarations;
  assert.deepEqual(second[0].parameters, first[0].parameters);
  assert.equal(second[24].name, 'tool_24');
  assert.deepEqual(second[24].parameters, toClaudeSafeSchema(first[24].parameters));
  assert.match(second[24].description, /relaxed schema validation/);
});

test('publishes the currently available Antigravity model catalog', () => {
  assert.equal(MODELS.length, 14);
  assert.deepEqual(MODELS, [
    'agy-auto',
    'gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low',
    'gemini-3.7-flash-high', 'gemini-3.7-flash-medium', 'gemini-3.7-flash-low',
    'gemini-3.6-flash-high', 'gemini-3.6-flash-medium', 'gemini-3.6-flash-low',
    'gemini-3.1-pro-high', 'gemini-3.1-pro-low',
    'claude-opus-4-6-thinking', 'claude-sonnet-4-6'
  ]);
  const catalog = buildCodexModelsResponse();
  assert.equal(catalog.models.length, 14);
  assert.equal(catalog.models[0].display_name, 'AGY 自动路由（按额度）');
  assert.equal(catalog.models[13].display_name, 'Claude Sonnet 4.6 (Thinking)');
  assert.equal(catalog.models[0].minimal_client_version, '0.144.0');
  assert.equal(catalog.models[0].multi_agent_version, 'v2');
  assert.equal(catalog.models[0].supports_reasoning_summaries, true);
  assert.equal(catalog.models[0].tool_mode, 'code_mode_only');
  assert.ok(catalog.models[0].available_in_plans.includes('k12'));

  const visibleCatalog = buildAntigravityCodexModelsResponse();
  assert.equal(visibleCatalog.models.length, 8);
  assert.deepEqual(visibleCatalog.models.map(item => item.slug), Object.keys(CODEX_VISIBLE_MODEL_ALIASES));
  assert.equal(visibleCatalog.models[0].display_name, 'Gemini 3.8 Flash (High)');
  assert.equal(codexAliasForModel('gemini-3.1-pro-high'), 'gpt-5.5');
  assert.equal(codexAliasForModel('gemini-3.5-flash-lite'), 'gpt-5.6-luna');
  assert.equal(codexAliasForModel('claude-sonnet-4-6'), 'gpt-5.4-mini');
  assert.equal(codexAliasForModel('claude-opus-4-6-thinking'), 'gpt-5.3-codex');
  assert.equal(visibleCatalog.models.some(item => /Gemini 3\.8 Flash \(Low\)/i.test(item.display_name)), true);
  assert.deepEqual(
    visibleCatalog.models.filter(item => /^Claude /.test(item.display_name)).map(item => item.display_name),
    ['Claude Sonnet 4.6 (Thinking)', 'Claude Opus 4.6 (Thinking)']
  );
});

test('supports explicit gateway and Codex model control modes', () => {
  assert.equal(selectRequestedModel('gemini-3.6-flash-high', {
    model: 'gemini-3.1-pro-high', modelControl: 'gateway'
  }), 'gemini-3.1-pro-high');
  assert.equal(selectRequestedModel('gemini-3.6-flash-high', {
    model: 'gemini-3.1-pro-high', modelControl: 'client'
  }), 'gemini-3.6-flash-high');
  assert.equal(selectRequestedModel('gpt-5.6-sol', {
    model: 'gemini-3.1-pro-high', modelControl: 'client'
  }), 'gemini-3.8-flash-high');
});

test('migrates removed 3.5 model ids to the current default catalog', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-removed-model-'));
  fs.writeFileSync(path.join(root, 'codex-gateway.json'), JSON.stringify({
    mode: 'antigravity',
    model: 'gemini-3.5-flash-low',
    autoResolvedModel: 'gemini-3.5-flash-medium'
  }), 'utf8');
  const gateway = new CodexGateway({ accountRoot: root, stateDir: root });
  const status = gateway.status();
  assert.equal(status.model, 'gemini-3.8-flash-high');
  assert.equal(status.autoResolvedModel, 'gemini-3.8-flash-high');
  assert.equal(status.models.includes('gemini-3.5-flash-lite'), false);
  assert.equal(status.models.includes('gemini-3.5-flash-high'), false);
});

test('resolves the virtual auto model to the configured physical model', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-auto-model-'));
  let requestBody = null;
  const gateway = new CodexGateway({
    fetch: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, status: 200, text: async () => 'data: {"response":{"candidates":[]}}\n\n' };
    },
    accountRoot: root, stateDir: root, decryptToken: value => value, clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project-id';
  gateway.configure({ model: 'agy-auto', autoResolvedModel: 'claude-sonnet-4-6' });
  await gateway.callUpstream({ model: 'agy-auto', input: 'hi' });
  assert.equal(requestBody.model, 'claude-sonnet-4-6');
});

test('maps Codex model and converts messages/tools', () => {
  assert.equal(mapModel('gemini-3.5-flash-lite'), 'gemini-3.5-flash-low');
  assert.equal(mapModel('gemini-3.1-pro-high'), 'gemini-pro-agent');
  const result = convertResponsesRequest({
    instructions: 'You are Codex.',
    input: [{
      type: 'message', role: 'user',
      content: [
        { type: 'input_text', text: 'hi' },
        { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' }
      ]
    }],
    tools: [{ type: 'function', name: 'shell', parameters: { type: 'object', additionalProperties: false, properties: { cmd: { type: 'string' } } } }]
  });
  assert.equal(result.systemInstruction.parts[0].text, 'You are Codex.');
  assert.equal(result.contents[0].parts[0].text, 'hi');
  assert.deepEqual(result.contents[0].parts[1].inlineData, { mimeType: 'image/png', data: 'aGVsbG8=' });
  assert.equal(result.tools[0].functionDeclarations[0].name, 'shell');
  assert.equal(result.tools[0].functionDeclarations[0].parameters.additionalProperties, undefined);
});

test('repairs missing tool ids and keeps only one result per tool call', () => {
  const normalized = normalizeResponsesToolHistory({
    input: [
      { type: 'function_call', id: 'legacy_tool_1', name: 'shell', arguments: '{"cmd":"dir"}' },
      { type: 'function_call_output', call_id: 'legacy_tool_1', output: 'old' },
      { type: 'function_call_output', call_id: 'legacy_tool_1', output: 'latest' }
    ]
  });
  assert.equal(normalized.input[0].call_id, 'legacy_tool_1');
  const results = normalized.input.filter(item => item.type === 'function_call_output');
  assert.equal(results.length, 1);
  assert.equal(results[0].output, 'latest');
});

test('preserves orphan tool output as text instead of sending invalid Claude history', () => {
  const normalized = normalizeResponsesToolHistory({
    input: [{ type: 'function_call_output', call_id: 'missing_call', output: 'important result' }]
  });
  assert.equal(normalized.input[0].type, 'message');
  assert.match(normalized.input[0].content[0].text, /important result/);
});

test('classifies capacity, quota, missing model and tool-history errors', () => {
  assert.equal(classifyUpstreamError('MODEL_CAPACITY_EXHAUSTED').code, 'capacity_exhausted');
  assert.equal(classifyUpstreamError('429 QUOTA_EXHAUSTED Resets in 3h').code, 'quota_exhausted');
  assert.equal(classifyUpstreamError('Cloud Code 404: NOT_FOUND').code, 'model_not_found');
  assert.equal(classifyUpstreamError('tool_use.id: Field required').code, 'tool_call_id_missing');
  assert.equal(classifyUpstreamError('each tool_use must have a single result').code, 'duplicate_tool_result');
});

test('reports Google geographic restriction instead of blaming request format', () => {
  const raw = 'Cloud Code 400: {"error":{"code":400,"message":"User location is not supported for the API use.","status":"FAILED_PRECONDITION"}}';
  assert.equal(isUserLocationUnsupported(raw), true);
  const diagnostic = classifyUpstreamError(raw);
  assert.equal(diagnostic.code, 'unsupported_location');
  assert.match(diagnostic.message, /网络出口地区/);
  assert.doesNotMatch(diagnostic.message, /请求格式|长对话历史/);
});

test('tries the remaining official Cloud Code endpoints after a location rejection', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-location-fallback-'));
  const urls = [];
  const gateway = new CodexGateway({
    fetch: async (url) => {
      urls.push(String(url));
      if (urls.length === 1) {
        return new Response(JSON.stringify({
          error: { code: 400, message: 'User location is not supported for the API use.', status: 'FAILED_PRECONDITION' }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('data: {"response":{"candidates":[{"content":{"parts":[{"text":"OK"}]}}]}}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {}, detail: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project';

  const upstream = await gateway.openUpstream({ model: 'gemini-3.6-flash-high', input: 'hello' }, new AbortController().signal, {
    modelOverride: 'gemini-3.6-flash-high'
  });
  assert.equal(upstream.response.status, 200);
  assert.equal(urls.length, 2);
  assert.notEqual(new URL(urls[0]).host, new URL(urls[1]).host);
});

test('decodes compressed Codex request bodies asynchronously', async () => {
  const source = Buffer.from(JSON.stringify({ model: 'gpt-5.6-sol', input: 'hello' }));
  assert.deepEqual(JSON.parse((await decodeRequestBody(zlib.gzipSync(source), 'gzip')).toString('utf8')), {
    model: 'gpt-5.6-sol', input: 'hello'
  });
  assert.deepEqual(JSON.parse((await decodeRequestBody(zlib.brotliCompressSync(source), 'br')).toString('utf8')), {
    model: 'gpt-5.6-sol', input: 'hello'
  });
});

test('recognizes and reduces Codex compaction requests without changing normal turns', () => {
  const metadata = JSON.stringify({ request_kind: 'compaction' });
  const body = {
    client_metadata: { 'x-codex-turn-metadata': metadata },
    tools: [{ type: 'function', name: 'shell' }],
    input: [{
      type: 'message', role: 'user', content: [
        { type: 'input_text', text: 'keep this task' },
        { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' }
      ]
    }, { type: 'function_call_output', call_id: 'call_1', output: 'x'.repeat(30000) }]
  };
  assert.equal(isCompactionRequest({ headers: {} }, body), true);
  const optimized = optimizeCompactionBody(body);
  assert.deepEqual(optimized.tools, []);
  assert.equal(optimized.input[0].content.some(item => item.type === 'input_image'), false);
  assert.match(optimized.input[0].content[1].text, /Image omitted/);
  assert.ok(optimized.input[1].output.length < 13000);
  assert.match(buildEmergencyCompactionSummary(optimized), /keep this task/);
});

test('custom-provider long conversations omit only older inline images and older tool output before forwarding', () => {
  const oldImage = `data:image/png;base64,${'A'.repeat(14000)}`;
  const currentImage = `data:image/png;base64,${'B'.repeat(900)}`;
  const body = {
    model: 'gpt-5.6-sol',
    input: [
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'old visual context' }, { type: 'input_image', image_url: oldImage }] },
      { type: 'function_call_output', call_id: 'old_call', output: 'x'.repeat(26000) },
      { type: 'function_call_output', call_id: 'latest_call', output: 'latest tool result stays intact' },
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'current visual context' }, { type: 'input_image', image_url: currentImage }] }
    ]
  };
  const optimized = optimizeCustomRequestBody(body, { targetBytes: 15000, forwardLimitBytes: 20000 });
  assert.equal(body.input[0].content[1].type, 'input_image', 'must not mutate the client request object');
  assert.equal(optimized.report.omittedHistoricalImages, 1);
  assert.equal(optimized.report.truncatedHistoricalToolOutputs, 1);
  assert.equal(optimized.report.requiresUserAction, false);
  assert.equal(optimized.body.input[0].content[1].type, 'input_text');
  assert.equal(optimized.body.input[3].content[1].image_url, currentImage, 'must preserve current-turn images');
  assert.ok(optimized.report.afterBytes <= 15000);
  assert.equal(responsesRequestReadLimit(true), 64 * 1024 * 1024);
  assert.equal(responsesRequestReadLimit(false), undefined);
});

test('repairs incompatible replayed Responses item ids without breaking tool call pairing', () => {
  const body = {
    model: 'gpt-5.6-sol',
    input: [
      { type: 'custom_tool_call', id: 'fc_1bc1eaf268808771', call_id: 'call_380', name: 'apply_patch', input: '{}' },
      { type: 'custom_tool_call_output', call_id: 'call_380', output: 'done' },
      { type: 'function_call', id: 'fc_valid', call_id: 'call_381', name: 'shell', arguments: '{}' },
      { type: 'message', id: 'msg_valid', role: 'user', content: [{ type: 'input_text', text: 'continue' }] }
    ]
  };

  const repaired = sanitizeResponsesHistoryIds(body);
  assert.equal(repaired.input[0].id, undefined);
  assert.equal(repaired.input[0].call_id, 'call_380');
  assert.equal(repaired.input[1].call_id, 'call_380');
  assert.equal(repaired.input[2].id, 'fc_valid');
  assert.equal(repaired.input[3].id, 'msg_valid');
  assert.equal(body.input[0].id, 'fc_1bc1eaf268808771');
});

test('parses Cloud Code SSE and creates Responses output', () => {
  const events = parseUpstreamEvents('data: {"response":{"candidates":[{"content":{"parts":[{"text":"hello"},{"functionCall":{"name":"shell","args":{"cmd":"dir"}}}]}}]}}\n\ndata: [DONE]\n');
  const parts = collectParts(events);
  const response = createResponsesOutput(parts, 'gemini-3.1-pro-high', 'resp_test');
  assert.equal(response.output[0].content[0].text, 'hello');
  assert.equal(response.output[1].name, 'shell');
});

test('retries a 403 without x-goog-user-project', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-gateway-'));
  const calls = [];
  const gateway = new CodexGateway({
    fetch: async (url, options) => {
      calls.push({ url, headers: options.headers });
      if (calls.length === 1) return { ok: false, status: 403, text: async () => 'SERVICE_DISABLED' };
      return { ok: true, status: 200, text: async () => 'data: {"response":{"candidates":[]}}\n\n' };
    },
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'test',
    clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project-id';
  await gateway.callUpstream({ model: 'gemini-3.1-pro-high', input: 'hi' });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].headers['x-goog-user-project'], 'project-id');
  assert.equal(calls[1].headers['x-goog-user-project'], undefined);
});

test('discovers the current account project instead of trusting a persisted project from another machine', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-project-discovery-'));
  const gateway = new CodexGateway({
    fetch: async url => {
      assert.match(String(url), /loadCodeAssist/);
      return new Response(JSON.stringify({ cloudaicompanionProject: 'projects/current-account-project' }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  const project = await gateway.getProjectId({
    id: 'friend-account',
    token: { project_id: 'projects/deleted-project' },
    detail: { project_id: 'projects/other-machine-project' }
  }, 'access-token');
  assert.equal(project, 'projects/current-account-project');
});

test('refreshes account project once after USER_PROJECT_DENIED', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-project-recovery-'));
  const projects = ['projects/deleted-project', 'projects/current-account-project'];
  const forwardedProjects = [];
  const gateway = new CodexGateway({
    fetch: async (_url, options) => {
      const payload = JSON.parse(options.body);
      forwardedProjects.push(payload.project);
      if (payload.project === 'projects/deleted-project') {
        return new Response(JSON.stringify({
          error: { code: 400, message: "Project 'projects/deleted-project' not found or deleted.",
            details: [{ reason: 'USER_PROJECT_DENIED' }] }
        }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('data: {"response":{"candidates":[]}}\n\n', {
        status: 200, headers: { 'Content-Type': 'text/event-stream' }
      });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'friend-account', token: {}, detail: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async (_account, _token, options) => options.forceRefresh ? projects[1] : projects[0];
  await gateway.callUpstream({ model: 'gemini-3.1-pro-high', input: 'hello' });
  assert.deepEqual(forwardedProjects, projects);
  assert.equal(isUserProjectDenied('reason: USER_PROJECT_DENIED'), true);
});

test('uses the manually selected account for subsequent gateway calls', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-selected-account-'));
  const accountsDir = path.join(root, 'accounts');
  fs.mkdirSync(accountsDir);
  fs.writeFileSync(path.join(root, 'accounts.json'), JSON.stringify({
    current_account_id: 'first',
    accounts: [{ id: 'first' }, { id: 'second' }]
  }), 'utf8');
  fs.writeFileSync(path.join(accountsDir, 'first.json'), JSON.stringify({ token: { refresh_token: 'first-token' } }), 'utf8');
  fs.writeFileSync(path.join(accountsDir, 'second.json'), JSON.stringify({ token: { refresh_token: 'second-token' } }), 'utf8');

  const gateway = new CodexGateway({
    fetch: async () => ({ ok: true, status: 200, text: async () => 'data: {"response":{"candidates":[]}}\n\n' }),
    accountRoot: root, stateDir: root, decryptToken: value => value.token, clientId: 'test', clientSecret: 'test'
  });
  gateway.getAccessToken = async account => account.id;
  gateway.getProjectId = async () => 'project-id';
  let selected = gateway.loadAccount();
  assert.equal(selected.id, 'first');
  gateway.configure({ accountId: 'second' });
  selected = gateway.loadAccount();
  assert.equal(selected.id, 'second');
});

test('read-only model probes do not switch an active custom-provider route', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-readonly-probe-'));
  let requestedAccount = '';
  let requestBody = null;
  const gateway = new CodexGateway({
    fetch: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return { ok: true, status: 200, text: async () => 'data: {"response":{"candidates":[{"content":{"parts":[{"text":"连接正常"}]}}]}}\n\n' };
    },
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'test',
    clientSecret: 'test'
  });
  gateway.configure({
    mode: 'custom',
    model: 'gpt-5.6-sol',
    customBaseUrl: 'https://example.test/v1',
    customApiKey: 'key'
  });
  gateway.loadAccount = accountId => {
    requestedAccount = accountId;
    return { id: accountId, token: {} };
  };
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project-id';

  await gateway.callUpstream({
    model: 'gemini-3.8-flash-high',
    input: '连接检查',
    stream: false
  }, undefined, {
    modelOverride: 'gemini-3.8-flash-high',
    accountId: 'probe-account'
  });

  assert.equal(requestedAccount, 'probe-account');
  assert.equal(requestBody.model, 'gemini-3.8-flash-tiered');
  assert.equal(gateway.status().mode, 'custom');
  assert.equal(gateway.status().model, 'gpt-5.6-sol');
});

test('preserves custom tool type and thought signature across turns', () => {
  const cache = new Map();
  const toolKinds = new Map([['apply_patch', 'custom']]);
  let callItem;
  const response = createResponsesOutput([
    { functionCall: { name: 'apply_patch', args: { input: '*** Begin Patch' } }, thoughtSignature: 'signed-thought' }
  ], 'gemini-3.1-pro-high', 'resp_tools', {
    toolKinds,
    onToolCall(item, metadata) {
      callItem = item;
      cache.set(item.call_id, { ...metadata, thoughtSignature: metadata.thoughtSignature });
    }
  });
  assert.equal(response.output[0].type, 'custom_tool_call');
  assert.equal(response.output[0].input, '*** Begin Patch');

  const next = convertResponsesRequest({
    input: [
      callItem,
      { type: 'custom_tool_call_output', call_id: callItem.call_id, output: { content: 'Done', success: true } }
    ],
    tools: [{ type: 'custom', name: 'apply_patch', description: 'Apply a patch' }]
  }, { toolCallCache: cache });
  assert.equal(next.contents[0].parts[0].functionCall.name, 'apply_patch');
  assert.equal(next.contents[0].parts[0].thoughtSignature, 'signed-thought');
  assert.equal(next.contents[1].parts[0].functionResponse.response.result, 'Done');
  assert.equal(next.tools[0].functionDeclarations[0].parameters.properties.input.type, 'string');
});

test('persists tool signatures across gateway restarts', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-tool-cache-'));
  const options = {
    fetch: async () => {}, accountRoot: root, stateDir: root,
    decryptToken: value => value, clientId: 'test', clientSecret: 'test'
  };
  const first = new CodexGateway(options);
  first.rememberToolCall({ call_id: 'call_saved' }, {
    name: 'apply_patch', kind: 'custom', thoughtSignature: 'signature_saved'
  });
  const second = new CodexGateway(options);
  assert.deepEqual(second.toolCallCache.get('call_saved'), {
    name: 'apply_patch', kind: 'custom', thoughtSignature: 'signature_saved'
  });
});

test('keeps complete long conversation history', () => {
  const input = Array.from({ length: 300 }, (_, index) => ({
    type: 'message',
    role: index % 2 ? 'assistant' : 'user',
    content: [{ type: index % 2 ? 'output_text' : 'input_text', text: `turn-${index}` }]
  }));
  const converted = convertResponsesRequest({ input });
  assert.equal(converted.contents.length, 300);
  assert.equal(converted.contents[0].parts[0].text, 'turn-0');
  assert.equal(converted.contents[299].parts[0].text, 'turn-299');
  assert.equal(converted.contents[299].role, 'model');
});

test('streams Cloud Code chunks through the local Responses endpoint', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-stream-'));
  const port = 20000 + Math.floor(Math.random() * 10000);
  const encoder = new TextEncoder();
  const upstreamBody = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"response":{"candidates":[{"content":{"parts":[{"text":"first "}]}}]}}\n\n'));
      setTimeout(() => {
        controller.enqueue(encoder.encode('data: {"response":{"candidates":[{"content":{"parts":[{"text":"second"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":4,"candidatesTokenCount":2,"totalTokenCount":6}}}\n\n'));
        controller.close();
      }, 30);
    }
  });
  const gateway = new CodexGateway({
    fetch: async () => new Response(upstreamBody, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'test',
    clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project-id';
  const status = await gateway.start({ port });
  try {
    const result = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-3.1-pro-high', input: 'hello', stream: true })
    });
    const text = await result.text();
    assert.equal(result.status, 200);
    assert.match(text, /response\.output_text\.delta/);
    assert.match(text, /first /);
    assert.match(text, /second/);
    assert.match(text, /response\.completed/);
    assert.match(text, /"total_tokens":6/);
  } finally {
    await gateway.stop();
  }
});

test('reports official Cloud Code usage after a streamed response', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-usage-callback-'));
  const port = 30000 + Math.floor(Math.random() * 5000);
  const reported = [];
  const upstream = 'data: {"response":{"candidates":[{"content":{"parts":[{"text":"ok"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":100,"candidatesTokenCount":20,"cachedContentTokenCount":80,"totalTokenCount":120}}}\n\n';
  const gateway = new CodexGateway({
    fetch: async () => new Response(upstream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test',
    onUsage: (metadata, model) => reported.push({ metadata, model })
  });
  gateway.loadAccount = () => ({ id: 'account', token: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project-id';
  const status = await gateway.start({ port });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-3.1-pro-high', input: 'hello', stream: true })
    });
    await response.text();
    assert.equal(reported.length, 1);
    assert.equal(reported[0].metadata.cachedContentTokenCount, 80);
    assert.equal(reported[0].metadata.promptTokenCount, 100);
  } finally {
    await gateway.stop();
  }
});

test('streams Gemini thought parts as Codex reasoning summaries', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-reasoning-stream-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  const upstream = [
    'data: {"response":{"candidates":[{"content":{"parts":[{"thought":true,"text":"正在分析"}]}}]}}',
    'data: {"response":{"candidates":[{"content":{"parts":[{"thought":true,"text":"代码结构"}]}}]}}',
    'data: {"response":{"candidates":[{"content":{"parts":[{"text":"最终答案"}]},"finishReason":"STOP"}]}}',
    ''
  ].join('\n\n');
  const gateway = new CodexGateway({
    fetch: async () => new Response(upstream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project-id';
  const status = await gateway.start({ port });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-3.1-pro-high', input: 'hello', stream: true })
    });
    const text = await response.text();
    assert.match(text, /response\.reasoning_summary_part\.added/);
    assert.match(text, /response\.reasoning_summary_text\.delta/);
    assert.match(text, /正在分析/);
    assert.match(text, /代码结构/);
    assert.match(text, /response\.reasoning_summary_text\.done/);
    assert.match(text, /response\.reasoning_summary_part\.done/);
    assert.match(text, /response\.output_text\.delta/);
    assert.match(text, /最终答案/);
    assert.match(text, /response\.completed/);
  } finally {
    await gateway.stop();
  }
});

test('emits response.failed when upstream finishes without visible output', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-empty-stream-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  const upstream = 'data: {"response":{"candidates":[{"content":{"parts":[{"thought":true,"text":"thinking"}]},"finishReason":"MAX_TOKENS"}]}}\n\n';
  const gateway = new CodexGateway({
    fetch: async () => new Response(upstream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'test',
    clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project-id';
  const status = await gateway.start({ port });
  try {
    const result = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-3.1-pro-high', input: 'hello', stream: true })
    });
    const text = await result.text();
    assert.match(text, /response\.failed/);
    assert.match(text, /MAX_TOKENS|max_output_tokens/);
    assert.doesNotMatch(text, /response\.completed/);
  } finally {
    await gateway.stop();
  }
});

test('completes a stalled Antigravity compaction with a local recovery summary', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-compact-fallback-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  let forwarded = null;
  const upstream = 'data: {"response":{"candidates":[{"content":{"parts":[{"thought":true,"text":"reasoning only"}]}}]}}\n\n';
  const gateway = new CodexGateway({
    fetch: async (_url, options) => {
      forwarded = JSON.parse(options.body);
      return new Response(upstream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'project-id';
  const status = await gateway.start({ port, mode: 'antigravity' });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-sol', stream: true,
        client_metadata: { 'x-codex-turn-metadata': JSON.stringify({ request_kind: 'compaction' }) },
        input: [{ type: 'message', role: 'user', content: [
          { type: 'input_text', text: 'important current task' },
          { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' }
        ] }]
      })
    });
    const text = await response.text();
    assert.match(text, /response\.completed/);
    assert.match(text, /Context recovery summary generated locally/);
    assert.doesNotMatch(text, /response\.failed/);
    assert.equal(JSON.stringify(forwarded).includes('inlineData'), false);
    assert.equal(gateway.status().lastRequest.status, 'fallback');
  } finally {
    await gateway.stop();
  }
});

test('protects custom Responses providers through the local gateway', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-custom-compact-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  let requestedUrl = '';
  let forwarded = null;
  const gateway = new CodexGateway({
    fetch: async (url, options) => {
      requestedUrl = String(url);
      forwarded = JSON.parse(options.body);
      return new Response('event: response.created\ndata: {"type":"response.created"}\n\n', {
        status: 200, headers: { 'Content-Type': 'text/event-stream' }
      });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  const status = await gateway.start({
    port, mode: 'custom', customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'secret', customProviderName: 'Sub2API',
    customModels: ['gpt-5.6-sol'], model: 'gpt-5.6-sol', modelControl: 'client'
  });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.6-sol', stream: true,
        client_metadata: { 'x-codex-turn-metadata': JSON.stringify({ request_kind: 'compaction' }) },
        input: [{ type: 'message', role: 'user', content: [
          { type: 'input_text', text: 'custom provider task' },
          { type: 'input_image', image_url: 'data:image/png;base64,aGVsbG8=' }
        ] }]
      })
    });
    const text = await response.text();
    assert.equal(requestedUrl, 'https://provider.example/v1/responses');
    assert.equal(forwarded.model, 'gpt-5.6-sol');
    assert.equal(JSON.stringify(forwarded).includes('input_image'), false);
    assert.match(text, /response\.completed/);
    assert.match(text, /custom provider task/);
    assert.equal(gateway.status().lastRequest.status, 'fallback');
  } finally {
    await gateway.stop();
  }
});

test('restores an existing custom-provider conversation with incompatible historical item ids', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-custom-history-id-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  let forwarded = null;
  const completed = 'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_ok","status":"completed","output":[]}}\n\n';
  const gateway = new CodexGateway({
    fetch: async (_url, options) => {
      forwarded = JSON.parse(options.body);
      return new Response(completed, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  const status = await gateway.start({
    port, mode: 'custom', customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'secret', customProviderName: 'Sub2API',
    customModels: ['gpt-5.6-sol'], model: 'gpt-5.6-sol', modelControl: 'client'
  });
  try {
    const history = Array.from({ length: 380 }, (_, index) => ({
      type: 'message', role: index % 2 ? 'assistant' : 'user',
      content: [{ type: index % 2 ? 'output_text' : 'input_text', text: `history ${index}` }]
    }));
    history.push({
      type: 'custom_tool_call', id: 'fc_1bc1eaf268808771',
      call_id: 'call_380', name: 'apply_patch', input: '{}'
    });
    history.push({ type: 'custom_tool_call_output', call_id: 'call_380', output: 'done' });

    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.6-sol', stream: true, input: history })
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /response\.completed/);
    assert.equal(forwarded.input[380].id, undefined);
    assert.equal(forwarded.input[380].call_id, 'call_380');
    assert.equal(forwarded.input[381].call_id, 'call_380');
    assert.equal(gateway.status().lastRequest.status, 'completed');
  } finally {
    await gateway.stop();
  }
});

test('switches custom -> Antigravity -> custom without mixing upstream state', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-dual-mode-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  const upstreams = [];
  const customCompleted = 'event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_custom","status":"completed","output":[]}}\n\n';
  const antigravityCompleted = 'data: {"response":{"candidates":[{"content":{"parts":[{"text":"antigravity ok"}]},"finishReason":"STOP"}]}}\n\n';
  const gateway = new CodexGateway({
    fetch: async url => {
      upstreams.push(String(url));
      return String(url).includes('provider.example')
        ? new Response(customCompleted, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
        : new Response(antigravityCompleted, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {}, detail: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'projects/current-account-project';

  const requestLocal = async apiKey => {
    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.6-sol', stream: true, input: 'hello' })
    });
    return { status: response.status, text: await response.text() };
  };

  const customStatus = await gateway.start({
    port, mode: 'custom', customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'secret', customProviderName: 'Sub2API',
    customModels: ['gpt-5.6-sol'], model: 'gpt-5.6-sol', modelControl: 'client'
  });
  try {
    const firstCustom = await requestLocal(customStatus.apiKey);
    assert.equal(firstCustom.status, 200);
    assert.match(firstCustom.text, /response\.completed/);

    await gateway.start({ mode: 'antigravity', model: 'gemini-3.1-pro-high', modelControl: 'gateway' });
    const antigravity = await requestLocal(customStatus.apiKey);
    assert.equal(antigravity.status, 200);
    assert.match(antigravity.text, /antigravity ok/);
    assert.match(antigravity.text, /response\.completed/);

    await gateway.start({ mode: 'custom', model: 'gpt-5.6-sol', modelControl: 'client' });
    const secondCustom = await requestLocal(customStatus.apiKey);
    assert.equal(secondCustom.status, 200);
    assert.match(secondCustom.text, /response\.completed/);

    assert.equal(upstreams.filter(url => url.includes('provider.example')).length, 2);
    assert.equal(upstreams.filter(url => url.includes('cloudcode-pa')).length, 1);
    assert.equal(gateway.status().mode, 'custom');
  } finally {
    await gateway.stop();
  }
});

test('serves Claude Messages through Antigravity even while Codex uses a custom provider', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-claude-isolation-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  let requestedUrl = '';
  let forwarded = null;
  let selectedAccountId = '';
  const upstream = 'data: {"response":{"candidates":[{"content":{"parts":[{"text":"I will inspect it."},{"functionCall":{"name":"read_file","args":{"path":"a.txt"}},"thoughtSignature":"sig-claude"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":50,"candidatesTokenCount":8,"cachedContentTokenCount":20}}}\n\n';
  const gateway = new CodexGateway({
    fetch: async (url, options) => {
      requestedUrl = String(url);
      forwarded = JSON.parse(options.body);
      return new Response(upstream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
    },
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = accountId => {
    selectedAccountId = accountId;
    return { id: accountId || 'account', token: {}, detail: {} };
  };
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'projects/current-account-project';
  const status = await gateway.start({
    port,
    mode: 'custom',
    customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'secret',
    customModels: ['gpt-5.6'],
    model: 'gpt-5.6',
    claudeModel: 'claude-sonnet-4-6'
  });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
      method: 'POST',
      headers: { 'x-api-key': status.apiKey, 'x-agy-account-id': 'claude-selected-account', 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-agy-36fh', max_tokens: 1024, stream: false,
        messages: [{ role: 'user', content: 'Read a.txt' }],
        tools: [{ name: 'read_file', input_schema: {
          type: 'object',
          propertyNames: { pattern: '^[a-z]+$' },
          properties: {
            path: { type: 'string' },
            retries: { type: 'integer', exclusiveMinimum: 0 },
            mode: { anyOf: [{ const: 'safe' }, { type: 'null' }] }
          }
        } }]
      })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.type, 'message');
    assert.equal(body.stop_reason, 'tool_use');
    assert.equal(body.content[0].text, 'I will inspect it.');
    assert.equal(body.content[1].type, 'tool_use');
    assert.equal(body.usage.cache_read_input_tokens, 20);
    assert.equal(selectedAccountId, 'claude-selected-account');
    assert.match(requestedUrl, /cloudcode-pa/);
    assert.doesNotMatch(requestedUrl, /provider\.example/);
    assert.equal(forwarded.model, 'gemini-3.6-flash-high');
    assert.equal(forwarded.request.contents[0].parts[0].text, 'Read a.txt');
    const forwardedSchema = forwarded.request.tools[0].functionDeclarations[0].parameters;
    assert.equal(JSON.stringify(forwardedSchema).includes('propertyNames'), false);
    assert.equal(JSON.stringify(forwardedSchema).includes('exclusiveMinimum'), false);
    assert.equal(JSON.stringify(forwardedSchema).includes('const'), false);
  } finally {
    await gateway.stop();
  }
});

test('streams Anthropic events and supports Claude count_tokens', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-claude-stream-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  const upstream = 'data: {"response":{"candidates":[{"content":{"parts":[{"text":"hello "},{"text":"Claude"}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":12,"candidatesTokenCount":3}}}\n\n';
  const gateway = new CodexGateway({
    fetch: async () => new Response(upstream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    accountRoot: root, stateDir: root, decryptToken: value => value,
    clientId: 'test', clientSecret: 'test'
  });
  gateway.loadAccount = () => ({ id: 'account', token: {}, detail: {} });
  gateway.getAccessToken = async () => 'access-token';
  gateway.getProjectId = async () => 'projects/current-account-project';
  const status = await gateway.start({ port, claudeModel: 'claude-sonnet-4-6' });
  try {
    const countResponse = await fetch(`http://127.0.0.1:${port}/v1/messages/count_tokens`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello Claude' }] })
    });
    const count = await countResponse.json();
    assert.equal(countResponse.status, 200);
    assert.ok(count.input_tokens > 0);

    const response = await fetch(`http://127.0.0.1:${port}/v1/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 128, stream: true, messages: [{ role: 'user', content: 'hello' }] })
    });
    const text = await response.text();
    assert.equal(response.status, 200);
    assert.match(text, /event: message_start/);
    assert.match(text, /event: content_block_delta/);
    assert.match(text, /hello /);
    assert.match(text, /Claude/);
    assert.match(text, /event: message_stop/);
    assert.doesNotMatch(text, /response\.output_text/);
  } finally {
    await gateway.stop();
  }
});

test('preserves unrelated TOML while replacing managed provider', () => {
  const existing = 'approval_policy = "on-request"\n[features]\nweb_search = true\n\n[model_providers.agy_hub]\nbase_url = "old"\n';
  const result = buildCodexConfig(existing, { baseUrl: 'http://127.0.0.1:8046/v1', apiKey: 'sk-test', model: 'gemini-3.1-pro-high' });
  assert.match(result, /approval_policy = "on-request"/);
  assert.match(result, /\[features\]\nweb_search = true/);
  assert.doesNotMatch(result, /\[model_providers\.agy_hub\]/);
  assert.equal((result.match(/\[model_providers\.codex_local_access\]/g) || []).length, 1);
  assert.match(result, /wire_api = "responses"/);
  assert.match(result, /requires_openai_auth = false/);
  assert.match(result, /model_catalog_json = "agy-hub-model-catalog\.json"/);
});

test('backs up and restores Codex config', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-codex-config-'));
  const codexHome = path.join(root, '.codex');
  const stateDir = path.join(root, 'state');
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(path.join(codexHome, 'config.toml'), 'model = "official"\n', 'utf8');
  fs.writeFileSync(path.join(codexHome, 'auth.json'), '{"tokens":{"access_token":"keep"}}\n', 'utf8');
  connectCodex({ codexHome, stateDir, baseUrl: 'http://127.0.0.1:8046/v1', apiKey: 'sk-test', model: 'gemini-3.1-pro-high' });
  connectCodex({ codexHome, stateDir, baseUrl: 'http://127.0.0.1:9000/v1', apiKey: 'sk-new', model: 'gemini-3.6-flash' });
  assert.match(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), /model_provider = "codex_local_access"/);
  assert.match(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), /127\.0\.0\.1:9000/);
  assert.match(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), /model_catalog_json = "agy-hub-model-catalog-[a-f0-9]{12}\.json"/);
  assert.match(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), /requires_openai_auth = false/);
  const catalogPath = JSON.parse(fs.readFileSync(path.join(stateDir, 'codex-connection.json'), 'utf8')).catalogs[1].catalogPath;
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  assert.ok(catalog.models.length >= 1);
  assert.deepEqual(catalog.models[0].input_modalities, ['text', 'image']);
  assert.equal(catalog.models[0].context_window, 1000000);
  assert.equal(JSON.parse(fs.readFileSync(path.join(codexHome, 'auth.json'), 'utf8')).tokens.access_token, 'keep');
  restoreCodex({ stateDir });
  assert.equal(fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8'), 'model = "official"\n');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(codexHome, 'auth.json'), 'utf8')), { tokens: { access_token: 'keep' } });
  assert.equal(fs.existsSync(catalogPath), false);
});

test('writes a Responses-compatible custom Codex provider and model catalog', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-custom-provider-'));
  const codexHome = path.join(root, '.codex');
  const stateDir = path.join(root, 'state');
  fs.mkdirSync(codexHome, { recursive: true });
  connectCodex({
    codexHome,
    stateDir,
    baseUrl: 'http://localhost:8080/v1',
    apiKey: 'sub2api-key',
    model: 'gpt-5.6',
    models: ['gpt-5.6', 'gpt-5.3-codex'],
    protocol: 'responses',
    providerName: 'Sub2API',
    requiresOpenAIAuth: false,
    contextWindow: 300000
  });
  const config = fs.readFileSync(path.join(codexHome, 'config.toml'), 'utf8');
  assert.match(config, /name = "Sub2API"/);
  assert.match(config, /base_url = "http:\/\/localhost:8080\/v1"/);
  assert.match(config, /wire_api = "responses"/);
  assert.match(config, /requires_openai_auth = false/);
  assert.match(config, /request_max_retries = 1/);
  assert.match(config, /stream_max_retries = 1/);
  assert.match(config, /stream_idle_timeout_ms = 120000/);
  const configCatalogPath = path.join(codexHome, /model_catalog_json = "([^"]+)"/.exec(config)[1]);
  const catalog = JSON.parse(fs.readFileSync(configCatalogPath, 'utf8'));
  assert.deepEqual(catalog.models.map(item => item.slug), ['gpt-5.6', 'gpt-5.3-codex']);
  assert.equal(catalog.models[0].context_window, 300000);
  assert.equal(catalog.models[0].auto_compact_token_limit, 240000);
});

test('publishes a complete model catalog before config.toml references it', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-catalog-publish-order-'));
  const codexHome = path.join(root, '.codex');
  const stateDir = path.join(root, 'state');
  const configPath = path.join(codexHome, 'config.toml');
  fs.mkdirSync(codexHome, { recursive: true });

  const originalRenameSync = fs.renameSync;
  let checkedAtConfigPublish = false;
  fs.renameSync = function observeConfigPublish(source, target) {
    if (path.resolve(target) === path.resolve(configPath)) {
      const pendingConfig = fs.readFileSync(source, 'utf8');
      const match = /model_catalog_json = "([^"]+)"/.exec(pendingConfig);
      assert.ok(match, 'config.toml should reference a model catalog');
      const catalogPath = path.join(codexHome, match[1]);
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      assert.ok(Array.isArray(catalog.models) && catalog.models.length > 0);
      checkedAtConfigPublish = true;
    }
    return originalRenameSync.call(fs, source, target);
  };

  try {
    connectCodex({
      codexHome,
      stateDir,
      baseUrl: 'http://127.0.0.1:8046/v1',
      apiKey: 'sk-test',
      model: 'gpt-5.6',
      models: ['gpt-5.6'],
      providerName: 'Sub2API',
      contextWindow: 300000
    });
  } finally {
    fs.renameSync = originalRenameSync;
  }

  assert.equal(checkedAtConfigPublish, true);
});

test('persists reusable custom provider profiles', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-provider-profiles-'));
  const saved = saveProfile(root, {
    providerName: 'Local Sub2API', protocol: 'responses', baseUrl: 'http://127.0.0.1:8080/v1',
    apiKey: 'local-key', modelMode: 'custom', models: ['model-a', 'model-b'], model: 'model-a'
  });
  assert.ok(saved.id);
  assert.equal(readProfiles(root).length, 1);
  const updated = saveProfile(root, { ...saved, providerName: 'Updated Provider' });
  assert.equal(readProfiles(root)[0].providerName, 'Updated Provider');
  deleteProfile(root, updated.id);
  assert.deepEqual(readProfiles(root), []);
});

test('retries a custom provider once only when connection establishment is refused before headers', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-custom-retry-'));
  let calls = 0;
  const gateway = new CodexGateway({
    fetch: async () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      return new Response(JSON.stringify({ id: 'resp_ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    },
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'client',
    clientSecret: 'secret'
  });
  gateway.configure({
    mode: 'custom',
    customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'secret',
    customProviderName: 'Sub2API',
    customModels: ['gpt-5.6-sol'],
    model: 'gpt-5.6-sol'
  });

  const upstream = await gateway.openCustomUpstream({ model: 'gpt-5.6-sol', stream: false, input: [] });
  assert.equal(calls, 2);
  assert.equal(upstream.response.status, 200);
  assert.match(fs.readFileSync(path.join(root, 'codex-gateway.log'), 'utf8'), /custom\.upstream_retry/);
});

test('does not retry an accepted upstream 502 and returns a concise error instead of Cloudflare HTML', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-custom-502-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  let calls = 0;
  const html = '<!DOCTYPE html><html><head><title>niu1029.ccwu.cc | 502: Bad gateway</title></head><body><div id="cf-error-details">Cloudflare</div></body></html>';
  const gateway = new CodexGateway({
    fetch: async () => {
      calls += 1;
      return new Response(html, { status: 502, headers: { 'Content-Type': 'text/html' } });
    },
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'client',
    clientSecret: 'secret'
  });
  const status = await gateway.start({
    port,
    mode: 'custom',
    customBaseUrl: 'https://niu1029.ccwu.cc/v1',
    customApiKey: 'secret',
    customProviderName: 'Sub2API',
    customModels: ['gpt-5.6-sol'],
    model: 'gpt-5.6-sol'
  });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.6-sol', stream: true, input: [{ role: 'user', content: 'test' }] })
    });
    const body = await response.text();
    assert.equal(calls, 1);
    assert.equal(response.status, 502);
    assert.doesNotMatch(body, /<!DOCTYPE html>/i);
    assert.match(body, /Cloudflare.*源站|Cloudflare/i);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'codex-gateway.log'), 'utf8'), /custom\.upstream_retry/);
  } finally {
    await gateway.stop();
  }
});

test('does not replay a generation after response headers were accepted but the stream failed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-custom-stream-retry-'));
  const port = 30000 + Math.floor(Math.random() * 10000);
  let calls = 0;
  const gateway = new CodexGateway({
    fetch: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(new ReadableStream({
          start(controller) { controller.error(new Error('net::ERR_CONNECTION_CLOSED')); }
        }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
      }
      return new Response('event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_retry_ok"}}\n\n', {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' }
      });
    },
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'client',
    clientSecret: 'secret'
  });
  const status = await gateway.start({
    port,
    mode: 'custom',
    customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'secret',
    customProviderName: 'Sub2API',
    customModels: ['gpt-5.6-sol'],
    model: 'gpt-5.6-sol'
  });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/v1/responses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${status.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.6-sol', stream: true, input: [{ role: 'user', content: 'test' }] })
    });
    const body = await response.text();
    assert.equal(response.status, 502);
    assert.equal(calls, 1);
    assert.doesNotMatch(body, /response\.completed/);
    assert.doesNotMatch(fs.readFileSync(path.join(root, 'codex-gateway.log'), 'utf8'), /custom\.stream_retry/);
  } finally {
    await gateway.stop();
  }
});


test('filters Codex aliases against a live Antigravity catalog and reuses free allowlisted slots for new models', () => {
  const live = ['agy-auto', 'gemini-3.6-flash-high', 'claude-sonnet-4-6', 'gemini-4-new-agent'];
  const aliases = codexVisibleModelAliasesForModels(live);
  assert.equal(aliases['gpt-5.6-sol'], 'gemini-3.6-flash-high');
  assert.equal(aliases['gpt-5.4-mini'], 'claude-sonnet-4-6');
  assert.ok(Object.values(aliases).includes('gemini-4-new-agent'));
  const catalog = buildAntigravityCodexModelsResponse({ models: live });
  assert.deepEqual(catalog.models.map(item => item.display_name).sort(), [
    'Claude Sonnet 4.6 (Thinking)', 'Gemini 3.6 Flash (High)', 'gemini-4-new-agent'
  ].sort());
});
