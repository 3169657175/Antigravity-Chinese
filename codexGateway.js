const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  MODELS,
  CODEX_VISIBLE_MODEL_ALIASES,
  CUSTOM_PROVIDER_CONTEXT_WINDOW,
  CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT,
  ANTIGRAVITY_CONTEXT_WINDOW,
  ANTIGRAVITY_AUTO_COMPACT_PERCENT,
  buildCodexModelsResponse,
  buildAntigravityCodexModelsResponse,
  codexVisibleModelAliasesForModels,
  resolveCodexModelAlias
} = require('./codexModels');
const {
  configureAntigravityModelCatalog,
  getAntigravityModelCatalog,
  describeAntigravityModels,
  resolveAntigravityUpstreamModel
} = require('./antigravityModelCatalog');
const {
  anthropicToResponsesRequest,
  estimateAnthropicInputTokens,
  createAnthropicMessage,
  streamAnthropicResponse,
  anthropicError,
  isLocalGatewayAuthorized
} = require('./anthropicGateway');
const { modelForClaudeRoute } = require('./claudeModelRoutes');
const {
  PROFILE_IDS,
  normalizeGatewayConfig,
  configureGatewayConfig,
  activeCodexProfileId,
  profile,
  publicProfiles
} = require('./gatewayProfiles');
const { RequestBodyError, jsonError, decodeRequestBody, readJson, codexRequestMetadata } = require('./gatewayHttp.js');
const { canRetryGeneration, retryDiagnostic } = require('./retryPolicy.js');
const { readJsonSafe } = require('./fsUtils.js');
const { GatewayConfigStore } = require('./gatewayConfigStore.js');
const { fetchResponsesCompatible } = require('./providerProtocol.js');
const { optimizeCustomRequestBody, responsesRequestReadLimit } = require('./customContextBudget.js');
const {
  truncateForCompaction,
  cleanSchema,
  toClaudeSafeSchema,
  outputToText,
  toolDeclarations,
  convertResponsesRequest
} = require('./responsesRequestAdapter.js');

const DEFAULT_PORT = 8046;
const DEFAULT_MODEL = 'gemini-3.8-flash-high';
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';
const COMPACTION_TIMEOUT_MS = 4 * 60 * 1000;
const NORMAL_TIMEOUT_MS = 30 * 60 * 1000;
const COMPACTION_IDLE_TIMEOUT_MS = 90 * 1000;
const COMPACTION_TOOL_OUTPUT_CHARS = 12000;
const UPSTREAMS = [
  'https://daily-cloudcode-pa.sandbox.googleapis.com',
  'https://daily-cloudcode-pa.googleapis.com',
  'https://cloudcode-pa.googleapis.com'
];

function detectAntigravityHubVersion() {
  const fallback = '2.17.0';
  try {
    const resources = String(process.resourcesPath || '');
    const manifestPath = resources ? path.join(resources, 'patch', 'patch-manifest.json') : '';
    if (manifestPath && fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const version = String(manifest.clientVersion || '').trim();
      if (/^\d+\.\d+\.\d+$/.test(version)) return version;
    }
  } catch (_) {}
  return fallback;
}

const ANTIGRAVITY_HUB_VERSION = detectAntigravityHubVersion();
const ANTIGRAVITY_USER_AGENT = `antigravity/hub/${ANTIGRAVITY_HUB_VERSION} windows/amd64`;

function requestedThinkingLevel(model, body = {}) {
  const modelLevel = /-(high|medium|low)$/i.exec(String(model || ''))?.[1]?.toLowerCase() || '';
  if (['low', 'medium', 'high'].includes(modelLevel)) return modelLevel;
  const effort = String(body.reasoning?.effort || body.reasoning_effort || '').toLowerCase();
  return ['low', 'medium', 'high'].includes(effort) ? effort : '';
}

function isCompactionRequest(req, body) {
  const metadata = codexRequestMetadata(req, body);
  return metadata && (metadata.request_kind === 'compaction' || metadata.subagent_kind === 'compact');
}

function isUserProjectDenied(value) {
  const text = String(value || '');
  return /USER_PROJECT_DENIED/i.test(text)
    || /Project\s+['"][^'"]+['"]\s+not found or deleted/i.test(text);
}

function isUserLocationUnsupported(value) {
  return /User location is not supported for the API use|location is not supported.*API|API use.*location is not supported/i
    .test(String(value || ''));
}
function optimizeCompactionBody(body) {
  const input = Array.isArray(body && body.input) ? body.input.map(item => {
    if (!item || typeof item !== 'object') return item;
    if (item.type === 'message' || item.role) {
      const content = Array.isArray(item.content) ? item.content.reduce((result, part) => {
        if (!part || typeof part !== 'object') return result;
        if (part.type === 'input_image') {
          if (!result.some(value => value && value.type === 'input_text' && value.text === '[Image omitted during context compaction]')) {
            result.push({ type: 'input_text', text: '[Image omitted during context compaction]' });
          }
          return result;
        }
        result.push(part);
        return result;
      }, []) : item.content;
      return { ...item, content };
    }
    if (['function_call_output', 'custom_tool_call_output'].includes(item.type)) {
      return { ...item, output: truncateForCompaction(outputToText(item.output)) };
    }
    if (item.type === 'custom_tool_call' && typeof item.input === 'string') {
      return { ...item, input: truncateForCompaction(item.input) };
    }
    if (item.type === 'function_call' && typeof item.arguments === 'string') {
      return { ...item, arguments: truncateForCompaction(item.arguments) };
    }
    return item;
  }) : body.input;
  return {
    ...body,
    input,
    tools: [],
    parallel_tool_calls: false,
    max_output_tokens: Math.min(Math.max(Number(body.max_output_tokens) || 8192, 2048), 8192)
  };
}

const RESPONSE_ITEM_ID_PREFIXES = Object.freeze({
  function_call: 'fc_',
  custom_tool_call: 'ctc_'
});

function sanitizeResponsesHistoryIds(body) {
  if (!body || !Array.isArray(body.input)) return body;
  let changed = false;
  const input = body.input.map(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') return item;
    const expectedPrefix = RESPONSE_ITEM_ID_PREFIXES[item.type];
    if (!expectedPrefix || item.id.startsWith(expectedPrefix)) return item;

    // `id` identifies the provider-owned response item. It is not the tool-call
    // pairing key (`call_id`), so dropping an incompatible replayed id keeps the
    // conversation intact while allowing the upstream to assign a valid id.
    const sanitized = { ...item };
    delete sanitized.id;
    changed = true;
    return sanitized;
  });
  return changed ? { ...body, input } : body;
}

function mapModel(model) {
  return resolveAntigravityUpstreamModel(String(model || DEFAULT_MODEL));
}

function normalizeStoredModel(model) {
  const value = String(model || '');
  if (value === 'gemini-3.5-flash-low') return 'gemini-3.5-flash-lite';
  return value;
}

