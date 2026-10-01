const PROTOCOLS = Object.freeze({ RESPONSES: 'responses', CHAT_COMPLETIONS: 'chat-completions', ANTHROPIC: 'anthropic-messages', GEMINI: 'gemini-native' });
const AUTH_MODES = Object.freeze({ BEARER: 'bearer', X_API_KEY: 'x-api-key', API_KEY: 'api-key', QUERY: 'query', CUSTOM: 'custom' });

function normalizeBaseUrl(value, protocol = PROTOCOLS.RESPONSES) {
  const parsed = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Provider URL 仅支持 HTTP 或 HTTPS');
  const patterns = {
    [PROTOCOLS.RESPONSES]: /\/responses\/?$/i,
    [PROTOCOLS.CHAT_COMPLETIONS]: /\/chat\/completions\/?$/i,
    [PROTOCOLS.ANTHROPIC]: /\/messages\/?$/i,
    [PROTOCOLS.GEMINI]: /\/models(?:\/[^/:]+(?::generateContent|:streamGenerateContent)?)?\/?$/i
  };
  parsed.pathname = parsed.pathname.replace(patterns[protocol] || /$^/, '').replace(/\/+$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString().replace(/\/$/, '');
}

function parseCustomHeaders(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return { ...value };
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    return parsed;
  } catch (_) { throw new Error('自定义 Header 必须是 JSON 对象'); }
}

function authenticate(config, target) {
  const headers = { ...(target.headers || {}) };
  const url = new URL(target.url);
  const key = String(config.apiKey || '');
  switch (config.authMode || AUTH_MODES.BEARER) {
    case AUTH_MODES.X_API_KEY: headers['x-api-key'] = key; break;
    case AUTH_MODES.API_KEY: headers['api-key'] = key; break;
    case AUTH_MODES.QUERY: url.searchParams.set(config.authQueryName || 'key', key); break;
    case AUTH_MODES.CUSTOM:
      for (const [name, value] of Object.entries(parseCustomHeaders(config.customHeaders))) headers[name] = String(value).replace(/\{\{API_KEY\}\}/g, key);
      break;
    default: headers.Authorization = `Bearer ${key}`;
  }
  return { ...target, url: url.toString(), headers };
}

function textFromInput(input) {
  if (typeof input === 'string') return input;
  return (Array.isArray(input) ? input : []).map(item => (Array.isArray(item?.content) ? item.content : [])
    .map(part => part?.text || part?.input_text || part?.output_text || '').join('')).filter(Boolean).join('\n');
}

function messagesFromInput(input) {
  if (typeof input === 'string') return [{ role: 'user', content: input }];
  const messages = [];
  for (const item of Array.isArray(input) ? input : []) {
    if (item?.type === 'function_call') {
      messages.push({ role: 'assistant', content: '', tool_calls: [{ id: item.call_id || item.id, type: 'function', function: { name: item.name, arguments: typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {}) } }] });
      continue;
    }
    if (item?.type === 'function_call_output') {
      messages.push({ role: 'tool', tool_call_id: item.call_id, content: typeof item.output === 'string' ? item.output : JSON.stringify(item.output || {}) });
      continue;
    }
    const content = (Array.isArray(item?.content) ? item.content : []).map(part => part?.text || part?.input_text || part?.output_text || '').filter(Boolean).join('');
    if (content) messages.push({ role: item?.role === 'assistant' ? 'assistant' : item?.role === 'system' ? 'system' : 'user', content });
  }
  return messages.length ? messages : [{ role: 'user', content: textFromInput(input) }];
}

