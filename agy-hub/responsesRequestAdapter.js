const crypto = require('crypto');

const COMPACTION_TOOL_OUTPUT_CHARS = 12000;

function truncateForCompaction(value, limit = COMPACTION_TOOL_OUTPUT_CHARS) {
  const text = String(value || '');
  if (text.length <= limit) return text;
  const half = Math.max(1, Math.floor((limit - 90) / 2));
  return `${text.slice(0, half)}\n...[压缩时省略 ${text.length - half * 2} 个字符]...\n${text.slice(-half)}`;
}


function mergeObjectSchemas(target, source) {
  if (!source || typeof source !== 'object') return target;
  if (!target.type && source.type) target.type = source.type;
  if (!target.description && source.description) target.description = source.description;
  if (source.nullable) target.nullable = true;
  if (source.properties) target.properties = { ...(target.properties || {}), ...source.properties };
  if (Array.isArray(source.required)) {
    target.required = [...new Set([...(target.required || []), ...source.required])];
  }
  if (!target.items && source.items) target.items = source.items;
  if (!target.enum && source.enum) target.enum = source.enum;
  if (!target.anyOf && source.anyOf) target.anyOf = source.anyOf;
  return target;
}

// Cloud Code's functionDeclarations.parameters uses Google's restricted
// Schema protobuf, not full JSON Schema. Keep only supported fields and
// translate common Claude Desktop schema constructs instead of forwarding
// unsupported keywords such as propertyNames, exclusiveMinimum or const.
function cleanSchema(value, depth = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  if (depth > 32) return {};

  const result = {};
  const rawTypes = Array.isArray(value.type) ? value.type : [value.type];
  const types = rawTypes.filter(type => typeof type === 'string' && type !== 'null');
  if (rawTypes.includes('null') || value.nullable === true || value.const === null) result.nullable = true;
  if (types[0]) result.type = types[0];
  if (typeof value.description === 'string' && value.description) result.description = value.description;
  if (typeof value.format === 'string' && value.format) result.format = value.format;

  if (value.const !== undefined && value.const !== null && ['string', 'number', 'boolean'].includes(typeof value.const)) {
    if (!result.type) result.type = typeof value.const === 'number'
      ? (Number.isInteger(value.const) ? 'integer' : 'number')
      : typeof value.const;
    result.enum = [String(value.const)];
  } else if (Array.isArray(value.enum)) {
    const enumValues = value.enum.filter(item => item !== null && ['string', 'number', 'boolean'].includes(typeof item));
    if (value.enum.includes(null)) result.nullable = true;
    if (enumValues.length) result.enum = enumValues.map(String);
  }

  if (value.properties && typeof value.properties === 'object' && !Array.isArray(value.properties)) {
    result.type = result.type || 'object';
    result.properties = {};
    for (const [name, schema] of Object.entries(value.properties)) {
      result.properties[name] = cleanSchema(schema, depth + 1);
    }
  }

  if (value.items && typeof value.items === 'object') {
    result.type = result.type || 'array';
    const itemSchema = Array.isArray(value.items) ? value.items[0] : value.items;
    result.items = cleanSchema(itemSchema, depth + 1);
  } else if (Array.isArray(value.prefixItems) && value.prefixItems.length) {
    result.type = result.type || 'array';
    result.items = cleanSchema(value.prefixItems[0], depth + 1);
  }

  const alternatives = Array.isArray(value.anyOf) ? value.anyOf
    : Array.isArray(value.oneOf) ? value.oneOf : [];
  if (alternatives.length) {
    const cleaned = alternatives.map(schema => cleanSchema(schema, depth + 1));
    const nullableOnly = cleaned.filter(schema => schema.nullable && Object.keys(schema).length === 1);
    const concrete = cleaned.filter(schema => !(schema.nullable && Object.keys(schema).length === 1));
    if (nullableOnly.length) result.nullable = true;
    if (concrete.length === 1 && !result.type && !result.properties && !result.items) {
      mergeObjectSchemas(result, concrete[0]);
    } else if (concrete.length) {
      result.anyOf = concrete;
    }
  }

  if (Array.isArray(value.allOf)) {
    for (const schema of value.allOf) mergeObjectSchemas(result, cleanSchema(schema, depth + 1));
    if (result.properties) {
      const required = value.allOf
        .flatMap(schema => Array.isArray(schema && schema.required) ? schema.required : [])
        .filter(name => typeof name === 'string' && name in result.properties);
      if (required.length) result.required = [...new Set([...(result.required || []), ...required])];
    }
  }

  if (Array.isArray(value.required) && result.properties) {
    const required = value.required.filter(name => typeof name === 'string' && name in result.properties);
    if (required.length) result.required = [...new Set(required)];
  }
  if (Array.isArray(value.propertyOrdering) && result.properties) {
    const ordering = value.propertyOrdering.filter(name => typeof name === 'string' && name in result.properties);
    if (ordering.length) result.propertyOrdering = ordering;
  }

  return result;
}