function classifyUpstreamError(value) {
  const raw = String(value && value.message || value || '');
  const model = /"model"\s*:\s*"([^"]+)"/i.exec(raw)?.[1] || '';
  const reset = /Resets? in ([^.\n]+)/i.exec(raw)?.[1]
    || /"quotaResetDelay"\s*:\s*"([^"]+)"/i.exec(raw)?.[1]
    || '';
  if (/MODEL_CAPACITY_EXHAUSTED|No capacity available/i.test(raw)) {
    return { code: 'capacity_exhausted', retryable: true, model, message: `${model || '所选模型'}当前服务器容量不足，请稍后重试` };
  }
  if (/QUOTA_EXHAUSTED|Individual quota reached|\b429\b/i.test(raw)) {
    return { code: 'quota_exhausted', retryable: true, model, reset, message: `${model || '所选模型'}额度已用尽${reset ? `，预计 ${reset} 后恢复` : ''}` };
  }
  if (/USER_PROJECT_DENIED|not found or deleted/i.test(raw)) {
    return { code: 'project_rejected', retryable: true, model, message: '当前账号的 Cloud Code 项目已失效，网关将刷新项目后重试' };
  }
  if (/\b404\b|"status"\s*:\s*"NOT_FOUND"/i.test(raw)) {
    return { code: 'model_not_found', retryable: false, model, message: `${model || '该模型 ID'}当前未在 Antigravity Cloud Code 开放` };
  }
  if (/tool_use\.id: Field required/i.test(raw)) {
    return { code: 'tool_call_id_missing', retryable: false, model, message: '长对话中存在缺失 ID 的工具调用历史，已记录为兼容性错误' };
  }
  if (/each tool_use must have a single result|multiple `tool_result`/i.test(raw)) {
    return { code: 'duplicate_tool_result', retryable: false, model, message: '长对话中同一个工具调用包含重复结果，已记录为兼容性错误' };
  }
  if (isUserLocationUnsupported(raw)) {
    return {
      code: 'unsupported_location',
      retryable: false,
      model,
      message: '当前网络出口地区不受 Antigravity Cloud Code 支持，请检查系统代理或 VPN 是否生效，并切换到官方支持的网络地区后重试'
    };
  }
  if (/INVALID_ARGUMENT|\b400\b/i.test(raw)) {
    const upstreamMessage = /"message"\s*:\s*"([^"]+)"/i.exec(raw)?.[1] || '';
    return {
      code: 'invalid_argument',
      retryable: false,
      model,
      message: upstreamMessage ? `上游拒绝了当前请求：${upstreamMessage}` : '上游拒绝了当前请求格式，请检查模型参数或长对话历史'
    };
  }
  if (/ECONN|network|fetch failed|socket/i.test(raw)) {
    return { code: 'network_error', retryable: true, model, message: '连接 Antigravity Cloud Code 失败，请检查网络后重试' };
  }
  if (/timeout|超时|超过.*分钟|idle/i.test(raw)) {
    return { code: 'timeout', retryable: true, model, message: '上游响应超时，请稍后重试' };
  }
  return { code: 'upstream_error', retryable: false, model, message: raw || 'Antigravity Cloud Code 请求失败' };
}

function stableToolCallId(item, index) {
  const seed = JSON.stringify({
    index,
    type: item && item.type,
    name: item && item.name,
    arguments: item && item.arguments,
    input: item && item.input
  });
  return `call_${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)}`;
}

function normalizeResponsesToolHistory(body) {
  if (!body || !Array.isArray(body.input)) return body;
  let changed = false;
  const knownCalls = new Set();
  const normalizedCalls = [];

  body.input.forEach((item, index) => {
    if (!item || typeof item !== 'object' || !['function_call', 'custom_tool_call', 'local_shell_call'].includes(item.type)) {
      normalizedCalls.push(item);
      return;
    }
    const callId = String(item.call_id || item.id || stableToolCallId(item, index));
    if (knownCalls.has(callId)) {
      changed = true;
      return;
    }
    knownCalls.add(callId);
    if (item.call_id === callId) normalizedCalls.push(item);
    else {
      normalizedCalls.push({ ...item, call_id: callId });
      changed = true;
    }
  });

  const lastResultIndex = new Map();
  normalizedCalls.forEach((item, index) => {
    if (item && ['function_call_output', 'custom_tool_call_output'].includes(item.type) && item.call_id) {
      lastResultIndex.set(String(item.call_id), index);
    }
  });

  const input = [];
  normalizedCalls.forEach((item, index) => {
    if (!item || !['function_call_output', 'custom_tool_call_output'].includes(item.type)) {
      input.push(item);
      return;
    }
    const callId = String(item.call_id || '');
    if (callId && lastResultIndex.get(callId) !== index) {
      changed = true;
      return;
    }
    if (callId && knownCalls.has(callId)) {
      input.push(item);
      return;
    }
    input.push({
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: `[Unpaired tool result${callId ? ` ${callId}` : ''}]\n${outputToText(item.output)}`
      }]
    });
    changed = true;
  });

  return changed ? { ...body, input } : body;
}

function selectRequestedModel(clientModel, config = {}, availableModels = MODELS) {
  const supportedModels = Array.isArray(availableModels) && availableModels.length ? availableModels : MODELS;
  const configuredModel = supportedModels.includes(config.model) ? config.model : DEFAULT_MODEL;
  const requested = resolveCodexModelAlias(String(clientModel || '').trim());
  if (config.modelControl === 'client' && supportedModels.includes(requested)) return requested;
  return configuredModel;
}

function parseUpstreamEvents(text) {
  const payloads = [];
  const trimmed = String(text || '').trim();
  if (!trimmed) return payloads;
  try { payloads.push(JSON.parse(trimmed)); return payloads; } catch (_) {}
  for (const raw of trimmed.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line === 'data: [DONE]') continue;
    if (line.startsWith('data:')) line = line.slice(5).trim();
    try { payloads.push(JSON.parse(line)); } catch (_) {}
  }
  return payloads;
}

function collectParts(payloads) {
  const result = [];
  for (const payload of payloads) {
    const root = payload && payload.response ? payload.response : payload;
    const candidates = root && Array.isArray(root.candidates) ? root.candidates : [];
    for (const candidate of candidates) {
      const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
        ? candidate.content.parts : [];
      for (const part of parts) result.push(part);
    }
  }
  return result;
}

function writeSse(res, event, data, sequence) {
  const payload = { ...data, type: event, sequence_number: sequence };
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function usageFromMetadata(metadata) {
  const input = Number(metadata && metadata.promptTokenCount) || 0;
  const output = Number(metadata && metadata.candidatesTokenCount) || 0;
  const reasoning = Number(metadata && metadata.thoughtsTokenCount) || 0;
  const cached = Number(metadata && metadata.cachedContentTokenCount) || 0;
  return {
    input_tokens: input,
    input_tokens_details: { cached_tokens: cached },
    output_tokens: output + reasoning,
    output_tokens_details: { reasoning_tokens: reasoning },
    total_tokens: Number(metadata && metadata.totalTokenCount) || input + output + reasoning
  };
}

function createToolOutput(part, options = {}) {
  const name = part.functionCall.name || 'tool';
  const kind = options.toolKinds && options.toolKinds.get(name) || 'function';
  const callId = `call_${crypto.randomBytes(8).toString('hex')}`;
  const base = {
    id: `fc_${crypto.randomBytes(8).toString('hex')}`,
    call_id: callId,
    name,
    status: 'completed'
  };
  const item = kind === 'custom'
    ? { ...base, type: 'custom_tool_call', input: String(part.functionCall.args && part.functionCall.args.input || '') }
    : { ...base, type: 'function_call', arguments: JSON.stringify(part.functionCall.args || {}) };
  if (options.onToolCall) {
    options.onToolCall(item, {
      name,
      kind,
      thoughtSignature: part.thoughtSignature || ''
    });
  }
  return item;
}

function createResponsesOutput(parts, model, responseId, options = {}) {
  const output = [];
  let text = '';
  let reasoningText = '';
  let lastTool = null;
  for (const part of parts) {
    if (part && typeof part.text === 'string') {
      if (part.thought === true) reasoningText += part.text;
      else text += part.text;
    }
    if (part && part.functionCall) {
      lastTool = createToolOutput(part, options);
      output.push(lastTool);
    } else if (part && part.thoughtSignature && lastTool && options.onToolCall) {
      options.onToolCall(lastTool, {
        name: lastTool.name,
        kind: lastTool.type === 'custom_tool_call' ? 'custom' : 'function',
        thoughtSignature: part.thoughtSignature
      });
    }
  }
  if (text) {
    output.unshift({
      id: `msg_${crypto.randomBytes(8).toString('hex')}`,
      type: 'message', role: 'assistant', status: 'completed',
      content: [{ type: 'output_text', text, annotations: [] }]
    });
  }
  if (reasoningText) {
    output.unshift({
      id: `rs_${crypto.randomBytes(8).toString('hex')}`,
      type: 'reasoning', status: 'completed',
      summary: [{ type: 'summary_text', text: reasoningText }]
    });
  }
  return {
    id: responseId, object: 'response', created_at: Math.floor(Date.now() / 1000),
    status: 'completed', model, output, error: null,
    usage: usageFromMetadata(options.usageMetadata)
  };
}

function parseSseBlock(block) {
  const data = String(block || '').split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
    .join('\n');
  if (!data || data === '[DONE]') return null;
  try { return JSON.parse(data); } catch (_) { return null; }
}

async function* readUpstreamEvents(body, idleTimeoutMs = 5 * 60 * 1000) {
  if (!body || typeof body.getReader !== 'function') throw new Error('Cloud Code 没有返回可读数据流');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      let timer;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('等待 Cloud Code 流式数据超时')), idleTimeoutMs);
      });
      let result;
      try {
        result = await Promise.race([reader.read(), timeout]);
      } catch (error) {
        try { await reader.cancel(error); } catch (_) {}
        throw error;
      }
      clearTimeout(timer);
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || '';
      for (const block of blocks) {
        const payload = parseSseBlock(block);
        if (payload) yield payload;
      }
    }
    buffer += decoder.decode();
    const payload = parseSseBlock(buffer);
    if (payload) yield payload;
  } finally {
    try { reader.releaseLock(); } catch (_) {}
  }
}

