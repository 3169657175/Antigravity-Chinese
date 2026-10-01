const crypto = require('crypto');
const { MODELS, parseUpstreamEvents, collectParts, classifyUpstreamError } = require('./codexGateway');
const { codexAliasForModel } = require('./codexModels');
const { routeForClaudeModel } = require('./claudeModelRoutes');
const { PROFILE_IDS } = require('./gatewayProfiles');
const { discoverModels, fetchResponsesCompatible } = require('./providerProtocol.js');

const LEVELS = Object.freeze({
  NETWORK: 'network',
  MODEL: 'model',
  CLIENT: 'client'
});

function configFingerprint(gateway) {
  if (typeof gateway.configurationFingerprint === 'function') return gateway.configurationFingerprint();
  return JSON.stringify(gateway.config || {});
}

function createReport(target) {
  return {
    id: `diag_${crypto.randomBytes(8).toString('hex')}`,
    target,
    startedAt: new Date().toISOString(),
    steps: [],
    success: false,
    configPreserved: false
  };
}

async function executeStep(report, id, label, action) {
  const startedAt = Date.now();
  try {
    const details = await action();
    const step = {
      id,
      label,
      status: 'passed',
      durationMs: Date.now() - startedAt,
      message: details?.message || `${label}通过`,
      details: details?.details || {}
    };
    report.steps.push(step);
    return details || {};
  } catch (error) {
    const diagnostic = classifyUpstreamError(error);
    report.steps.push({
      id,
      label,
      status: 'failed',
      durationMs: Date.now() - startedAt,
      message: diagnostic.message,
      details: { code: diagnostic.code, retryable: diagnostic.retryable }
    });
    return { error, diagnostic };
  }
}

function finishReport(report, beforeFingerprint, gateway) {
  report.completedAt = new Date().toISOString();
  report.durationMs = Date.parse(report.completedAt) - Date.parse(report.startedAt);
  report.configPreserved = beforeFingerprint === configFingerprint(gateway);
  if (!report.configPreserved) {
    report.steps.push({
      id: 'isolation',
      label: '配置隔离',
      status: 'failed',
      durationMs: 0,
      message: '测试前后网关配置不一致，已拒绝标记为成功',
      details: { code: 'route_mutated', retryable: false }
    });
  } else {
    report.steps.push({
      id: 'isolation',
      label: '配置隔离',
      status: 'passed',
      durationMs: 0,
      message: '测试未改变账号、模型或 Provider 路由',
      details: {}
    });
  }
  report.success = report.steps.every(step => step.status === 'passed');
  report.levelReached = report.steps.filter(step => step.status === 'passed' && step.id !== 'isolation').length;
  const failed = report.steps.find(step => step.status === 'failed');
  report.summary = report.success
    ? '三级测试全部通过'
    : `${failed?.label || '测试'}未通过：${failed?.message || '未知错误'}`;
  return report;
}

function requireRunning(status) {
  if (!status.running) throw new Error('本地 8046 服务尚未启动，请先点击“启动服务”');
}

function requireOk(response, label, body) {
  if (!response.ok) throw new Error(`${label}返回 HTTP ${response.status}: ${String(body || '').slice(0, 500)}`);
}

function visibleCloudCodeResult(result) {
  const payloads = parseUpstreamEvents(result.text);
  const parts = collectParts(payloads);
  const text = parts.filter(part => part && typeof part.text === 'string' && !part.thought)
    .map(part => part.text).join('');
  const accepted = payloads.length > 0 && (parts.length > 0 || payloads.some(payload => {
    const root = payload && payload.response ? payload.response : payload;
    return root && (root.usageMetadata || (Array.isArray(root.candidates) && root.candidates.length));
  }));
  if (!accepted) throw new Error('上游接受了连接，但没有返回可识别的模型事件');
  return { payloads, parts, text };
}

