const { jsonError } = require('./gatewayHttp.js');
const { anthropicError } = require('./anthropicGateway.js');
const { describeAntigravityModels } = require('./antigravityModelCatalog.js');
const adapters = require('./inboundProtocolAdapters.js');
const { CODEX_VISIBLE_MODEL_ALIASES } = require('./codexModels.js');

const CODEX_ALIAS_IDS = new Set(Object.keys(CODEX_VISIBLE_MODEL_ALIASES));

function publicModelIds(modelIds, options = {}) {
  const custom = Boolean(options.custom);
  const seen = new Set();
  return (Array.isArray(modelIds) ? modelIds : [])
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .filter(id => custom || (id !== 'agy-auto' && !CODEX_ALIAS_IDS.has(id)))
    .filter(id => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
}

function detectInboundRoute(method, pathname) {
  return adapters.detectInboundRoute(method, pathname);
}

function authorize(req, res, url, apiKey, isAnthropicRoute = false) {
  if (adapters.isGatewayAuthorized(req.headers, apiKey, url)) return true;
  if (isAnthropicRoute) anthropicError(res, 401, 'Invalid API key', 'authentication_error');
  else if (detectInboundRoute(req.method, url.pathname)?.protocol === adapters.PROTOCOLS.GEMINI) {
    adapters.writeProtocolError(res, adapters.PROTOCOLS.GEMINI, 401, 'Invalid API key', 'authentication_error');
  } else jsonError(res, 401, 'Invalid API key', 'authentication_error');
  return false;
}

function handleMetadata(res, inboundRoute, options = {}) {
  if (!inboundRoute || !['gemini-models', 'gemini-model'].includes(inboundRoute.kind)) return false;
  const modelIds = publicModelIds(options.modelIds, { custom: options.custom });
  const entries = options.custom
    ? modelIds.map(id => ({ id, label: id, group: 'Custom Provider' }))
    : describeAntigravityModels(modelIds);
  if (inboundRoute.kind === 'gemini-model') {
    const entry = entries.find(item => item.id === inboundRoute.model);
    if (!entry) adapters.writeProtocolError(res, adapters.PROTOCOLS.GEMINI, 404, `Model not found: ${inboundRoute.model}`, 'model_not_found');
    else {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(adapters.buildGeminiModel(entry)));
    }
    return true;
  }
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(adapters.buildGeminiModels(entries)));
  return true;
}


function handleOpenAIModels(res, options = {}) {
  const custom = Boolean(options.custom);
  const modelIds = Array.isArray(options.modelIds) ? options.modelIds : [];
  const antigravityModels = Array.isArray(options.antigravityModels) ? options.antigravityModels : modelIds;
  const publicIds = publicModelIds(custom ? modelIds : antigravityModels, { custom });
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    object: 'list',
    data: publicIds.map(id => ({ id, object: 'model', created: 0, owned_by: custom ? 'custom' : 'antigravity' }))
  }));
  return true;
}

function handleUnsupported(req, res, url, inboundRoute) {
  const unsupported = adapters.unsupportedCapabilityForPath(req.method, url.pathname);
  if (!unsupported) return false;
  const protocol = inboundRoute?.protocol || adapters.PROTOCOLS.CHAT;
  adapters.writeProtocolError(res, protocol, 501, unsupported.message, `unsupported_${unsupported.capability.replace(/[^a-z0-9]+/gi, '_')}`);
  return true;
}

function normalizeBody(inboundRoute, incomingBody) {
  if (inboundRoute?.protocol === adapters.PROTOCOLS.CHAT) {
    return { protocol: adapters.PROTOCOLS.CHAT, requestedStream: incomingBody?.stream === true, body: adapters.chatCompletionsToResponses(incomingBody) };
  }
  if (inboundRoute?.protocol === adapters.PROTOCOLS.GEMINI) {
    return { protocol: adapters.PROTOCOLS.GEMINI, requestedStream: Boolean(inboundRoute.stream), body: adapters.geminiToResponses(incomingBody, inboundRoute.model) };
  }
  return { protocol: 'responses', requestedStream: false, body: incomingBody };
}

async function writeCustomUpstream(res, protocol, upstreamResponse, options = {}) {
  if (protocol === 'responses') return false;
  const text = await upstreamResponse.text();
  if (!upstreamResponse.ok) throw new Error(`Provider 返回 HTTP ${upstreamResponse.status}: ${text.slice(0, 500)}`);
  let payload;
  try { payload = JSON.parse(text); } catch (_) { throw new Error('Provider 没有返回有效的 Responses JSON'); }
  adapters.writeCompatibleResponse(res, protocol, payload, options);
  return true;
}


function writeError(res, protocol, statusCode, message, code = 'invalid_request_error') {
  if (protocol === 'responses') {
    jsonError(res, statusCode, message, code);
    return;
  }
  adapters.writeProtocolError(res, protocol, statusCode, message, code);
}

function writeFinal(res, protocol, responsePayload, options = {}) {
  if (protocol === 'responses') return false;
  adapters.writeCompatibleResponse(res, protocol, responsePayload, options);
  return true;
}

module.exports = {
  PROTOCOLS: adapters.PROTOCOLS,
  detectInboundRoute,
  authorize,
  handleMetadata,
  handleOpenAIModels,
  publicModelIds,
  handleUnsupported,
  normalizeBody,
  writeCustomUpstream,
  writeError,
  writeFinal
};