// Last-resort schema used only when Claude's downstream validator points to a
// specific tool. Keep names, basic types and descriptions, but remove every
// extension/constraint that can become invalid while Cloud Code translates
// Google Schema into Anthropic JSON Schema.
function toClaudeSafeSchema(value, depth = 0) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || depth > 24) return {};
  const result = {};
  const allowedTypes = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean']);
  if (allowedTypes.has(value.type)) result.type = value.type;
  if (typeof value.description === 'string' && value.description) result.description = value.description;

  if (value.properties && typeof value.properties === 'object' && !Array.isArray(value.properties)) {
    result.type = 'object';
    result.properties = Object.fromEntries(Object.entries(value.properties)
      .map(([name, schema]) => [name, toClaudeSafeSchema(schema, depth + 1)]));
    if (Array.isArray(value.required)) {
      const required = [...new Set(value.required.filter(name => typeof name === 'string' && name in result.properties))];
      if (required.length) result.required = required;
    }
  }

  if (value.items && typeof value.items === 'object') {
    result.type = 'array';
    result.items = toClaudeSafeSchema(value.items, depth + 1);
  }

  if (!result.type && Array.isArray(value.anyOf)) {
    const alternative = value.anyOf.map(schema => toClaudeSafeSchema(schema, depth + 1))
      .find(schema => schema.type || schema.properties || schema.items);
    if (alternative) Object.assign(result, alternative);
  }

  if ((!result.type || result.type === 'string') && Array.isArray(value.enum)) {
    const stringValues = value.enum.filter(item => typeof item === 'string');
    if (stringValues.length) {
      result.type = result.type || 'string';
      result.enum = [...new Set(stringValues)];
    }
  }
  return result;
}

function contentToParts(content, options = {}) {
  if (typeof content === 'string') return [{ text: content }];
  if (!Array.isArray(content)) return [];
  const parts = [];
  for (const item of content) {
    if (!item || typeof item !== 'object') continue;
    if (['input_text', 'output_text', 'text'].includes(item.type || 'text') && item.text !== undefined) {
      parts.push({ text: String(item.text) });
      continue;
    }
    if (item.type === 'input_image' && typeof item.image_url === 'string') {
      if (options.stripImages) {
        if (!parts.some(part => part.text === '[Image omitted during context compaction]')) {
          parts.push({ text: '[Image omitted during context compaction]' });
        }
        continue;
      }
      const match = /^data:([^;,]+);base64,(.+)$/s.exec(item.image_url);
      if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
      else parts.push({ text: `[Image: ${item.image_url}]` });
    }
  }
  return parts;
}

function outputToText(output) {
  if (typeof output === 'string') return output;
  if (Array.isArray(output)) {
    const text = output.map(item => item && item.text).filter(Boolean).join('\n');
    return text || JSON.stringify(output);
  }
  if (output && typeof output === 'object' && typeof output.content === 'string') return output.content;
  return output === undefined ? '' : JSON.stringify(output);
}

function callInfo(item, cache) {
  const key = item.call_id || item.id;
  const cached = key && cache && cache.get(key);
  if (item.type === 'custom_tool_call') {
    return { name: item.name || (cached && cached.name) || 'tool', args: { input: String(item.input || '') } };
  }
  if (item.type === 'local_shell_call') {
    return { name: 'shell', args: item.action || {} };
  }
  let args = {};
  try { args = JSON.parse(item.arguments || '{}'); } catch (_) {}
  return { name: item.name || (cached && cached.name) || 'tool', args };
}

function toolDeclarations(tools) {
  const declarations = [];
  const kinds = new Map();
  for (const tool of Array.isArray(tools) ? tools : []) {
    if (!tool || !tool.name || !['function', 'custom'].includes(tool.type)) continue;
    kinds.set(tool.name, tool.type);
    declarations.push({
      name: tool.name,
      description: tool.description || '',
      parameters: tool.type === 'custom'
        ? { type: 'object', properties: { input: { type: 'string' } }, required: ['input'] }
        : cleanSchema(tool.parameters || { type: 'object', properties: {} })
    });
  }
  return { declarations, kinds };
}