async function runCodexThreeLevelTest({ gateway, fetch, settings = {} }) {
  const report = createReport('codex-antigravity');
  const before = configFingerprint(gateway);
  const status = gateway.status();
  const profile = status.profiles?.codexAntigravity || {};
  const requested = String(settings.model || profile.model || 'gemini-3.1-pro-high');
  const autoResolved = String(settings.autoResolvedModel || profile.autoResolvedModel || 'gemini-3.1-pro-high');
  const model = requested === 'agy-auto' ? autoResolved : requested;
  const supportedModels = Array.isArray(status.antigravityModels) && status.antigravityModels.length
    ? status.antigravityModels
    : MODELS;
  if (!supportedModels.includes(model) || model === 'agy-auto') throw new Error(`不支持的 Antigravity 模型：${model}`);

  await executeStep(report, LEVELS.NETWORK, '第 1 级：端口与鉴权', async () => {
    requireRunning(status);
    const response = await fetch(`${status.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${status.apiKey}` }
    });
    const body = await response.text();
    requireOk(response, '本地模型目录', body);
    const parsed = JSON.parse(body);
    const count = Array.isArray(parsed.models) ? parsed.models.length : Array.isArray(parsed.data) ? parsed.data.length : 0;
    if (!count) throw new Error('本地模型目录为空');
    return { message: `8046 端口、API Key 与模型目录正常（${count} 个模型）`, details: { modelCount: count } };
  });

  const modelResult = await executeStep(report, LEVELS.MODEL, '第 2 级：真实模型响应', async () => {
    const result = await gateway.probeUpstream({
      model,
      input: '不要调用工具，请简短回复：连接正常',
      max_output_tokens: 1024,
      stream: false
    }, undefined, {
      modelOverride: model,
      accountId: settings.accountId,
      profileId: PROFILE_IDS.CODEX_ANTIGRAVITY
    });
    const visible = visibleCloudCodeResult(result);
    return {
      message: `真实上游 ${result.resolvedModel || result.model} 已返回有效内容`,
      details: {
        model,
        upstreamModel: result.resolvedModel || result.model,
        outputChars: visible.text.length,
        matched: /连接正常|AGY_OK/i.test(visible.text)
      }
    };
  });

  const clientResult = await executeStep(report, LEVELS.CLIENT, '第 3 级：Codex 客户端兼容', async () => {
    requireRunning(status);
    const response = await fetch(`${status.baseUrl}/responses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${status.apiKey}`,
        'x-agy-account-id': String(settings.accountId || '')
      },
      body: JSON.stringify({
        model: codexAliasForModel(model),
        input: [{ role: 'user', content: [{ type: 'input_text', text: '不要调用工具，只回复：CLIENT_OK' }] }],
        tools: [{
          type: 'function',
          name: 'agy_client_compatibility_probe',
          description: 'Verifies Codex tool schema compatibility without calling the tool.',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              files: { type: 'array', items: { type: 'string' } },
              mode: { type: 'string', enum: ['safe'] }
            }
          }
        }],
        max_output_tokens: 1024,
        stream: false,
        store: false
      })
    });
    const body = await response.text();
    requireOk(response, 'Codex 兼容请求', body);
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed.output) || !parsed.output.length) throw new Error('Codex 兼容请求没有返回 output');
    return {
      message: 'Responses 请求、工具 Schema 与完整响应结构通过',
      details: { responseId: parsed.id || '', outputItems: parsed.output.length }
    };
  });

  const modelDetails = modelResult.error ? {} : modelResult.details || {};
  const clientDetails = clientResult.error ? {} : clientResult.details || {};
  const final = finishReport(report, before, gateway);
  return {
    success: final.success,
    error: final.success ? '' : final.summary,
    report: final,
    model,
    upstreamModel: modelDetails.upstreamModel || model,
    outputChars: modelDetails.outputChars || 0,
    matched: Boolean(modelDetails.matched),
    routePreserved: final.configPreserved,
    responseId: clientDetails.responseId || '',
    message: final.summary
  };
}

async function runClaudeThreeLevelTest({ gateway, fetch, settings = {} }) {
  const report = createReport('claude-antigravity');
  const before = configFingerprint(gateway);
  const status = gateway.status();
  const profile = status.profiles?.claudeAntigravity || {};
  const requested = String(settings.claudeModel || profile.model || 'claude-sonnet-4-6');
  const model = requested === 'agy-auto'
    ? String(settings.autoResolvedModel || profile.autoResolvedModel || 'gemini-3.1-pro-high')
    : requested;
  const supportedModels = Array.isArray(status.antigravityModels) && status.antigravityModels.length
    ? status.antigravityModels
    : MODELS;
  if (!supportedModels.includes(model) || model === 'agy-auto') throw new Error(`不支持的 Claude Code 上游模型：${model}`);

  const networkResult = await executeStep(report, LEVELS.NETWORK, '第 1 级：端口与 Anthropic 鉴权', async () => {
    requireRunning(status);
    const response = await fetch(`${status.claudeBaseUrl}/v1/messages/count_tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': status.apiKey,
        'x-agy-account-id': String(settings.accountId || '')
      },
      body: JSON.stringify({ model: routeForClaudeModel(model), messages: [{ role: 'user', content: '连接检查' }] })
    });
    const body = await response.text();
    requireOk(response, 'Anthropic count_tokens', body);
    const parsed = JSON.parse(body);
    if (!Number.isFinite(parsed.input_tokens)) throw new Error('Anthropic Token 计数格式不正确');
    return { message: `8046 Anthropic 端口与 API Key 正常（${parsed.input_tokens} Token）`, details: parsed };
  });

  const modelResult = await executeStep(report, LEVELS.MODEL, '第 2 级：真实模型响应', async () => {
    const result = await gateway.probeUpstream({
      model,
      input: '不要调用工具，请简短回复：连接正常',
      max_output_tokens: 1024,
      stream: false
    }, undefined, {
      modelOverride: model,
      accountId: settings.accountId,
      profileId: PROFILE_IDS.CLAUDE_ANTIGRAVITY
    });
    const visible = visibleCloudCodeResult(result);
    return {
      message: `真实上游 ${result.resolvedModel || result.model} 已返回有效内容`,
      details: { upstreamModel: result.resolvedModel || result.model, outputChars: visible.text.length }
    };
  });

  const clientResult = await executeStep(report, LEVELS.CLIENT, '第 3 级：Claude 工具兼容', async () => {
    requireRunning(status);
    const response = await fetch(`${status.claudeBaseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': status.apiKey,
        'x-agy-account-id': String(settings.accountId || '')
      },
      body: JSON.stringify({
        model: routeForClaudeModel(model),
        max_tokens: 1024,
        stream: false,
        messages: [{ role: 'user', content: '不要调用工具，只回复：CLAUDE_CLIENT_OK' }],
        tools: [{
          name: 'agy_schema_compatibility_probe',
          description: 'Only used to verify Claude tool schema compatibility.',
          input_schema: {
            $schema: 'https://json-schema.org/draft/2020-12/schema',
            type: 'object',
            propertyNames: { pattern: '^[a-z]+$' },
            additionalProperties: false,
            properties: {
              files: { type: 'object', additionalProperties: { type: 'string' } },
              retries: { type: 'integer', exclusiveMinimum: 0 },
              mode: { anyOf: [{ const: 'safe' }, { type: 'null' }] }
            }
          }
        }]
      })
    });
    const body = await response.text();
    requireOk(response, 'Claude 工具兼容请求', body);
    const parsed = JSON.parse(body);
    if (!Array.isArray(parsed.content) || !parsed.content.length) throw new Error('Claude 兼容请求没有返回 content');
    return {
      message: 'Anthropic Messages、复杂工具 Schema 与模型映射通过',
      details: { messageId: parsed.id || '', outputItems: parsed.content.length, upstreamModel: parsed.model || model }
    };
  });

  const final = finishReport(report, before, gateway);
  return {
    success: final.success,
    error: final.success ? '' : final.summary,
    report: final,
    inputTokens: networkResult.error ? 0 : Number(networkResult.details?.input_tokens) || 0,
    model,
    upstreamModel: clientResult.error
      ? (modelResult.details?.upstreamModel || model)
      : (clientResult.details?.upstreamModel || model),
    outputChars: modelResult.error ? 0 : Number(modelResult.details?.outputChars) || 0,
    toolSchemaCompatible: !clientResult.error,
    routePreserved: final.configPreserved
  };
}

