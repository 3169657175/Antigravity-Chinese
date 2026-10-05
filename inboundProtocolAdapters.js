const crypto = require('crypto');

const PROTOCOLS = Object.freeze({
  CHAT: 'openai-chat-completions',
  GEMINI: 'gemini-native'
});

function protocolError(message, statusCode = 400, code = 'invalid_request_error') {
  const error = new Error(String(message || 'Invalid request'));
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function normalizePath(pathname) {
  const value = String(pathname || '').trim();
  return value.length > 1 ? value.replace(/\/+$/, '') : value;
}

function detectInboundRoute(method, pathname) {
  const verb = String(method || '').toUpperCase();
  const path = normalizePath(pathname);
  if (verb === 'POST' && ['/v1/chat/completions', '/chat/completions'].includes(path)) {
    return { kind: 'generation', protocol: PROTOCOLS.CHAT, stream: null };
  }
  if (verb === 'GET' && path === '/v1beta/models') {
    return { kind: 'gemini-models', protocol: PROTOCOLS.GEMINI };
  }
  const geminiModelGet = /^\/(v1beta|v1)\/models\/([^/:]+)$/.exec(path);
  if (verb === 'GET' && geminiModelGet) {
    return { kind: 'gemini-model', protocol: PROTOCOLS.GEMINI, apiVersion: geminiModelGet[1], model: decodeURIComponent(geminiModelGet[2]) };
  }
  const geminiGenerate = /^\/(v1beta|v1)\/models\/([^/:]+):(generateContent|streamGenerateContent)$/.exec(path);
  if (verb === 'POST' && geminiGenerate) {
    return {
      kind: 'generation',
      protocol: PROTOCOLS.GEMINI,
      apiVersion: geminiGenerate[1],
      model: decodeURIComponent(geminiGenerate[2]),
      stream: geminiGenerate[3] === 'streamGenerateContent'
    };
  }
  return null;
}

function bearerToken(value) {
  const match = /^Bearer\s+(.+)$/i.exec(String(value || '').trim());
  return match ? match[1].trim() : '';
}

function isGatewayAuthorized(headers, apiKey, url) {
  const expected = String(apiKey || '');
  if (!expected) return false;
  const source = headers || {};
  const candidates = [
    bearerToken(source.authorization),
    String(source['x-api-key'] || ''),
    String(source['api-key'] || ''),
    String(source['x-goog-api-key'] || ''),
    String(url && url.searchParams && url.searchParams.get('key') || '')
  ];
  return candidates.some(value => value && value === expected);
}

function stringContent(value) {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.map(item => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return '';
    return item.text || item.content || item.output_text || item.input_text || '';
  }).filter(Boolean).join('\n');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function openAIContentToResponses(content, role) {
  const assistant = role === 'assistant';
  if (typeof content === 'string') {
    return content ? [{ type: assistant ? 'output_text' : 'input_text', text: content }] : [];
  }
  if (!Array.isArray(content)) return content == null ? [] : [{ type: assistant ? 'output_text' : 'input_text', text: String(content) }];
  const result = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (['text', 'input_text', 'output_text'].includes(part.type) && part.text !== undefined) {
      result.push({ type: assistant ? 'output_text' : 'input_text', text: String(part.text) });
      continue;
    }
    if (part.type === 'image_url') {
      const imageUrl = typeof part.image_url === 'string' ? part.image_url : part.image_url?.url;
      if (imageUrl) result.push({ type: 'input_image', image_url: String(imageUrl), ...(part.image_url?.detail ? { detail: part.image_url.detail } : {}) });
      continue;
    }
    if (part.type === 'input_image' && part.image_url) {
      result.push({ type: 'input_image', image_url: String(part.image_url) });
      continue;
    }
    if (part.type === 'refusal' && part.refusal) result.push({ type: assistant ? 'output_text' : 'input_text', text: String(part.refusal) });
  }
  return result;
}

function openAIToolsToResponses(tools) {
  return (Array.isArray(tools) ? tools : []).map(tool => {
    if (!tool || tool.type !== 'function' || !tool.function?.name) return null;
    return {
      type: 'function',
      name: String(tool.function.name),
      description: String(tool.function.description || ''),
      parameters: tool.function.parameters || { type: 'object', properties: {} },
      ...(tool.function.strict !== undefined ? { strict: Boolean(tool.function.strict) } : {})
    };
  }).filter(Boolean);
}

function normalizeOpenAIToolChoice(choice) {
  if (choice === undefined) return undefined;
  if (['auto', 'none', 'required'].includes(choice)) return choice;
  if (choice && typeof choice === 'object' && choice.type === 'function' && choice.function?.name) {
    return { type: 'function', name: String(choice.function.name) };
  }
  return undefined;
}

