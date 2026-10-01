const crypto = require('crypto');

function normalizeContent(content) {
  if (typeof content === 'string') return [{ type: 'text', text: content }];
  return Array.isArray(content) ? content : [];
}

function contentText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : JSON.stringify(content);
  const text = content.map(block => {
    if (!block || typeof block !== 'object') return '';
    if (block.type === 'text') return String(block.text || '');
    if (block.type === 'image') return '[Image returned by tool]';
    return '';
  }).filter(Boolean).join('\n');
  return text || JSON.stringify(content);
}

function systemText(system) {
  return normalizeContent(system)
    .filter(block => block && block.type === 'text')
    .map(block => String(block.text || ''))
    .filter(Boolean)
    .join('\n\n');
}

function anthropicImageToResponses(block) {
  const source = block && block.source;
  if (!source || typeof source !== 'object') return null;
  if (source.type === 'base64' && source.data) {
    return {
      type: 'input_image',
      image_url: `data:${source.media_type || 'application/octet-stream'};base64,${source.data}`
    };
  }
  if (source.type === 'url' && source.url) {
    return { type: 'input_image', image_url: String(source.url) };
  }
  return null;
}

function anthropicToResponsesRequest(body, options = {}) {
  const input = [];
  const messages = Array.isArray(body && body.messages) ? body.messages : [];

  for (const message of messages) {
    if (!message || !['user', 'assistant'].includes(message.role)) continue;
    const role = message.role;
    let messageParts = [];
    const flushMessage = () => {
      if (!messageParts.length) return;
      input.push({ type: 'message', role, content: messageParts });
      messageParts = [];
    };

    for (const block of normalizeContent(message.content)) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'text') {
        messageParts.push({
          type: role === 'assistant' ? 'output_text' : 'input_text',
          text: String(block.text || '')
        });
        continue;
      }
      if (block.type === 'image' && role === 'user') {
        const image = anthropicImageToResponses(block);
        if (image) messageParts.push(image);
        continue;
      }
      if (block.type === 'tool_use' && role === 'assistant') {
        flushMessage();
        input.push({
          type: 'function_call',
          call_id: String(block.id || `toolu_${crypto.randomBytes(8).toString('hex')}`),
          name: String(block.name || 'tool'),
          arguments: JSON.stringify(block.input && typeof block.input === 'object' ? block.input : {})
        });
        continue;
      }
      if (block.type === 'tool_result' && role === 'user') {
        flushMessage();
        const result = contentText(block.content);
        input.push({
          type: 'function_call_output',
          call_id: String(block.tool_use_id || ''),
          output: block.is_error ? `[Tool error]\n${result}` : result
        });
      }
    }
    flushMessage();
  }

  const tools = (Array.isArray(body && body.tools) ? body.tools : [])
    .filter(tool => tool && tool.name)
    .map(tool => ({
      type: 'function',
      name: String(tool.name),
      description: String(tool.description || ''),
      parameters: tool.input_schema && typeof tool.input_schema === 'object'
        ? tool.input_schema
        : { type: 'object', properties: {} }
    }));

  const request = {
    model: String(body && body.model || options.defaultModel || ''),
    input,
    instructions: systemText(body && body.system),
    tools: body && body.tool_choice && body.tool_choice.type === 'none' ? [] : tools,
    max_output_tokens: Math.max(1, Number(body && body.max_tokens) || 16384),
    stream: Boolean(body && body.stream),
    store: false
  };
  if (Number.isFinite(body && body.temperature)) request.temperature = body.temperature;
  if (Number.isFinite(body && body.top_p)) request.top_p = body.top_p;
  if (body && body.metadata && typeof body.metadata === 'object') {
    request.client_metadata = { anthropic: body.metadata };
  }
  return request;
}

function estimateAnthropicInputTokens(body) {
  const text = [
    systemText(body && body.system),
    JSON.stringify(body && body.messages || []),
    JSON.stringify(body && body.tools || [])
  ].join('\n');
  // Local fallback for Claude Code's count_tokens endpoint. Use a conservative
  // mixed CJK/Latin estimate so context checks do not undercount dramatically.
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length;
  const other = Math.max(0, text.length - cjk);
  return Math.max(1, Math.ceil(cjk / 1.5 + other / 3.5));
}

function usageFromMetadata(metadata) {
  const input = Number(metadata && metadata.promptTokenCount) || 0;
  const visibleOutput = Number(metadata && metadata.candidatesTokenCount) || 0;
  const reasoning = Number(metadata && metadata.thoughtsTokenCount) || 0;
  const cached = Number(metadata && metadata.cachedContentTokenCount) || 0;
  return {
    input_tokens: input,
    output_tokens: visibleOutput + reasoning,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: cached
  };
}

function toolUseFromPart(part, options = {}) {
  const id = `toolu_${crypto.randomBytes(12).toString('hex')}`;
  const name = String(part.functionCall && part.functionCall.name || 'tool');
  const input = part.functionCall && part.functionCall.args && typeof part.functionCall.args === 'object'
    ? part.functionCall.args : {};
  const cacheItem = { type: 'function_call', call_id: id, name, arguments: JSON.stringify(input) };
  if (options.onToolCall) {
    options.onToolCall(cacheItem, { name, kind: 'function', thoughtSignature: part.thoughtSignature || '' });
  }
  return { block: { type: 'tool_use', id, name, input }, cacheItem };
}