async function runCustomProviderThreeLevelTest({ fetch, config }) {
  const report = createReport('codex-custom');

  await executeStep(report, LEVELS.NETWORK, '第 1 级：Provider 网络与鉴权', async () => {
    const discovered = await discoverModels(fetch, config);
    return { message: `Provider 鉴权正常，发现 ${discovered.models.length} 个模型`, details: { status: discovered.status, modelCount: discovered.models.length } };
  });

  const modelResult = await executeStep(report, LEVELS.MODEL, '第 2 级：Responses 模型响应', async () => {
    const response = await fetchResponsesCompatible(fetch, config, {
        model: config.model,
        input: 'Reply with exactly: AGY_PROVIDER_OK',
        max_output_tokens: 64,
        stream: false,
        store: false
      });
    const body = await response.text();
    requireOk(response, 'Provider Responses', body);
    if (!body.trim()) throw new Error('Provider 返回了空响应');
    return { message: `${config.model} 已返回有效 Responses 内容`, details: { status: response.status, matched: /AGY_PROVIDER_OK/i.test(body) } };
  });

  await executeStep(report, LEVELS.CLIENT, '第 3 级：Codex 工具与历史兼容', async () => {
    const response = await fetchResponsesCompatible(fetch, config, {
        model: config.model,
        input: [{ role: 'user', content: [{ type: 'input_text', text: '不要调用工具，只回复：CUSTOM_CLIENT_OK' }] }],
        tools: [{
          type: 'function',
          name: 'agy_custom_provider_probe',
          description: 'Verifies Responses tool schema compatibility.',
          parameters: { type: 'object', additionalProperties: false, properties: { value: { type: 'string' } } }
        }],
        max_output_tokens: 128,
        stream: false,
        store: false
      });
    const body = await response.text();
    requireOk(response, 'Provider 客户端兼容请求', body);
    if (!body.trim()) throw new Error('Provider 客户端兼容请求返回空响应');
    return { message: `${config.protocol} 协议转换、工具 Schema 与结构化历史请求通过`, details: { status: response.status, protocol: config.protocol } };
  });

  report.completedAt = new Date().toISOString();
  report.durationMs = Date.parse(report.completedAt) - Date.parse(report.startedAt);
  report.configPreserved = true;
  report.success = report.steps.every(step => step.status === 'passed');
  report.levelReached = report.steps.filter(step => step.status === 'passed').length;
  const failed = report.steps.find(step => step.status === 'failed');
  report.summary = report.success ? '三级测试全部通过' : `${failed.label}未通过：${failed.message}`;
  return {
    success: report.success,
    error: report.success ? '' : report.summary,
    report,
    status: modelResult.details?.status || 0,
    model: config.model,
    baseUrl: config.baseUrl,
    matched: Boolean(modelResult.details?.matched)
  };
}

module.exports = {
  LEVELS,
  executeStep,
  finishReport,
  runCodexThreeLevelTest,
  runClaudeThreeLevelTest,
  runCustomProviderThreeLevelTest
};