function failedResponse(responseId, model, message) {
  return {
    id: responseId,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status: 'failed',
    model,
    output: [],
    error: { code: 'upstream_error', message: String(message || 'Cloud Code 流式请求失败') },
    usage: usageFromMetadata(null)
  };
}

function buildEmergencyCompactionSummary(body, maxChars = 60000) {
  const entries = [];
  for (const item of Array.isArray(body && body.input) ? body.input : []) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'message' || item.role) {
      const role = item.role === 'assistant' ? 'Assistant' : 'User';
      const text = (Array.isArray(item.content) ? item.content : [{ text: item.content }])
        .map(part => part && typeof part === 'object' ? part.text : '')
        .filter(Boolean).join('\n');
      if (text) entries.push(`${role}: ${text}`);
    } else if (['function_call_output', 'custom_tool_call_output'].includes(item.type)) {
      const text = truncateForCompaction(outputToText(item.output), 4000);
      if (text) entries.push(`Tool result: ${text}`);
    }
  }
  let remaining = maxChars;
  const selected = [];
  for (let index = entries.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const entry = entries[index];
    const value = entry.length <= remaining ? entry : entry.slice(-remaining);
    selected.unshift(value);
    remaining -= value.length;
  }
  return [
    'Context recovery summary generated locally because the upstream compaction stream did not complete.',
    'Preserve the following recent conversation facts and continue the current task without repeating completed work:',
    '',
    selected.join('\n\n') || '(No recent text was available.)'
  ].join('\n');
}

function writeSyntheticCompleted(res, model, text, responseId = `resp_${crypto.randomBytes(12).toString('hex')}`, options = {}) {
  if (!res.headersSent) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });
  }
  let sequence = Number(options.sequence) || 0;
  const createdAt = Math.floor(Date.now() / 1000);
  const messageId = `msg_${crypto.randomBytes(8).toString('hex')}`;
  const pending = {
    id: responseId, object: 'response', created_at: createdAt,
    status: 'in_progress', model, output: [], error: null, usage: usageFromMetadata(null)
  };
  if (options.emitStart !== false) {
    writeSse(res, 'response.created', { response: pending }, sequence++);
    writeSse(res, 'response.in_progress', { response: pending }, sequence++);
  }
  writeSse(res, 'response.output_item.added', {
    output_index: 0,
    item: { id: messageId, type: 'message', role: 'assistant', status: 'in_progress', content: [] }
  }, sequence++);
  writeSse(res, 'response.content_part.added', {
    item_id: messageId, output_index: 0, content_index: 0,
    part: { type: 'output_text', text: '', annotations: [] }
  }, sequence++);
  writeSse(res, 'response.output_text.delta', {
    item_id: messageId, output_index: 0, content_index: 0, delta: text
  }, sequence++);
  const content = { type: 'output_text', text, annotations: [] };
  const item = { id: messageId, type: 'message', role: 'assistant', status: 'completed', content: [content] };
  writeSse(res, 'response.output_text.done', {
    item_id: messageId, output_index: 0, content_index: 0, text
  }, sequence++);
  writeSse(res, 'response.content_part.done', {
    item_id: messageId, output_index: 0, content_index: 0, part: content
  }, sequence++);
  writeSse(res, 'response.output_item.done', { output_index: 0, item }, sequence++);
  writeSse(res, 'response.completed', {
    response: { ...pending, status: 'completed', output: [item] }
  }, sequence++);
  res.end('data: [DONE]\n\n');
}

async function streamUpstreamResponse(res, upstreamResponse, model, responseId, options = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  let sequence = 0;
  let usageMetadata = null;
  let finishReason = '';
  let message = null;
  let reasoning = null;
  let lastTool = null;
  const output = [];
  const base = {
    id: responseId,
    object: 'response',
    created_at: Math.floor(Date.now() / 1000),
    status: 'in_progress',
    model,
    output: [],
    error: null,
    usage: usageFromMetadata(null)
  };
  writeSse(res, 'response.created', { response: base }, sequence++);
  writeSse(res, 'response.in_progress', { response: base }, sequence++);

  try {
    for await (const payload of readUpstreamEvents(upstreamResponse.body, options.idleTimeoutMs)) {
      const root = payload && payload.response ? payload.response : payload;
      if (root && root.usageMetadata) usageMetadata = root.usageMetadata;
      for (const candidate of root && Array.isArray(root.candidates) ? root.candidates : []) {
        if (candidate.finishReason) finishReason = candidate.finishReason;
        const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
          ? candidate.content.parts : [];
        for (const part of parts) {
          if (part && part.thought === true && typeof part.text === 'string' && part.text) {
            if (!reasoning) {
              const outputIndex = output.length;
              reasoning = {
                id: `rs_${crypto.randomBytes(8).toString('hex')}`,
                type: 'reasoning', status: 'in_progress', summary: [],
                outputIndex, text: ''
              };
              output.push(reasoning);
              writeSse(res, 'response.output_item.added', {
                output_index: outputIndex,
                item: { id: reasoning.id, type: 'reasoning', status: 'in_progress', summary: [] }
              }, sequence++);
              writeSse(res, 'response.reasoning_summary_part.added', {
                item_id: reasoning.id, output_index: outputIndex, summary_index: 0,
                part: { type: 'summary_text', text: '' }
              }, sequence++);
            }
            reasoning.text += part.text;
            writeSse(res, 'response.reasoning_summary_text.delta', {
              item_id: reasoning.id, output_index: reasoning.outputIndex,
              summary_index: 0, delta: part.text
            }, sequence++);
          } else if (part && typeof part.text === 'string' && part.text) {
            if (!message) {
              const outputIndex = output.length;
              message = {
                id: `msg_${crypto.randomBytes(8).toString('hex')}`,
                type: 'message', role: 'assistant', status: 'in_progress', content: [],
                outputIndex, text: ''
              };
              output.push(message);
              writeSse(res, 'response.output_item.added', {
                output_index: outputIndex,
                item: { id: message.id, type: 'message', role: 'assistant', status: 'in_progress', content: [] }
              }, sequence++);
              writeSse(res, 'response.content_part.added', {
                item_id: message.id, output_index: outputIndex, content_index: 0,
                part: { type: 'output_text', text: '', annotations: [] }
              }, sequence++);
            }
            message.text += part.text;
            writeSse(res, 'response.output_text.delta', {
              item_id: message.id, output_index: message.outputIndex, content_index: 0, delta: part.text
            }, sequence++);
          }
          if (part && part.functionCall) {
            const item = createToolOutput(part, options);
            item.outputIndex = output.length;
            output.push(item);
            lastTool = item;
            const pending = { ...item, status: 'in_progress' };
            delete pending.outputIndex;
            if (pending.type === 'function_call') pending.arguments = '';
            else pending.input = '';
            writeSse(res, 'response.output_item.added', { output_index: item.outputIndex, item: pending }, sequence++);
            const deltaEvent = item.type === 'custom_tool_call'
              ? 'response.custom_tool_call_input.delta' : 'response.function_call_arguments.delta';
            const delta = item.type === 'custom_tool_call' ? item.input : item.arguments;
            writeSse(res, deltaEvent, {
              item_id: item.id, call_id: item.call_id, output_index: item.outputIndex, delta
            }, sequence++);
          } else if (part && part.thoughtSignature && lastTool && options.onToolCall) {
            options.onToolCall(lastTool, {
              name: lastTool.name,
              kind: lastTool.type === 'custom_tool_call' ? 'custom' : 'function',
              thoughtSignature: part.thoughtSignature
            });
          }
        }
      }
    }

    if (reasoning) {
      const summaryPart = { type: 'summary_text', text: reasoning.text };
      const done = {
        id: reasoning.id, type: 'reasoning', status: 'completed',
        summary: [summaryPart]
      };
      writeSse(res, 'response.reasoning_summary_text.done', {
        item_id: reasoning.id, output_index: reasoning.outputIndex,
        summary_index: 0, text: reasoning.text
      }, sequence++);
      writeSse(res, 'response.reasoning_summary_part.done', {
        item_id: reasoning.id, output_index: reasoning.outputIndex,
        summary_index: 0, part: summaryPart
      }, sequence++);
      writeSse(res, 'response.output_item.done', {
        output_index: reasoning.outputIndex, item: done
      }, sequence++);
    }
    if (message) {
      const content = { type: 'output_text', text: message.text, annotations: [] };
      const done = { id: message.id, type: 'message', role: 'assistant', status: 'completed', content: [content] };
      writeSse(res, 'response.output_text.done', {
        item_id: message.id, output_index: message.outputIndex, content_index: 0, text: message.text
      }, sequence++);
      writeSse(res, 'response.content_part.done', {
        item_id: message.id, output_index: message.outputIndex, content_index: 0, part: content
      }, sequence++);
      writeSse(res, 'response.output_item.done', { output_index: message.outputIndex, item: done }, sequence++);
    }
    for (const tool of output.filter(item => ['function_call', 'custom_tool_call'].includes(item.type))) {
      const done = { ...tool };
      delete done.outputIndex;
      const doneEvent = tool.type === 'custom_tool_call'
        ? 'response.custom_tool_call_input.done' : 'response.function_call_arguments.done';
      writeSse(res, doneEvent, {
        item_id: tool.id, call_id: tool.call_id, output_index: tool.outputIndex,
        [tool.type === 'custom_tool_call' ? 'input' : 'arguments']:
          tool.type === 'custom_tool_call' ? tool.input : tool.arguments
      }, sequence++);
      writeSse(res, 'response.output_item.done', { output_index: tool.outputIndex, item: done }, sequence++);
    }
    const finalOutput = output.map(item => {
      if (item.type === 'message') {
        return { id: item.id, type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: item.text, annotations: [] }] };
      }
      if (item.type === 'reasoning') {
        return {
          id: item.id, type: 'reasoning', status: 'completed',
          summary: [{ type: 'summary_text', text: item.text }]
        };
      }
      const done = { ...item };
      delete done.outputIndex;
      return done;
    });
    const hasActionableOutput = finalOutput.some(item => item.type !== 'reasoning');
    if (!hasActionableOutput) throw new Error(finishReason === 'MAX_TOKENS'
      ? '模型输出额度被思考内容耗尽，请提高 max_output_tokens' : 'Cloud Code 返回了空响应');
    const response = { ...base, status: 'completed', output: finalOutput, usage: usageFromMetadata(usageMetadata) };
    writeSse(res, 'response.completed', { response }, sequence++);
    if (usageMetadata && options.onUsage) options.onUsage(usageMetadata, model);
    res.end('data: [DONE]\n\n');
  } catch (error) {
    if (!res.destroyed && !res.writableEnded) {
      if (options.compactionFallback && !message) {
        if (options.onFallback) options.onFallback(error);
        writeSyntheticCompleted(res, model, options.compactionFallback, responseId, {
          emitStart: false,
          sequence
        });
      } else {
        writeSse(res, 'response.failed', { response: failedResponse(responseId, model, error.message) }, sequence++);
        res.end('data: [DONE]\n\n');
      }
    }
  }
}