function createAnthropicMessage(parts, model, messageId, options = {}) {
  const content = [];
  let text = '';
  let lastTool = null;
  const flushText = () => {
    if (!text) return;
    content.push({ type: 'text', text });
    text = '';
  };
  for (const part of Array.isArray(parts) ? parts : []) {
    if (part && typeof part.text === 'string') text += part.text;
    if (part && part.functionCall) {
      flushText();
      const tool = toolUseFromPart(part, options);
      content.push(tool.block);
      lastTool = tool.cacheItem;
    } else if (part && part.thoughtSignature && lastTool && options.onToolCall) {
      options.onToolCall(lastTool, {
        name: lastTool.name,
        kind: 'function',
        thoughtSignature: part.thoughtSignature
      });
    }
  }
  flushText();
  const hasTool = content.some(block => block.type === 'tool_use');
  const stopReason = hasTool ? 'tool_use'
    : options.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn';
  return {
    id: messageId,
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
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

async function* readSsePayloads(body, idleTimeoutMs = 30 * 60 * 1000) {
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
      const result = await Promise.race([reader.read(), timeout]).finally(() => clearTimeout(timer));
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      let boundary;
      while ((boundary = buffer.search(/\r?\n\r?\n/)) >= 0) {
        const block = buffer.slice(0, boundary);
        const separator = /^\r\n\r\n/.test(buffer.slice(boundary)) ? 4 : 2;
        buffer = buffer.slice(boundary + separator);
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

function writeAnthropicEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function streamAnthropicResponse(res, upstreamResponse, model, messageId, options = {}) {
  if (!upstreamResponse.ok) {
    throw new Error(`Cloud Code ${upstreamResponse.status}: ${(await upstreamResponse.text()).slice(0, 600)}`);
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  writeAnthropicEvent(res, 'message_start', {
    type: 'message_start',
    message: {
      id: messageId,
      type: 'message',
      role: 'assistant',
      model,
      content: [],
      stop_reason: null,
      stop_sequence: null,
      usage: usageFromMetadata(null)
    }
  });

  let blockIndex = 0;
  let textOpen = false;
  let emitted = false;
  let usageMetadata = null;
  let finishReason = '';
  let hasTool = false;
  let lastTool = null;
  const closeText = () => {
    if (!textOpen) return;
    writeAnthropicEvent(res, 'content_block_stop', { type: 'content_block_stop', index: blockIndex });
    blockIndex += 1;
    textOpen = false;
  };

  try {
    for await (const payload of readSsePayloads(upstreamResponse.body, options.idleTimeoutMs)) {
      const root = payload && payload.response ? payload.response : payload;
      if (root && root.usageMetadata) usageMetadata = root.usageMetadata;
      for (const candidate of root && Array.isArray(root.candidates) ? root.candidates : []) {
        if (candidate.finishReason) finishReason = candidate.finishReason;
        const parts = candidate && candidate.content && Array.isArray(candidate.content.parts)
          ? candidate.content.parts : [];
        for (const part of parts) {
          if (part && typeof part.text === 'string' && part.text) {
            if (!textOpen) {
              writeAnthropicEvent(res, 'content_block_start', {
                type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' }
              });
              textOpen = true;
            }
            writeAnthropicEvent(res, 'content_block_delta', {
              type: 'content_block_delta', index: blockIndex,
              delta: { type: 'text_delta', text: part.text }
            });
            emitted = true;
          }
          if (part && part.functionCall) {
            closeText();
            const tool = toolUseFromPart(part, options);
            writeAnthropicEvent(res, 'content_block_start', {
              type: 'content_block_start', index: blockIndex,
              content_block: { type: 'tool_use', id: tool.block.id, name: tool.block.name, input: {} }
            });
            writeAnthropicEvent(res, 'content_block_delta', {
              type: 'content_block_delta', index: blockIndex,
              delta: { type: 'input_json_delta', partial_json: JSON.stringify(tool.block.input) }
            });
            writeAnthropicEvent(res, 'content_block_stop', { type: 'content_block_stop', index: blockIndex });
            blockIndex += 1;
            hasTool = true;
            emitted = true;
            lastTool = tool.cacheItem;
          } else if (part && part.thoughtSignature && lastTool && options.onToolCall) {
            options.onToolCall(lastTool, {
              name: lastTool.name,
              kind: 'function',
              thoughtSignature: part.thoughtSignature
            });
          }
        }
      }
    }
    closeText();
    if (!emitted) throw new Error(finishReason === 'MAX_TOKENS'
      ? '模型输出额度被思考内容耗尽，请提高 max_tokens' : 'Cloud Code 返回了空响应');
    const usage = usageFromMetadata(usageMetadata);
    writeAnthropicEvent(res, 'message_delta', {
      type: 'message_delta',
      delta: {
        stop_reason: hasTool ? 'tool_use' : finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn',
        stop_sequence: null
      },
      usage: { output_tokens: usage.output_tokens }
    });
    writeAnthropicEvent(res, 'message_stop', { type: 'message_stop' });
    if (usageMetadata && options.onUsage) options.onUsage(usageMetadata, model);
    res.end();
  } catch (error) {
    if (!res.writableEnded && !res.destroyed) {
      writeAnthropicEvent(res, 'error', {
        type: 'error', error: { type: 'api_error', message: error.message }
      });
      res.end();
    }
    throw error;
  }
}

function anthropicError(res, status, message, type = 'api_error') {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ type: 'error', error: { type, message } }));
}

function isLocalGatewayAuthorized(headers, apiKey) {
  const authorization = String(headers && headers.authorization || '');
  const xApiKey = String(headers && headers['x-api-key'] || '');
  return authorization === `Bearer ${apiKey}` || xApiKey === apiKey;
}

module.exports = {
  anthropicToResponsesRequest,
  estimateAnthropicInputTokens,
  createAnthropicMessage,
  streamAnthropicResponse,
  usageFromMetadata,
  anthropicError,
  isLocalGatewayAuthorized
};