function chatCompletionsToResponses(body = {}) {
  if (!Array.isArray(body.messages)) throw protocolError('messages must be an array');
  if (body.n !== undefined && Number(body.n) !== 1) throw protocolError('Only n=1 is supported by this gateway', 501, 'unsupported_parameter');
  const modalities = Array.isArray(body.modalities) ? body.modalities : [];
  if (modalities.some(value => value !== 'text')) throw protocolError('Only text output modality is supported', 501, 'unsupported_modality');
  if (body.audio) throw protocolError('Audio generation is not supported', 501, 'unsupported_audio');

  const input = [];
  const instructions = [];
  for (const message of body.messages) {
    if (!message || typeof message !== 'object') continue;
    const role = String(message.role || 'user');
    if (role === 'system' || role === 'developer') {
      const text = stringContent(message.content);
      if (text) instructions.push(text);
      continue;
    }
    if (role === 'tool') {
      input.push({ type: 'function_call_output', call_id: String(message.tool_call_id || ''), output: stringContent(message.content) });
      continue;
    }
    const content = openAIContentToResponses(message.content, role);
    if (content.length) input.push({ type: 'message', role: role === 'assistant' ? 'assistant' : 'user', content });
    if (role === 'assistant') {
      for (const call of Array.isArray(message.tool_calls) ? message.tool_calls : []) {
        if (call?.type !== 'function' || !call.function?.name) continue;
        const callId = String(call.id || `call_${crypto.randomBytes(8).toString('hex')}`);
        input.push({
          type: 'function_call',
          id: callId,
          call_id: callId,
          name: String(call.function.name),
          arguments: typeof call.function.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function.arguments || {})
        });
      }
    }
  }
  const result = {
    model: String(body.model || ''),
    input,
    stream: false,
    tools: openAIToolsToResponses(body.tools),
    parallel_tool_calls: body.parallel_tool_calls !== false,
    ...(instructions.length ? { instructions: instructions.join('\n\n') } : {})
  };
  const maxTokens = Number(body.max_completion_tokens ?? body.max_tokens);
  if (Number.isFinite(maxTokens) && maxTokens > 0) result.max_output_tokens = maxTokens;
  if (Number.isFinite(body.temperature)) result.temperature = Number(body.temperature);
  if (Number.isFinite(body.top_p)) result.top_p = Number(body.top_p);
  if (body.reasoning_effort) result.reasoning = { effort: String(body.reasoning_effort) };
  const toolChoice = normalizeOpenAIToolChoice(body.tool_choice);
  if (toolChoice !== undefined) result.tool_choice = toolChoice;
  return result;
}

function safeJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')); } catch (_) { return fallback; }
}

function responseText(response) {
  return (Array.isArray(response?.output) ? response.output : [])
    .filter(item => item?.type === 'message')
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(part => ['output_text', 'text'].includes(part?.type) && typeof part.text === 'string')
    .map(part => part.text)
    .join('');
}

function responseReasoning(response) {
  return (Array.isArray(response?.output) ? response.output : [])
    .filter(item => item?.type === 'reasoning')
    .flatMap(item => Array.isArray(item.summary) ? item.summary : [])
    .filter(part => typeof part?.text === 'string')
    .map(part => part.text)
    .join('');
}

function responseToolCalls(response) {
  return (Array.isArray(response?.output) ? response.output : [])
    .filter(item => item?.type === 'function_call')
    .map(item => ({
      id: String(item.call_id || item.id || `call_${crypto.randomBytes(8).toString('hex')}`),
      type: 'function',
      function: { name: String(item.name || 'tool'), arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {}) }
    }));
}

function openAIUsage(response) {
  const usage = response?.usage || {};
  return {
    prompt_tokens: Number(usage.input_tokens) || 0,
    completion_tokens: Number(usage.output_tokens) || 0,
    total_tokens: Number(usage.total_tokens) || (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0),
    prompt_tokens_details: { cached_tokens: Number(usage.input_tokens_details?.cached_tokens) || 0 },
    completion_tokens_details: { reasoning_tokens: Number(usage.output_tokens_details?.reasoning_tokens) || 0 }
  };
}

function responsesToChatCompletion(response = {}) {
  const text = responseText(response);
  const reasoning = responseReasoning(response);
  const toolCalls = responseToolCalls(response);
  const message = { role: 'assistant', content: text || null };
  if (reasoning) message.reasoning_content = reasoning;
  if (toolCalls.length) message.tool_calls = toolCalls;
  return {
    id: String(response.id || `chatcmpl_${crypto.randomBytes(12).toString('hex')}`).replace(/^resp_/, 'chatcmpl_'),
    object: 'chat.completion',
    created: Number(response.created_at) || Math.floor(Date.now() / 1000),
    model: String(response.model || ''),
    choices: [{ index: 0, message, logprobs: null, finish_reason: toolCalls.length ? 'tool_calls' : 'stop' }],
    usage: openAIUsage(response),
    system_fingerprint: null
  };
}

function writeSseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
}

function writeChatCompletion(res, response, options = {}) {
  const payload = responsesToChatCompletion(response);
  if (!options.stream) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
    return;
  }
  writeSseHeaders(res);
  const base = { id: payload.id, object: 'chat.completion.chunk', created: payload.created, model: payload.model, system_fingerprint: null };
  const emit = (delta, finishReason = null) => res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, logprobs: null, finish_reason: finishReason }] })}\n\n`);
  emit({ role: 'assistant', content: '' });
  const message = payload.choices[0].message;
  if (message.reasoning_content) emit({ reasoning_content: message.reasoning_content });
  if (message.content) emit({ content: message.content });
  (message.tool_calls || []).forEach((call, index) => emit({ tool_calls: [{ index, id: call.id, type: 'function', function: call.function }] }));
  emit({}, payload.choices[0].finish_reason);
  if (options.includeUsage) res.write(`data: ${JSON.stringify({ ...base, choices: [], usage: payload.usage })}\n\n`);
  res.end('data: [DONE]\n\n');
}

function geminiPartToResponseItems(part, role) {
  if (!part || typeof part !== 'object') return [];
  const result = [];
  if (part.text !== undefined) result.push({ kind: 'content', value: { type: role === 'assistant' ? 'output_text' : 'input_text', text: String(part.text) } });
  if (part.inlineData?.data) {
    result.push({ kind: 'content', value: { type: 'input_image', image_url: `data:${part.inlineData.mimeType || 'application/octet-stream'};base64,${part.inlineData.data}` } });
  }
  if (part.fileData?.fileUri) result.push({ kind: 'content', value: { type: 'input_image', image_url: String(part.fileData.fileUri) } });
  if (part.functionCall?.name) {
    const id = String(part.functionCall.id || `call_${crypto.randomBytes(8).toString('hex')}`);
    result.push({ kind: 'item', value: { type: 'function_call', id, call_id: id, name: String(part.functionCall.name), arguments: JSON.stringify(part.functionCall.args || {}) } });
  }
  if (part.functionResponse?.name) {
    const id = String(part.functionResponse.id || part.functionResponse.callId || `call_${crypto.randomBytes(8).toString('hex')}`);
    result.push({ kind: 'item', value: { type: 'function_call_output', call_id: id, name: String(part.functionResponse.name), output: JSON.stringify(part.functionResponse.response || {}) } });
  }
  return result;
}

function geminiToolsToResponses(tools) {
  const result = [];
  for (const group of Array.isArray(tools) ? tools : []) {
    for (const fn of Array.isArray(group?.functionDeclarations) ? group.functionDeclarations : []) {
      if (!fn?.name) continue;
      result.push({ type: 'function', name: String(fn.name), description: String(fn.description || ''), parameters: fn.parameters || { type: 'object', properties: {} } });
    }
  }
  return result;
}

function geminiToolChoice(body) {
  const config = body?.toolConfig?.functionCallingConfig;
  const mode = String(config?.mode || '').toUpperCase();
  if (mode === 'NONE') return 'none';
  if (mode === 'ANY') {
    const names = Array.isArray(config.allowedFunctionNames) ? config.allowedFunctionNames.filter(Boolean) : [];
    return names.length === 1 ? { type: 'function', name: String(names[0]) } : 'required';
  }
  if (mode === 'AUTO') return 'auto';
  return undefined;
}

function geminiToResponses(body = {}, model = '') {
  const generation = body.generationConfig || {};
  if (generation.candidateCount !== undefined && Number(generation.candidateCount) !== 1) {
    throw protocolError('Only candidateCount=1 is supported by this gateway', 501, 'unsupported_candidate_count');
  }
  const instructions = stringContent(body.systemInstruction?.parts || body.system_instruction?.parts || '');
  const input = [];
  for (const content of Array.isArray(body.contents) ? body.contents : []) {
    const role = content?.role === 'model' ? 'assistant' : 'user';
    const messageParts = [];
    const deferred = [];
    for (const part of Array.isArray(content?.parts) ? content.parts : []) {
      for (const converted of geminiPartToResponseItems(part, role)) {
        if (converted.kind === 'content') messageParts.push(converted.value);
        else deferred.push(converted.value);
      }
    }
    if (messageParts.length) input.push({ type: 'message', role, content: messageParts });
    input.push(...deferred);
  }
  const result = {
    model: String(model || body.model || ''),
    input,
    stream: false,
    tools: geminiToolsToResponses(body.tools)
  };
  if (instructions) result.instructions = instructions;
  if (Number.isFinite(generation.maxOutputTokens)) result.max_output_tokens = Number(generation.maxOutputTokens);
  if (Number.isFinite(generation.temperature)) result.temperature = Number(generation.temperature);
  if (Number.isFinite(generation.topP)) result.top_p = Number(generation.topP);
  const thinking = generation.thinkingConfig || body.thinkingConfig;
  if (thinking?.thinkingLevel) result.reasoning = { effort: String(thinking.thinkingLevel).toLowerCase() };
  const toolChoice = geminiToolChoice(body);
  if (toolChoice !== undefined) result.tool_choice = toolChoice;
  return result;
}

function geminiUsage(response) {
  const usage = response?.usage || {};
  const input = Number(usage.input_tokens) || 0;
  const output = Number(usage.output_tokens) || 0;
  const reasoning = Number(usage.output_tokens_details?.reasoning_tokens) || 0;
  return {
    promptTokenCount: input,
    candidatesTokenCount: Math.max(0, output - reasoning),
    thoughtsTokenCount: reasoning,
    cachedContentTokenCount: Number(usage.input_tokens_details?.cached_tokens) || 0,
    totalTokenCount: Number(usage.total_tokens) || input + output
  };
}

function responsesToGemini(response = {}) {
  const parts = [];
  const reasoning = responseReasoning(response);
  const text = responseText(response);
  if (reasoning) parts.push({ text: reasoning, thought: true });
  if (text) parts.push({ text });
  for (const call of responseToolCalls(response)) {
    parts.push({ functionCall: { id: call.id, name: call.function.name, args: safeJson(call.function.arguments, {}) } });
  }
  return {
    candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP', index: 0 }],
    usageMetadata: geminiUsage(response),
    modelVersion: String(response.model || '')
  };
}

function writeGeminiResponse(res, response, options = {}) {
  const payload = responsesToGemini(response);
  if (!options.stream) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
    return;
  }
  writeSseHeaders(res);
  res.end(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeCompatibleResponse(res, protocol, response, options = {}) {
  if (protocol === PROTOCOLS.CHAT) return writeChatCompletion(res, response, options);
  if (protocol === PROTOCOLS.GEMINI) return writeGeminiResponse(res, response, options);
  throw protocolError(`Unsupported compatibility protocol: ${protocol}`, 500, 'internal_protocol_error');
}

function buildGeminiModel(model) {
  const id = String(model?.id || model || '').replace(/^models\//, '');
  const label = String(model?.label || id);
  return {
    name: `models/${id}`,
    baseModelId: id,
    version: '001',
    displayName: label,
    description: model?.group ? `${model.group} · AGY Hub local gateway` : 'AGY Hub local gateway',
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
  };
}

function buildGeminiModels(models) {
  return { models: (Array.isArray(models) ? models : []).map(buildGeminiModel) };
}

function unsupportedCapabilityForPath(method, pathname) {
  const verb = String(method || '').toUpperCase();
  const path = normalizePath(pathname).toLowerCase();
  if (!['GET', 'POST', 'DELETE'].includes(verb)) return null;
  const groups = [
    [/^\/v1\/embeddings(?:\/|$)/, 'embeddings'],
    [/^\/v1\/audio(?:\/|$)/, 'audio'],
    [/^\/v1\/images(?:\/|$)/, 'image generation'],
    [/^\/v1\/moderations(?:\/|$)/, 'moderations'],
    [/^\/v1\/files(?:\/|$)/, 'files'],
    [/^\/v1\/batches(?:\/|$)/, 'batches'],
    [/^\/v1\/fine_tuning(?:\/|$)/, 'fine-tuning']
  ];
  const match = groups.find(([pattern]) => pattern.test(path));
  return match ? { capability: match[1], message: `${match[1]} is not supported by the Antigravity model gateway` } : null;
}

function writeProtocolError(res, protocol, statusCode, message, code = 'invalid_request_error') {
  const status = Number(statusCode) || 500;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  if (protocol === PROTOCOLS.GEMINI) {
    const geminiStatus = status === 401 ? 'UNAUTHENTICATED' : status === 404 ? 'NOT_FOUND' : status === 501 ? 'UNIMPLEMENTED' : status >= 500 ? 'INTERNAL' : 'INVALID_ARGUMENT';
    res.end(JSON.stringify({ error: { code: status, message: String(message || 'Request failed'), status: geminiStatus } }));
    return;
  }
  res.end(JSON.stringify({ error: { message: String(message || 'Request failed'), type: status === 401 ? 'authentication_error' : 'invalid_request_error', param: null, code } }));
}

module.exports = {
  PROTOCOLS,
  protocolError,
  detectInboundRoute,
  isGatewayAuthorized,
  chatCompletionsToResponses,
  responsesToChatCompletion,
  writeChatCompletion,
  geminiToResponses,
  responsesToGemini,
  writeGeminiResponse,
  writeCompatibleResponse,
  buildGeminiModel,
  buildGeminiModels,
  unsupportedCapabilityForPath,
  writeProtocolError
};