async function relayResponsesUpstream(res, upstreamResponse, options = {}) {
  if (options.bufferCompaction) {
    const chunks = [];
    let size = 0;
    let completed = false;
    try {
      if (!upstreamResponse.ok) throw new Error(`自定义 Provider 返回 HTTP ${upstreamResponse.status}: ${(await upstreamResponse.text()).slice(0, 400)}`);
      if (!upstreamResponse.body || typeof upstreamResponse.body.getReader !== 'function') {
        throw new Error('自定义 Provider 没有返回可读响应流');
      }
      const reader = upstreamResponse.body.getReader();
      try {
        while (true) {
          let timer;
          const timeout = new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('自定义 Provider 的压缩流 90 秒没有新数据')), options.idleTimeoutMs || COMPACTION_IDLE_TIMEOUT_MS);
          });
          let result;
          try {
            result = await Promise.race([reader.read(), timeout]);
          } catch (error) {
            try { await reader.cancel(error); } catch (_) {}
            throw error;
          }
          clearTimeout(timer);
          if (result.done) break;
          const chunk = Buffer.from(result.value);
          size += chunk.length;
          if (size > 16 * 1024 * 1024) throw new Error('自定义 Provider 的压缩响应超过 16MB');
          chunks.push(chunk);
        }
      } finally {
        try { reader.releaseLock(); } catch (_) {}
      }
      const buffered = Buffer.concat(chunks);
      const text = buffered.toString('utf8');
      completed = /event:\s*response\.completed|"type"\s*:\s*"response\.completed"/.test(text);
      if (!completed) throw new Error('自定义 Provider 的压缩流结束但缺少 response.completed');
      res.writeHead(upstreamResponse.status, {
        'Content-Type': upstreamResponse.headers.get('content-type') || 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform'
      });
      res.end(buffered);
      return;
    } catch (error) {
      if (options.onFallback) options.onFallback(error);
      writeSyntheticCompleted(res, options.model, options.compactionFallback);
      return;
    }
  }
  let currentResponse = upstreamResponse;
  for (let attempt = 0; ; attempt += 1) {
    if (!currentResponse.ok) {
      const raw = await currentResponse.text();
      const title = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
        ?.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"')
        .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const plain = raw.replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ').trim();
      const cloudflare = /cloudflare|cf-error-details|bad gateway/i.test(raw);
      const detail = title || plain.slice(0, 240) || '上游没有返回错误说明';
      throw new Error(`自定义 Provider 返回 HTTP ${currentResponse.status}${cloudflare ? '（Cloudflare 无法连接源站）' : ''}：${detail}`);
    }
    const headers = {
      'Content-Type': currentResponse.headers.get('content-type') || 'application/json; charset=utf-8',
      'Cache-Control': currentResponse.headers.get('cache-control') || 'no-cache'
    };
    if (!currentResponse.body || typeof currentResponse.body.getReader !== 'function') {
      res.writeHead(currentResponse.status, headers);
      res.end(await currentResponse.text());
      return;
    }
    const reader = currentResponse.body.getReader();
    let first;
    try {
      first = await reader.read();
    } catch (error) {
      try { reader.releaseLock(); } catch (_) {}
      if (attempt === 0 && typeof options.retryFactory === 'function' && !res.headersSent) {
        if (options.onRetry) options.onRetry(error);
        currentResponse = await options.retryFactory(error);
        continue;
      }
      throw error;
    }
    if (first.done) {
      try { reader.releaseLock(); } catch (_) {}
      const error = new Error('自定义 Provider 在返回首个流片段前关闭了连接');
      if (attempt === 0 && typeof options.retryFactory === 'function' && !res.headersSent) {
        if (options.onRetry) options.onRetry(error);
        currentResponse = await options.retryFactory(error);
        continue;
      }
      throw error;
    }
    res.writeHead(currentResponse.status, headers);
    try {
      if (!res.write(Buffer.from(first.value))) {
        await new Promise(resolve => res.once('drain', resolve));
      }
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        if (!res.write(Buffer.from(result.value))) {
          await new Promise(resolve => res.once('drain', resolve));
        }
      }
      res.end();
      return;
    } finally {
      try { reader.releaseLock(); } catch (_) {}
    }
  }
}

class CodexGateway {
  constructor(options) {
    this.fetch = options.fetch;
    this.accountRoot = options.accountRoot;
    this.stateDir = options.stateDir;
    this.decryptToken = options.decryptToken;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.onUsage = typeof options.onUsage === 'function' ? options.onUsage : null;
    this.server = null;
    this.tokenCache = new Map();
    this.projectCache = new Map();
    fs.mkdirSync(this.stateDir, { recursive: true });
    this.configStore = new GatewayConfigStore(this.stateDir, { secretCodec: options.secretCodec });
    this.configPath = this.configStore.configPath;
    this.toolCachePath = this.configStore.toolCachePath;
    this.logPath = path.join(this.stateDir, 'codex-gateway.log');
    this.toolCallCache = new Map();
    this.activeRequest = null;
    this.lastRequest = null;
    this.lastTestReports = {};
    this.toolCallCache = new Map(this.configStore.readToolCalls());
    configureAntigravityModelCatalog(this.stateDir);
    this.config = this.readConfig();
  }