function convertResponsesRequest(body, options = {}) {
  const contents = [];
  const callNames = new Map();
  const callCache = options.toolCallCache || new Map();
  const input = typeof body.input === 'string'
    ? [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: body.input }] }]
    : Array.isArray(body.input) ? body.input : [];

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const key = item.call_id || item.id;
    if (['function_call', 'custom_tool_call', 'local_shell_call'].includes(item.type) && key) {
      callNames.set(key, callInfo(item, callCache).name);
    }
  }

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    if (item.type === 'message' || item.role) {
      const role = item.role === 'assistant' ? 'model' : 'user';
      const parts = contentToParts(item.content, options);
      if (parts.length) contents.push({ role, parts });
    } else if (['function_call', 'custom_tool_call', 'local_shell_call'].includes(item.type)) {
      const info = callInfo(item, callCache);
      const callId = item.call_id || item.id || `call_${crypto.randomBytes(8).toString('hex')}`;
      const part = { functionCall: { id: callId, name: info.name, args: info.args } };
      const cached = (item.call_id || item.id) && callCache.get(item.call_id || item.id);
      if (cached && cached.thoughtSignature) part.thoughtSignature = cached.thoughtSignature;
      contents.push({ role: 'model', parts: [part] });
    } else if (['function_call_output', 'custom_tool_call_output'].includes(item.type)) {
      const callId = item.call_id || item.id || '';
      const cached = callId && callCache.get(callId);
      const name = callNames.get(callId) || (cached && cached.name) || item.name || 'tool';
      const funcResp = {
        name,
        response: { result: options.compaction
          ? truncateForCompaction(outputToText(item.output))
          : outputToText(item.output) }
      };
      if (callId) funcResp.id = callId;
      contents.push({
        role: 'user',
        parts: [{ functionResponse: funcResp }]
      });
    }
  }

  if (!contents.length) contents.push({ role: 'user', parts: [{ text: '' }] });
  const request = { contents };
  const instructions = String(body.instructions || '').trim();
  let finalInstructions = instructions;
  if (String(body.model || '').includes('gemini')) {
    finalInstructions = finalInstructions ? finalInstructions + '\n\n' + 'Please always respond in Chinese. 请始终使用中文回答。' : 'Please always respond in Chinese. 请始终使用中文回答。';
  }
  if (finalInstructions) request.systemInstruction = { role: 'user', parts: [{ text: finalInstructions }] };

  const { declarations } = toolDeclarations(options.compaction ? [] : body.tools);
  if (declarations.length) {
    request.tools = [{ functionDeclarations: declarations }];
    request.toolConfig = { functionCallingConfig: { mode: 'VALIDATED' } };
  }

  request.generationConfig = {
    maxOutputTokens: options.compaction
      ? Math.min(Math.max(Number(body.max_output_tokens) || 8192, 2048), 8192)
      : Math.max(1, Math.min(Number(body.max_output_tokens) || 16384, 65536))
  };
  if (Number.isFinite(body.temperature)) request.generationConfig.temperature = body.temperature;
  const modelName = String(body.model || '');
  const isGemini3 = /^gemini-3(?:\.|-|$)/i.test(modelName);
  if (isGemini3) {
    const explicitLevel = String(options.thinkingLevel || '').toLowerCase();
    const suffixLevel = /-(high|medium|low)$/i.exec(modelName)?.[1]?.toLowerCase() || '';
    const level = ['low', 'medium', 'high'].includes(explicitLevel)
      ? explicitLevel
      : (['low', 'medium', 'high'].includes(suffixLevel) ? suffixLevel : '');
    request.generationConfig.thinkingConfig = {
      includeThoughts: true,
      ...(level ? { thinkingLevel: level } : {})
    };
  } else if (modelName.includes('pro') || modelName.includes('thinking')) {
    request.generationConfig.thinkingConfig = { includeThoughts: true };
  }
  return request;
}


module.exports = {
  truncateForCompaction,
  mergeObjectSchemas,
  cleanSchema,
  toClaudeSafeSchema,
  contentToParts,
  outputToText,
  callInfo,
  toolDeclarations,
  convertResponsesRequest
};