function openAITools(tools) { return (tools || []).filter(x => x?.type === 'function').map(x => ({ type: 'function', function: { name: x.name, description: x.description, parameters: x.parameters || {} } })); }
function anthropicTools(tools) { return (tools || []).filter(x => x?.type === 'function').map(x => ({ name: x.name, description: x.description, input_schema: x.parameters || { type: 'object', properties: {} } })); }
function geminiTools(tools) {
  const functionDeclarations = (tools || []).filter(x => x?.type === 'function').map(x => ({ name: x.name, description: x.description, parameters: x.parameters || { type: 'object', properties: {} } }));
  return functionDeclarations.length ? [{ functionDeclarations }] : undefined;
}

function requestFor(config, body) {
  const base = normalizeBaseUrl(config.baseUrl, config.protocol);
  const model = String(body.model || config.model || '');
  let target;
  if (config.protocol === PROTOCOLS.CHAT_COMPLETIONS) target = { url: `${base}/chat/completions`, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: { model, messages: messagesFromInput(body.input), tools: openAITools(body.tools), max_tokens: body.max_output_tokens, stream: false } };
  else if (config.protocol === PROTOCOLS.ANTHROPIC) target = { url: `${base}/messages`, headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'anthropic-version': config.anthropicVersion || '2023-06-01' }, body: { model, messages: messagesFromInput(body.input).filter(x => x.role !== 'system').map(x => ({ role: x.role === 'assistant' ? 'assistant' : 'user', content: x.content || '' })), system: messagesFromInput(body.input).filter(x => x.role === 'system').map(x => x.content).join('\n') || undefined, tools: anthropicTools(body.tools), max_tokens: body.max_output_tokens || 1024, stream: false } };
  else if (config.protocol === PROTOCOLS.GEMINI) target = { url: `${base}/models/${encodeURIComponent(model)}:generateContent`, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: { contents: [{ role: 'user', parts: [{ text: textFromInput(body.input) }] }], tools: geminiTools(body.tools), generationConfig: { maxOutputTokens: body.max_output_tokens || 1024 } } };
  else target = { url: `${base}/responses`, headers: { 'Content-Type': 'application/json', Accept: body.stream === false ? 'application/json' : 'text/event-stream' }, body: { ...body, model } };
  return authenticate(config, target);
}

function responseText(protocol, payload) {
  if (protocol === PROTOCOLS.CHAT_COMPLETIONS) return payload?.choices?.[0]?.message?.content || '';
  if (protocol === PROTOCOLS.ANTHROPIC) return (payload?.content || []).filter(x => x?.type === 'text').map(x => x.text).join('');
  return (payload?.candidates?.[0]?.content?.parts || []).map(x => x?.text || '').join('');
}

function usage(protocol, payload) {
  if (protocol === PROTOCOLS.CHAT_COMPLETIONS) return { input_tokens: payload?.usage?.prompt_tokens || 0, output_tokens: payload?.usage?.completion_tokens || 0, total_tokens: payload?.usage?.total_tokens || 0 };
  if (protocol === PROTOCOLS.ANTHROPIC) return { input_tokens: payload?.usage?.input_tokens || 0, output_tokens: payload?.usage?.output_tokens || 0, total_tokens: (payload?.usage?.input_tokens || 0) + (payload?.usage?.output_tokens || 0) };
  const meta = payload?.usageMetadata || {};
  return { input_tokens: meta.promptTokenCount || 0, output_tokens: meta.candidatesTokenCount || 0, total_tokens: meta.totalTokenCount || 0 };
}