  antigravityModelCatalog() {
    return getAntigravityModelCatalog({ stateDir: this.stateDir });
  }

  antigravityModels() {
    const live = this.antigravityModelCatalog().models;
    return live.length ? ['agy-auto', ...live.filter(model => model !== 'agy-auto')] : [...MODELS];
  }

  readConfig() {
    const stored = this.configStore.readConfig();
    if (stored.model) stored.model = normalizeStoredModel(stored.model);
    if (stored.autoResolvedModel) stored.autoResolvedModel = normalizeStoredModel(stored.autoResolvedModel);
    if (stored.claudeModel) stored.claudeModel = normalizeStoredModel(stored.claudeModel);
    return normalizeGatewayConfig(stored, {
      models: this.antigravityModels(),
      defaultPort: DEFAULT_PORT,
      defaultModel: DEFAULT_MODEL,
      defaultClaudeModel: DEFAULT_CLAUDE_MODEL
    });
  }

  saveConfig() {
    this.configStore.writeConfig(this.config);
  }

  configurationFingerprint() {
    return crypto.createHash('sha256').update(JSON.stringify(this.config)).digest('hex');
  }

  recordTestReport(target, report) {
    if (!target || !report) return;
    this.lastTestReports[target] = {
      id: report.id,
      target: report.target,
      success: Boolean(report.success),
      summary: report.summary,
      completedAt: report.completedAt,
      durationMs: report.durationMs,
      steps: Array.isArray(report.steps) ? report.steps.map(step => ({
        id: step.id,
        label: step.label,
        status: step.status,
        durationMs: step.durationMs,
        message: step.message,
        details: step.details
      })) : []
    };
  }

  diagnosticSnapshot(limit = 50) {
    let recentLogs = [];
    try {
      recentLogs = fs.readFileSync(this.logPath, 'utf8').trim().split(/\r?\n/).slice(-Math.max(1, Math.min(200, limit)))
        .map(line => { try { return JSON.parse(line); } catch (_) { return { event: 'unparsed', message: line.slice(0, 300) }; } });
    } catch (_) {}
    return {
      configFingerprint: this.configurationFingerprint().slice(0, 16),
      status: this.status(),
      lastTestReports: this.lastTestReports,
      recentLogs
    };
  }

  status() {
    const profiles = publicProfiles(this.config);
    const activeId = activeCodexProfileId(this.config);
    const active = profile(this.config, activeId);
    const custom = profile(this.config, PROFILE_IDS.CODEX_CUSTOM);
    const codexAgy = profile(this.config, PROFILE_IDS.CODEX_ANTIGRAVITY);
    const claude = profile(this.config, PROFILE_IDS.CLAUDE_ANTIGRAVITY);
    const customActive = activeId === PROFILE_IDS.CODEX_CUSTOM;
    const antigravityModels = this.antigravityModels();
    const modelCatalog = this.antigravityModelCatalog();
    const antigravityModelEntries = describeAntigravityModels(antigravityModels);
    const models = customActive && custom.models.length ? custom.models : antigravityModels;
    return {
      running: Boolean(this.server && this.server.listening),
      host: '127.0.0.1', port: this.config.port, apiKey: this.config.apiKey,
      accountId: codexAgy.accountId,
      model: active.model,
      autoResolvedModel: codexAgy.autoResolvedModel,
      modelControl: active.modelControl,
      codexAntigravityAccountId: codexAgy.accountId,
      codexAntigravityModel: codexAgy.model,
      codexAntigravityModelControl: codexAgy.modelControl,
      claudeAccountId: claude.accountId,
      claudeModel: claude.model,
      claudeAutoResolvedModel: claude.autoResolvedModel,
      mode: customActive ? 'custom' : 'antigravity',
      activeCodexProfile: this.config.activeCodexProfile,
      upstreamName: customActive ? custom.providerName : 'Antigravity',
      baseUrl: `http://127.0.0.1:${this.config.port}/v1`, models,
      claudeBaseUrl: `http://127.0.0.1:${this.config.port}`,
      antigravityModels, antigravityModelEntries, modelCatalog, profiles,
      activeRequest: this.activeRequest,
      lastRequest: this.lastRequest
    };
  }

  writeDiagnostic(event, details = {}) {
    const record = { time: new Date().toISOString(), event, ...details };
    try {
      if (fs.existsSync(this.logPath) && fs.statSync(this.logPath).size > 5 * 1024 * 1024) {
        const rotated = `${this.logPath}.1`;
        try { fs.unlinkSync(rotated); } catch (_) {}
        fs.renameSync(this.logPath, rotated);
      }
      fs.appendFileSync(this.logPath, `${JSON.stringify(record)}\n`, 'utf8');
    } catch (_) {}
  }

  configure(settings = {}) {
    if (settings.port !== undefined) {
      const port = Number(settings.port);
      if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口必须在 1024-65535 之间');
      if (this.server && this.server.listening && port !== this.config.port) throw new Error('修改端口前请先停止服务');
    }
    configureGatewayConfig(this.config, settings, {
      models: this.antigravityModels(),
      defaultModel: DEFAULT_MODEL,
      defaultClaudeModel: DEFAULT_CLAUDE_MODEL
    });
    this.saveConfig();
    return this.status();
  }

