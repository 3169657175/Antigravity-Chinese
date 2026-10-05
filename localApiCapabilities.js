const LOCAL_API_ROUTES = Object.freeze({
  models: Object.freeze(['/v1/models']),
  responses: Object.freeze(['/v1/responses', '/responses']),
  responsesCompact: Object.freeze(['/v1/responses/compact', '/responses/compact']),
  chatCompletions: Object.freeze(['/v1/chat/completions', '/chat/completions']),
  anthropicMessages: Object.freeze(['/v1/messages', '/messages']),
  anthropicCountTokens: Object.freeze(['/v1/messages/count_tokens', '/messages/count_tokens']),
  geminiModels: Object.freeze(['/v1beta/models']),
  geminiGenerate: Object.freeze([
    '/v1beta/models/{model}:generateContent',
    '/v1beta/models/{model}:streamGenerateContent',
    '/v1/models/{model}:generateContent',
    '/v1/models/{model}:streamGenerateContent'
  ])
});

const LOCAL_API_CAPABILITIES = Object.freeze({
  protocols: Object.freeze([
    Object.freeze({ id: 'openai-responses', label: 'OpenAI Responses', basePath: '/v1' }),
    Object.freeze({ id: 'openai-chat-completions', label: 'OpenAI Chat Completions', basePath: '/v1' }),
    Object.freeze({ id: 'anthropic-messages', label: 'Anthropic Messages', basePath: '' }),
    Object.freeze({ id: 'gemini-native', label: 'Gemini Native', basePath: '/v1beta' })
  ]),
  routes: Object.freeze([
    Object.freeze({ method: 'GET', path: '/v1/models', protocol: 'OpenAI', label: '模型列表' }),
    Object.freeze({ method: 'POST', path: '/v1/responses', protocol: 'OpenAI Responses', label: '生成响应' }),
    Object.freeze({ method: 'POST', path: '/v1/responses/compact', protocol: 'OpenAI Responses', label: '上下文压缩' }),
    Object.freeze({ method: 'POST', path: '/v1/chat/completions', protocol: 'OpenAI Chat Completions', label: '聊天生成（兼容流式）' }),
    Object.freeze({ method: 'POST', path: '/v1/messages', protocol: 'Anthropic Messages', label: '消息生成' }),
    Object.freeze({ method: 'POST', path: '/v1/messages/count_tokens', protocol: 'Anthropic Messages', label: 'Token 计数' }),
    Object.freeze({ method: 'GET', path: '/v1beta/models', protocol: 'Gemini Native', label: '模型列表' }),
    Object.freeze({ method: 'POST', path: '/v1beta/models/{model}:generateContent', protocol: 'Gemini Native', label: '内容生成' }),
    Object.freeze({ method: 'POST', path: '/v1beta/models/{model}:streamGenerateContent', protocol: 'Gemini Native', label: '流式内容生成' })
  ]),
  unsupported: Object.freeze(['embeddings', 'audio', 'image generation', 'moderations', 'files', 'batches', 'fine-tuning'])
});

module.exports = { LOCAL_API_ROUTES, LOCAL_API_CAPABILITIES };