function responsesPayload(protocol, payload, model) {
  const id = payload?.id || `resp_agy_${Date.now().toString(36)}`;
  const output = [];
  const text = responseText(protocol, payload);
  if (text) output.push({ id: `msg_${id}`, type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] });
  if (protocol === PROTOCOLS.CHAT_COMPLETIONS) {
    for (const call of payload?.choices?.[0]?.message?.tool_calls || []) output.push({ id: call.id, type: 'function_call', call_id: call.id, name: call.function?.name || '', arguments: call.function?.arguments || '{}' });
  } else if (protocol === PROTOCOLS.ANTHROPIC) {
    for (const call of payload?.content || []) if (call?.type === 'tool_use') output.push({ id: call.id, type: 'function_call', call_id: call.id, name: call.name || '', arguments: JSON.stringify(call.input || {}) });
  } else if (protocol === PROTOCOLS.GEMINI) {
    for (const part of payload?.candidates?.[0]?.content?.parts || []) if (part?.functionCall) {
      const callId = `call_${Date.now().toString(36)}_${output.length}`;
      output.push({ id: callId, type: 'function_call', call_id: callId, name: part.functionCall.name || '', arguments: JSON.stringify(part.functionCall.args || {}) });
    }
  }
  if (!output.length) output.push({ id: `msg_${id}`, type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: '', annotations: [] }] });
  return { id, object: 'response', created_at: Math.floor(Date.now() / 1000), status: 'completed', model, output, usage: usage(protocol, payload) };
}

function asSse(response) {
  const message = response.output.find(item => item.type === 'message');
  const events = [['response.created', { response: { ...response, status: 'in_progress', output: [] } }]];
  if (message) events.push(['response.output_text.delta', { item_id: message.id, output_index: response.output.indexOf(message), content_index: 0, delta: message.content?.[0]?.text || '' }]);
  events.push(['response.completed', { response }]);
  return `${events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`).join('')}data: [DONE]\n\n`;
}

function isEventStream(response) {
  return /text\/event-stream/i.test(response?.headers?.get?.('content-type') || '');
}

function responsesResponseToSse(payload, model) {
  const response = payload && typeof payload === 'object' && Array.isArray(payload.output)
    ? payload
    : responsesPayload(PROTOCOLS.RESPONSES, payload, model);
  return asSse({
    ...response,
    object: response.object || 'response',
    model: response.model || model,
    status: response.status || 'completed'
  });
}

async function fetchResponsesCompatible(fetch, config, body, signal) {
  const target = requestFor(config, body);
  const response = await fetch(target.url, { method: 'POST', signal, headers: target.headers, body: JSON.stringify(target.body) });
  if (!response.ok) return response;
  if (config.protocol === PROTOCOLS.RESPONSES) {
    // Some Responses-compatible gateways return a complete JSON response even when
    // stream=true. Codex expects SSE in that mode, so normalize the successful JSON
    // response at the protocol boundary instead of leaking a confusing parse error.
    if (body.stream !== false && !isEventStream(response)) {
      const contentType = response.headers?.get?.('content-type') || '';
      if (!contentType || /json/i.test(contentType)) {
        const payload = JSON.parse(await response.text());
        return new Response(responsesResponseToSse(payload, body.model), {
          status: response.status,
          headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform' }
        });
      }
    }
    return response;
  }
  const converted = responsesPayload(config.protocol, await response.json(), target.body.model || body.model);
  const streaming = body.stream !== false;
  return new Response(streaming ? asSse(converted) : JSON.stringify(converted), { status: 200, headers: { 'Content-Type': streaming ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8' } });
}

function extractModels(payload) {
  const items = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.models) ? payload.models : [];
  return [...new Set(items.map(item => String(item?.id || item?.name || item || '').replace(/^models\//, '').trim()).filter(Boolean))];
}

async function discoverModels(fetch, config, signal) {
  const target = authenticate(config, { url: `${normalizeBaseUrl(config.baseUrl, config.protocol)}/models`, headers: { Accept: 'application/json' } });
  const response = await fetch(target.url, { signal, headers: target.headers });
  const text = await response.text();
  if (!response.ok) throw new Error(`模型列表返回 HTTP ${response.status}: ${text.slice(0, 300)}`);
  return { models: extractModels(JSON.parse(text)), status: response.status };
}

module.exports = { PROTOCOLS, AUTH_MODES, normalizeBaseUrl, parseCustomHeaders, authenticate, requestFor, responsesPayload, responsesResponseToSse, fetchResponsesCompatible, discoverModels, extractModels };