  async start(settings = {}) {
    this.configure(settings);
    if (this.server && this.server.listening) return this.status();
    this.server = http.createServer((req, res) => this.handle(req, res));
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(this.config.port, '127.0.0.1', resolve);
    });
    return this.status();
  }

  async stop() {
    if (!this.server) return this.status();
    await new Promise(resolve => this.server.close(resolve));
    this.server = null;
    return this.status();
  }

  loadAccount(accountIdOverride = '', profileAccountId = '') {
    const registryPath = path.join(this.accountRoot, 'accounts.json');
    const registry = readJsonSafe(registryPath, null, { preserveCorrupted: true });
    if (!registry || !Array.isArray(registry.accounts)) throw new Error('本地账号索引损坏或不存在，请重新登录授权');
    const configuredAccountId = profileAccountId || profile(this.config, PROFILE_IDS.CODEX_ANTIGRAVITY).accountId;
    const accountId = String(accountIdOverride || configuredAccountId || registry.current_account_id || (registry.accounts && registry.accounts[0] && registry.accounts[0].id) || '');
    if (!accountId || !/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) throw new Error('没有可用于反代的本地账号');
    const detailPath = path.join(this.accountRoot, 'accounts', `${accountId}.json`);
    const detail = readJsonSafe(detailPath, null, { preserveCorrupted: true });
    if (!detail) throw new Error('所选账号凭据损坏或不存在，请重新登录授权');
    const token = this.decryptToken(detail);
    if (!token || !token.refresh_token) throw new Error('所选账号缺少 refresh_token');
    return { id: accountId, detail, token };
  }

  async getAccessToken(account) {
    const cached = this.tokenCache.get(account.id);
    if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) return cached.accessToken;
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: account.token.refresh_token,
      grant_type: 'refresh_token'
    });
    const response = await this.fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString()
    });
    if (!response.ok) throw new Error(`OAuth 刷新失败 (${response.status}): ${await response.text()}`);
    const data = await response.json();
    this.tokenCache.set(account.id, { accessToken: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000 });
    return data.access_token;
  }

  async getProjectId(account, accessToken, options = {}) {
    const forceRefresh = options.forceRefresh === true;
    const cached = !forceRefresh && this.projectCache.get(account.id);
    if (cached) return cached;
    const response = await this.fetch(`${UPSTREAMS[0]}/v1internal:loadCodeAssist`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'User-Agent': ANTIGRAVITY_USER_AGENT },
      body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } })
    });
    if (!response.ok) {
      const errorText = await response.text();
      const persistedProject = account.token.project_id || account.detail.project_id;
      if (!forceRefresh && persistedProject) {
        this.projectCache.set(account.id, persistedProject);
        return persistedProject;
      }
      throw new Error(`项目识别失败 (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const project = data.cloudaicompanionProject;
    if (!project) throw new Error('账号没有可用的 Cloud Code 项目');
    this.projectCache.set(account.id, project);
    return project;
  }

  rememberToolCall(item, metadata) {
    this.toolCallCache.set(item.call_id, {
      name: metadata.name,
      kind: metadata.kind,
      thoughtSignature: metadata.thoughtSignature || ''
    });
    while (this.toolCallCache.size > 2048) {
      this.toolCallCache.delete(this.toolCallCache.keys().next().value);
    }
    this.configStore.writeToolCalls([...this.toolCallCache]);
  }

  async openUpstream(body, signal, options = {}) {
    const profileId = options.profileId === PROFILE_IDS.CLAUDE_ANTIGRAVITY
      ? PROFILE_IDS.CLAUDE_ANTIGRAVITY : PROFILE_IDS.CODEX_ANTIGRAVITY;
    const routeProfile = profile(this.config, profileId);
    const account = this.loadAccount(options.accountId, routeProfile.accountId);
    const accessToken = await this.getAccessToken(account);
    const project = await this.getProjectId(account, accessToken, { forceRefresh: options.forceProjectRefresh === true });
    const selectionConfig = options.modelOverride
      ? { ...routeProfile, model: options.modelOverride, modelControl: 'gateway' }
      : routeProfile;
    const requestedModel = selectRequestedModel(body.model, selectionConfig, this.antigravityModels());
    const resolvedModel = requestedModel === 'agy-auto' ? routeProfile.autoResolvedModel : requestedModel;
    const model = mapModel(resolvedModel);
    const request = convertResponsesRequest({ ...body, model }, {
      toolCallCache: this.toolCallCache,
      compaction: options.compaction === true,
      stripImages: options.compaction === true,
      thinkingLevel: requestedThinkingLevel(resolvedModel, body)
    });
    const safeToolIndexes = new Set(Array.isArray(options.claudeSafeToolIndexes) ? options.claudeSafeToolIndexes : []);
    const declarations = request.tools && request.tools[0] && request.tools[0].functionDeclarations;
    if (model.startsWith('claude-') && Array.isArray(declarations) && safeToolIndexes.size) {
      for (const index of safeToolIndexes) {
        const declaration = declarations[index];
        if (!declaration) continue;
        declaration.parameters = toClaudeSafeSchema(declaration.parameters);
        declaration.description = `${declaration.description || ''}\n[AGY Hub compatibility: relaxed schema validation.]`.trim();
      }
    }
    const wrapped = {
      project, request, model, userAgent: 'antigravity', requestType: 'agent',
      requestId: `agent/${Date.now()}/${crypto.randomBytes(4).toString('hex')}`,
      enabledCreditTypes: ['GOOGLE_ONE_AI']
    };
    let lastError = '';
    let preferredRouteError = '';
    for (const includeProjectHeader of [true, false]) {
      for (const base of UPSTREAMS) {
        const headers = {
          Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'User-Agent': ANTIGRAVITY_USER_AGENT, 'x-client-name': 'antigravity'
        };
        if (includeProjectHeader) headers['x-goog-user-project'] = project;
        let response;
        try {
          response = await this.fetch(`${base}/v1internal:streamGenerateContent?alt=sse`, {
            method: 'POST', headers, body: JSON.stringify(wrapped), signal
          });
        } catch (error) {
          if (signal && signal.aborted) throw error;
          lastError = `Cloud Code network error: ${error.message}`;
          if (canRetryGeneration({ error, signalAborted: signal && signal.aborted })) {
            this.writeDiagnostic('upstream.retry', retryDiagnostic({
              attempt: 1,
              error,
              retryReason: error.message
            }));
            continue;
          }
          throw error;
        }
        if (response.ok) return { response, model: requestedModel, resolvedModel };
        const text = await response.text();
        lastError = `Cloud Code ${response.status}: ${text}`;
        this.writeDiagnostic('upstream.error', {
          status: response.status,
          base,
          model: resolvedModel,
          wireModel: model,
          userAgent: ANTIGRAVITY_USER_AGENT,
          error: String(text || '').slice(0, 1200)
        });
        if (model.startsWith('claude-') && response.status === 400 && Number(options.claudeSchemaRepairAttempt || 0) < 3) {
          const rejected = [...text.matchAll(/tools\.(\d+)\.custom\.input_schema/g)].map(match => Number(match[1]));
          const merged = [...new Set([...(options.claudeSafeToolIndexes || []), ...rejected])];
          if (merged.length > (options.claudeSafeToolIndexes || []).length) {
            this.writeDiagnostic('claude.tool_schema_repaired', {
              model: resolvedModel,
              indexes: rejected,
              toolNames: rejected.map(index => declarations && declarations[index] ? declarations[index].name : `tool_${index}`)
            });
            return this.openUpstream(body, signal, {
              ...options,
              claudeSchemaRepairAttempt: Number(options.claudeSchemaRepairAttempt || 0) + 1,
              claudeSafeToolIndexes: merged
            });
          }
        }
        if (isUserProjectDenied(text) && !options.projectRecoveryAttempt) {
          this.projectCache.delete(account.id);
          this.writeDiagnostic('account.project_rejected', { accountId: account.id, project });
          return this.openUpstream(body, signal, { ...options, projectRecoveryAttempt: 1, forceProjectRefresh: true });
        }
        if (isUserLocationUnsupported(text)) {
          this.writeDiagnostic('upstream.location_unsupported', { base, model: resolvedModel });
          // Keep the daily endpoint's location diagnosis. The prod Cloud Code
          // endpoint often answers the same account with a generic 429, which
          // must not be surfaced as "quota exhausted" and hide the real cause.
          preferredRouteError = lastError;
          if (base !== UPSTREAMS[UPSTREAMS.length - 1]) continue;
          throw new Error(preferredRouteError || lastError);
        }
        if (response.status === 403 && includeProjectHeader) break;
        if (response.status === 429 && preferredRouteError) {
          throw new Error(preferredRouteError);
        }
        if (response.status !== 404) throw new Error(lastError);
      }
    }
    throw new Error(preferredRouteError || lastError || 'Cloud Code 请求失败');
  }

  async openCustomUpstream(body, signal) {
    const custom = profile(this.config, PROFILE_IDS.CODEX_CUSTOM);
    if (!custom.baseUrl || !custom.apiKey) throw new Error('自定义 Provider 配置不完整');
    const upstreamUrl = new URL(custom.baseUrl);
    const upstreamPort = Number(upstreamUrl.port || (upstreamUrl.protocol === 'https:' ? 443 : 80));
    if (['127.0.0.1', 'localhost', '::1'].includes(upstreamUrl.hostname) && upstreamPort === this.config.port) {
      throw new Error('自定义 Provider 不能指向小助手自身端口，否则会形成代理循环');
    }
    const allowedModels = custom.models;
    const requested = String(body.model || '').trim();
    const model = requested && (!allowedModels.length || allowedModels.includes(requested))
      ? requested : (custom.model || allowedModels[0]);
    let response;
    const endpoints = [custom.baseUrl, ...(Array.isArray(custom.fallbackBaseUrls) ? custom.fallbackBaseUrls : [])];
    let activeBaseUrl = custom.baseUrl;
    for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex += 1) {
      const endpoint = endpoints[endpointIndex];
      response = undefined;
      let lastEndpointError = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
          response = await fetchResponsesCompatible(this.fetch, { ...custom, baseUrl: endpoint }, { ...body, model }, signal);
          if (response.status < 500 || endpointIndex === endpoints.length - 1) {
            activeBaseUrl = endpoint;
            break;
          }
          lastEndpointError = new Error(`Provider 返回 HTTP ${response.status}`);
      } catch (error) {
          lastEndpointError = error;
          if (attempt > 0 || !canRetryGeneration({ error, signalAborted: signal?.aborted }) || signal?.aborted) break;
        this.writeDiagnostic('custom.upstream_retry', {
          provider: custom.providerName || '自定义 Provider',
          model,
          ...retryDiagnostic({ attempt: attempt + 1, error, retryReason: error.message })
        });
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      }
      if (response && (response.status < 500 || endpointIndex === endpoints.length - 1)) break;
      if (endpointIndex < endpoints.length - 1) {
        this.writeDiagnostic('custom.failover', { provider: custom.providerName || '自定义 Provider', from: endpoint, to: endpoints[endpointIndex + 1], reason: lastEndpointError?.message || `HTTP ${response?.status}` });
      } else if (lastEndpointError && !response) throw lastEndpointError;
    }
    return { response, model, resolvedModel: model, upstreamBaseUrl: activeBaseUrl };
  }

  async callUpstream(body, signal, options = {}) {
    const upstream = await this.openUpstream(body, signal, options);
    return { text: await upstream.response.text(), model: upstream.model, resolvedModel: upstream.resolvedModel };
  }

  async probeUpstream(body, signal, options = {}) {
    const snapshot = JSON.parse(JSON.stringify(this.config));
    const fingerprint = JSON.stringify(snapshot);
    try {
      return await this.callUpstream(body, signal, options);
    } finally {
      if (JSON.stringify(this.config) !== fingerprint) {
        this.config = snapshot;
        this.saveConfig();
        const custom = profile(snapshot, PROFILE_IDS.CODEX_CUSTOM);
        this.writeDiagnostic('probe.route_restored', {
          mode: snapshot.mode,
          model: snapshot.model,
          provider: custom.providerName || 'Antigravity'
        });
      }
    }
  }

  async handleAnthropicRequest(req, res) {
    let requestState = null;
    try {
      const body = await readJson(req);
      if (!Array.isArray(body.messages)) {
        anthropicError(res, 400, 'messages 必须是数组', 'invalid_request_error');
        return;
      }
      const accountIdOverride = String(req.headers['x-agy-account-id'] || '').trim();
      const claudeProfile = profile(this.config, PROFILE_IDS.CLAUDE_ANTIGRAVITY);
      const selectedClaudeModel = modelForClaudeRoute(body.model, claudeProfile.model);
      const responsesBody = normalizeResponsesToolHistory(
        anthropicToResponsesRequest({ ...body, model: selectedClaudeModel }, { defaultModel: selectedClaudeModel })
      );
      const messageId = `msg_${crypto.randomBytes(12).toString('hex')}`;
      const controller = new AbortController();
      const startedAt = Date.now();
      requestState = {
        id: messageId,
        kind: 'claude-turn',
        mode: 'antigravity',
        model: selectedClaudeModel,
        requestedModel: String(body.model || ''),
        inputItems: body.messages.length,
        startedAt: new Date(startedAt).toISOString()
      };
      this.activeRequest = requestState;
      this.writeDiagnostic('request.started', requestState);
      const timeout = setTimeout(() => controller.abort(new Error('Claude Code 上游请求超过 30 分钟')), NORMAL_TIMEOUT_MS);
      const abortOnClose = () => {
        if (!res.writableEnded) controller.abort(new Error('Claude Code 客户端已断开'));
      };
      req.once('aborted', abortOnClose);
      res.once('close', abortOnClose);
      res.once('finish', () => clearTimeout(timeout));

      const upstream = await this.openUpstream(responsesBody, controller.signal, {
        modelOverride: selectedClaudeModel,
        accountId: accountIdOverride,
        profileId: PROFILE_IDS.CLAUDE_ANTIGRAVITY
      });
      const usageCallback = (metadata, model) => {
        if (this.onUsage) {
          this.onUsage(metadata, model, accountIdOverride || claudeProfile.accountId, {
            source: 'claude-code-gateway',
            requestPath: '/v1/messages'
          });
        }
      };
      const outputOptions = {
        onToolCall: (item, metadata) => this.rememberToolCall(item, metadata),
        onUsage: usageCallback
      };

      if (body.stream) {
        await streamAnthropicResponse(res, upstream.response, upstream.model, messageId, outputOptions);
      } else {
        if (!upstream.response.ok) {
          throw new Error(`Cloud Code ${upstream.response.status}: ${(await upstream.response.text()).slice(0, 600)}`);
        }
        const upstreamText = await upstream.response.text();
        const payloads = parseUpstreamEvents(upstreamText);
        const parts = collectParts(payloads);
        if (!parts.length) throw new Error('Cloud Code 返回了空响应');
        let usageMetadata = null;
        let finishReason = '';
        for (const payload of payloads) {
          const root = payload && payload.response ? payload.response : payload;
          if (root && root.usageMetadata) usageMetadata = root.usageMetadata;
          for (const candidate of root && Array.isArray(root.candidates) ? root.candidates : []) {
            if (candidate.finishReason) finishReason = candidate.finishReason;
          }
        }
        if (usageMetadata) usageCallback(usageMetadata, upstream.model);
        const output = createAnthropicMessage(parts, upstream.model, messageId, {
          ...outputOptions,
          usageMetadata,
          finishReason
        });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(output));
      }

      const completed = {
        ...requestState,
        status: 'completed',
        durationMs: Date.now() - startedAt,
        completedAt: new Date().toISOString()
      };
      this.lastRequest = completed;
      if (this.activeRequest && this.activeRequest.id === messageId) this.activeRequest = null;
      this.writeDiagnostic('request.completed', completed);
    } catch (error) {
      const clientDisconnected = req.aborted || res.destroyed;
      if (!clientDisconnected && !res.headersSent) {
        if (error && error.statusCode) {
          anthropicError(res, error.statusCode, error.message, error.code || 'invalid_request_error');
        } else {
          const diagnostic = classifyUpstreamError(error);
          anthropicError(res, 502, diagnostic.message, diagnostic.code);
        }
      } else if (!res.writableEnded) {
        res.end();
      }
      if (requestState) {
        const completed = {
          ...requestState,
          status: clientDisconnected ? 'aborted' : 'failed',
          error: error.message,
          completedAt: new Date().toISOString()
        };
        this.lastRequest = completed;
        if (this.activeRequest && this.activeRequest.id === requestState.id) this.activeRequest = null;
        this.writeDiagnostic('request.completed', completed);
      }
    }
  }

  async handle(req, res) {
    let requestState = null;
    let requestFallback = '';
    let usedFallback = false;
    try {
      const url = new URL(req.url, `http://127.0.0.1:${this.config.port}`);
      if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'ok', service: 'agy-hub-codex-gateway' }));
        return;
      }
      const isAnthropicMessages = req.method === 'POST'
        && ['/v1/messages', '/messages'].includes(url.pathname);
      const isAnthropicCount = req.method === 'POST'
        && ['/v1/messages/count_tokens', '/messages/count_tokens'].includes(url.pathname);
      const isAnthropicRoute = isAnthropicMessages || isAnthropicCount;
      if (!isLocalGatewayAuthorized(req.headers, this.config.apiKey)) {
        if (isAnthropicRoute) anthropicError(res, 401, 'Invalid API key', 'authentication_error');
        else jsonError(res, 401, 'Invalid API key', 'authentication_error');
        return;
      }
      if (isAnthropicCount) {
        const body = await readJson(req);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ input_tokens: estimateAnthropicInputTokens(body) }));
        return;
      }
      if (isAnthropicMessages) {
        await this.handleAnthropicRequest(req, res);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/v1/models') {
        const custom = this.config.activeCodexProfile === 'custom';
        const customProfile = profile(this.config, PROFILE_IDS.CODEX_CUSTOM);
        const antigravityModels = this.antigravityModels();
        const modelIds = custom && customProfile.models.length ? customProfile.models : antigravityModels;
        const antigravityAliases = codexVisibleModelAliasesForModels(antigravityModels);
        const codexModels = custom
          ? buildCodexModelsResponse(modelIds, {
            contextWindow: CUSTOM_PROVIDER_CONTEXT_WINDOW,
            autoCompactPercent: CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT
          })
          : buildAntigravityCodexModelsResponse({
            models: antigravityModels,
            contextWindow: ANTIGRAVITY_CONTEXT_WINDOW,
            autoCompactPercent: ANTIGRAVITY_AUTO_COMPACT_PERCENT
          });
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          ...codexModels,
          object: 'list',
          data: (custom ? modelIds : Object.keys(antigravityAliases))
            .map(id => ({ id, object: 'model', owned_by: custom ? 'custom' : 'antigravity' }))
        }));
        return;
      }
      if (req.method === 'POST' && ['/v1/responses/compact', '/responses/compact'].includes(url.pathname)) {
        jsonError(res, 501, '当前本地 Provider 使用普通 /responses 完成上下文压缩，请勿启用远程压缩端点', 'unsupported_compaction_endpoint');
        return;
      }
      if (req.method !== 'POST' || !['/v1/responses', '/responses'].includes(url.pathname)) {
        jsonError(res, 404, 'Endpoint not found', 'not_found_error');
        return;
      }
      // Only the active Custom API route receives bounded extra ingress headroom. This lets
      // us safely inspect an image-heavy request and reduce old history before forwarding;
      // Antigravity and Claude continue to use the original 32MB entry guard.
      const customActive = this.config.activeCodexProfile === 'custom';
      const receivedBody = await readJson(req, responsesRequestReadLimit(customActive));
      const compaction = Boolean(isCompactionRequest(req, receivedBody));
      const toolNormalizedBody = normalizeResponsesToolHistory(receivedBody);
      const sanitizedBody = sanitizeResponsesHistoryIds(toolNormalizedBody);
      const repairedHistoryIds = sanitizedBody === receivedBody ? 0 : sanitizedBody.input.reduce((count, item, index) => {
        return count + (item !== receivedBody.input[index] ? 1 : 0);
      }, 0);
      let body = compaction ? optimizeCompactionBody(sanitizedBody) : sanitizedBody;
      let customContextReport = null;
      if (customActive && !compaction) {
        const optimized = optimizeCustomRequestBody(body);
        body = optimized.body;
        customContextReport = optimized.report;
        if (customContextReport.requiresUserAction) {
          this.writeDiagnostic('custom.context_budget_blocked', {
            beforeBytes: customContextReport.beforeBytes,
            afterBytes: customContextReport.afterBytes,
            omittedHistoricalImages: customContextReport.omittedHistoricalImages,
            truncatedHistoricalToolOutputs: customContextReport.truncatedHistoricalToolOutputs
          });
          throw new RequestBodyError('自定义 API 的长对话在保留本轮图片并清理旧图片、旧工具输出后，传输体积仍超过 30MB。请减少本轮上传的大图，或新开对话后继续。', {
            statusCode: 413,
            code: 'custom_history_body_too_large'
          });
        }
      }
      const fallbackSummary = compaction ? buildEmergencyCompactionSummary(body) : '';
      requestFallback = fallbackSummary;
      const responseId = `resp_${crypto.randomBytes(12).toString('hex')}`;
      const controller = new AbortController();
      const timeoutMs = compaction ? COMPACTION_TIMEOUT_MS : NORMAL_TIMEOUT_MS;
      const startedAt = Date.now();
      const activeProfile = profile(this.config, activeCodexProfileId(this.config));
      requestState = {
        id: responseId,
        kind: compaction ? 'compaction' : 'turn',
        mode: this.config.mode,
        model: String(body.model || activeProfile.model || ''),
        inputItems: Array.isArray(body.input) ? body.input.length : 1,
        startedAt: new Date(startedAt).toISOString()
      };
      this.activeRequest = requestState;
      this.writeDiagnostic('request.started', requestState);
      if (customContextReport && customContextReport.changed) {
        this.writeDiagnostic('custom.context_budget_applied', {
          id: responseId,
          beforeBytes: customContextReport.beforeBytes,
          afterBytes: customContextReport.afterBytes,
          omittedHistoricalImages: customContextReport.omittedHistoricalImages,
          truncatedHistoricalToolOutputs: customContextReport.truncatedHistoricalToolOutputs
        });
      }
      if (toolNormalizedBody !== receivedBody) {
        this.writeDiagnostic('request.tool_history_repaired', { id: responseId });
      }
      if (repairedHistoryIds) {
        this.writeDiagnostic('request.history_ids_repaired', { id: responseId, count: repairedHistoryIds });
      }
      const timeout = setTimeout(() => controller.abort(new Error(compaction
        ? '上下文压缩超过 4 分钟，已切换到本地恢复摘要'
        : '上游请求超过 30 分钟')), timeoutMs);
      const abortOnClose = () => {
        if (!res.writableEnded) controller.abort(new Error('客户端已断开'));
      };
      req.once('aborted', abortOnClose);
      res.once('close', abortOnClose);
      res.once('finish', () => clearTimeout(timeout));
      const { kinds } = toolDeclarations(body.tools);
      const outputOptions = {
        codexAccountId: profile(this.config, PROFILE_IDS.CODEX_ANTIGRAVITY).accountId,
        toolKinds: kinds,
        idleTimeoutMs: compaction ? COMPACTION_IDLE_TIMEOUT_MS : undefined,
        compactionFallback: fallbackSummary,
        onToolCall: (item, metadata) => this.rememberToolCall(item, metadata),
        onFallback: error => {
          usedFallback = true;
          this.writeDiagnostic('compaction.fallback', {
            id: responseId,
            mode: this.config.mode,
            reason: error.message
          });
        },
        onUsage: (metadata, model) => {
          if (this.onUsage) this.onUsage(metadata, outputOptions.resolvedModel || model, outputOptions.codexAccountId);
        }
      };
      const finishRequest = (status, error = '') => {
        const completed = {
          ...requestState,
          status,
          durationMs: Date.now() - startedAt,
          completedAt: new Date().toISOString(),
          ...(error ? { error } : {})
        };
        this.lastRequest = completed;
        if (this.activeRequest && this.activeRequest.id === responseId) this.activeRequest = null;
        this.writeDiagnostic('request.completed', completed);
      };
      if (body.stream !== false) {
        const upstream = customActive
          ? await this.openCustomUpstream(body, controller.signal)
          : await this.openUpstream(body, controller.signal, { compaction });
        outputOptions.resolvedModel = upstream.resolvedModel;
        if (customActive) {
          await relayResponsesUpstream(res, upstream.response, {
            bufferCompaction: compaction,
            idleTimeoutMs: COMPACTION_IDLE_TIMEOUT_MS,
            compactionFallback: fallbackSummary,
            model: upstream.model,
            onFallback: outputOptions.onFallback,
            retryFactory: undefined
          });
        } else {
          await streamUpstreamResponse(res, upstream.response, upstream.model, responseId, outputOptions);
        }
        finishRequest(usedFallback ? 'fallback' : 'completed');
      } else {
        if (customActive) {
          const upstream = await this.openCustomUpstream(body, controller.signal);
          await relayResponsesUpstream(res, upstream.response);
          finishRequest('completed');
          return;
        }
        const upstream = await this.openUpstream(body, controller.signal, { compaction });
        const upstreamText = await upstream.response.text();
        const payloads = parseUpstreamEvents(upstreamText);
        const parts = collectParts(payloads);
        if (!parts.length) throw new Error('Cloud Code 返回了空响应');
        const usageMetadata = payloads.reduce((latest, payload) => {
          const root = payload && payload.response ? payload.response : payload;
          return root && root.usageMetadata || latest;
        }, null);
        if (usageMetadata && this.onUsage) this.onUsage(usageMetadata, upstream.resolvedModel || upstream.model, outputOptions.codexAccountId);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(createResponsesOutput(parts, upstream.model, responseId, { ...outputOptions, usageMetadata })));
        finishRequest('completed');
      }
    } catch (error) {
      const clientDisconnected = req.aborted || res.destroyed;
      if (!clientDisconnected && requestState && requestState.kind === 'compaction') {
        this.writeDiagnostic('compaction.fallback', { id: requestState.id, mode: requestState.mode, reason: error.message });
        if (!res.writableEnded) writeSyntheticCompleted(res, requestState.model,
          requestFallback || buildEmergencyCompactionSummary({ input: [] }), requestState.id);
      } else if (!res.headersSent) {
        if (error && error.statusCode) {
          jsonError(res, error.statusCode, error.message, error.code || 'invalid_request_body');
        } else {
          const diagnostic = classifyUpstreamError(error);
          jsonError(res, 502, diagnostic.message, diagnostic.code);
        }
      } else if (!res.writableEnded) {
        res.end();
      }
      if (requestState) {
        const completed = {
          ...requestState,
          status: clientDisconnected ? 'aborted' : (requestState.kind === 'compaction' ? 'fallback' : 'failed'),
          error: error.message,
          completedAt: new Date().toISOString()
        };
        this.lastRequest = completed;
        if (this.activeRequest && this.activeRequest.id === requestState.id) this.activeRequest = null;
        this.writeDiagnostic('request.completed', completed);
      }
    }
  }
}

module.exports = {
  CodexGateway, DEFAULT_PORT, DEFAULT_MODEL, MODELS,
  mapModel, selectRequestedModel, cleanSchema, toClaudeSafeSchema, convertResponsesRequest, parseUpstreamEvents, collectParts, createResponsesOutput,
  decodeRequestBody, isCompactionRequest, isUserProjectDenied, isUserLocationUnsupported, optimizeCompactionBody, optimizeCustomRequestBody, responsesRequestReadLimit, sanitizeResponsesHistoryIds,
  normalizeResponsesToolHistory, classifyUpstreamError, buildEmergencyCompactionSummary
};
