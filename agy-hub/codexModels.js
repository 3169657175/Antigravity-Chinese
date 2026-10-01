const {
  KNOWN_MODEL_ORDER,
  MODEL_DISPLAY_NAMES,
  modelDisplayName,
  getAntigravityModelCatalog
} = require('./antigravityModelCatalog');

const MODELS = ['agy-auto', ...KNOWN_MODEL_ORDER];

// Codex Desktop can restrict the picker to model ids from its remote allowlist.
// Keep real Antigravity ids at the gateway boundary and expose allowlisted
// aliases only in Codex's model catalog.
const CODEX_VISIBLE_MODEL_ALIASES = {
  'gpt-5.6-sol': 'gemini-3.8-flash-high',
  'gpt-5.6-terra': 'gemini-3.8-flash-medium',
  'gpt-5.6-luna': 'gemini-3.8-flash-low',
  'gpt-5.5': 'gemini-3.1-pro-high',
  'gpt-5.4': 'gemini-3.1-pro-low',
  'gpt-5.4-mini': 'claude-sonnet-4-6',
  'gpt-5.3-codex': 'claude-opus-4-6-thinking',
  'gpt-5.6': 'gpt-oss-120b-medium'
};

const REAL_MODEL_TO_CODEX_ALIAS = Object.fromEntries(
  Object.entries(CODEX_VISIBLE_MODEL_ALIASES).map(([alias, model]) => [model, alias])
);
// Gateway-controlled mode ignores the client alias and follows the model
// selected in AGY Hub. Keep the legacy Lite route usable when it is explicitly
// selected in the gateway even though Codex's visible Luna slot now tracks the
// current Flash Low tier.
REAL_MODEL_TO_CODEX_ALIAS['gemini-3.5-flash-lite'] = 'gpt-5.6-luna';

const BASE_INSTRUCTIONS = [
  'You are Codex, a coding agent working with the user in the current workspace.',
  'Follow developer and user instructions, inspect relevant files before editing, preserve unrelated changes,',
  'use the available tools when needed, and continue through implementation and verification.',
  'Keep progress updates concise and make the final answer clear.'
].join(' ');

const AVAILABLE_PLANS = [
  'business', 'edu', 'edu_plus', 'edu_pro', 'education', 'enterprise',
  'enterprise_cbp_automation', 'enterprise_cbp_usage_based', 'finserv',
  'free', 'free_workspace', 'go', 'hc', 'k12', 'plus', 'pro', 'prolite',
  'quorum', 'sci', 'self_serve_business_usage_based', 'team'
];

// Custom Responses providers often expose an OpenAI-compatible model name
// without guaranteeing the same physical context window. Keep enough headroom
// for Codex's native ~90% auto-compaction trigger so the upstream never sees
// the 290K+ requests that previously disconnected before compaction.
const CUSTOM_PROVIDER_CONTEXT_WINDOW = 300000;
const CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT = 80;
const ANTIGRAVITY_CONTEXT_WINDOW = 360000;
const ANTIGRAVITY_AUTO_COMPACT_PERCENT = 75;

function displayName(slug) {
  return modelDisplayName(slug);
}

function modelInfo(slug, priority, options = {}) {
  const contextWindow = Number(options.contextWindow) || 1000000;
  const autoCompactPercent = Math.min(90, Math.max(50, Number(options.autoCompactPercent) || 90));
  return {
    slug,
    display_name: options.displayName || displayName(slug),
    description: options.description || (slug === 'agy-auto'
      ? 'AGY Hub selects an Antigravity model from the current account quota.'
      : 'Antigravity model exposed through the local AGY Hub Responses gateway.'),
    default_reasoning_level: 'medium',
    supported_reasoning_levels: [
      { effort: 'low', description: 'Faster responses' },
      { effort: 'medium', description: 'Balanced reasoning' },
      { effort: 'high', description: 'Deeper reasoning' }
    ],
    shell_type: 'shell_command',
    visibility: 'list',
    supported_in_api: true,
    priority,
    prefer_websockets: false,
    additional_speed_tiers: [],
    auto_review_model_override: null,
    availability_nux: null,
    available_in_plans: AVAILABLE_PLANS,
    comp_hash: '3000',
    default_service_tier: null,
    minimal_client_version: '0.144.0',
    multi_agent_version: 'v2',
    upgrade: null,
    base_instructions: BASE_INSTRUCTIONS,
    model_messages: null,
    include_skills_usage_instructions: true,
    supports_reasoning_summary_parameter: true,
    supports_reasoning_summaries: true,
    reasoning_summary_format: 'experimental',
    default_reasoning_summary: 'auto',
    support_verbosity: false,
    default_verbosity: null,
    apply_patch_tool_type: 'freeform',
    web_search_tool_type: 'text',
    truncation_policy: { mode: 'tokens', limit: 10000 },
    supports_parallel_tool_calls: true,
    supports_image_detail_original: true,
    context_window: contextWindow,
    max_context_window: contextWindow,
    auto_compact_token_limit: Math.floor(contextWindow * autoCompactPercent / 100),
    effective_context_window_percent: autoCompactPercent,
    experimental_supported_tools: [],
    input_modalities: ['text', 'image'],
    supports_search_tool: false,
    service_tiers: [],
    tool_mode: 'code_mode_only',
    use_responses_lite: false
  };
}

function buildCodexModelsResponse(slugs = MODELS, options = {}) {
  return { models: slugs.map((slug, index) => modelInfo(slug, index + 1, options)) };
}

function codexVisibleModelAliasesForModels(slugs) {
  const supplied = Array.isArray(slugs) ? [...new Set(slugs.map(String).filter(Boolean))] : [];
  const live = supplied.length ? supplied : getAntigravityModelCatalog().models;
  if (!live.length) return { ...CODEX_VISIBLE_MODEL_ALIASES };
  const available = new Set(live.filter(model => model !== 'agy-auto'));
  const aliases = {};
  const assignedModels = new Set();

  for (const [alias, preferredModel] of Object.entries(CODEX_VISIBLE_MODEL_ALIASES)) {
    if (!available.has(preferredModel)) continue;
    aliases[alias] = preferredModel;
    assignedModels.add(preferredModel);
  }

  // Codex Desktop only shows allowlisted model ids. Reuse slots whose preferred
  // Antigravity model is currently absent so newly published Antigravity models
  // can still appear without inventing a model id Codex will hide.
  const freeAliases = Object.keys(CODEX_VISIBLE_MODEL_ALIASES).filter(alias => !aliases[alias]);
  for (const model of available) {
    if (assignedModels.has(model) || !freeAliases.length) continue;
    aliases[freeAliases.shift()] = model;
    assignedModels.add(model);
  }
  return aliases;
}

function buildAntigravityCodexModelsResponse(options = {}) {
  const aliases = codexVisibleModelAliasesForModels(options.models);
  return {
    models: Object.entries(aliases).map(([alias, model], index) => modelInfo(alias, index + 1, {
      ...options,
      displayName: modelDisplayName(model),
      description: `Antigravity model ${model} exposed through the local AGY Hub Responses gateway.`
    }))
  };
}

function resolveCodexModelAlias(model) {
  const value = String(model || '');
  const aliases = codexVisibleModelAliasesForModels();
  return aliases[value] || CODEX_VISIBLE_MODEL_ALIASES[value] || value;
}

function codexAliasForModel(model) {
  const value = String(model || '');
  const aliases = codexVisibleModelAliasesForModels();
  const liveAlias = Object.entries(aliases).find(([, realModel]) => realModel === value)?.[0];
  return liveAlias || REAL_MODEL_TO_CODEX_ALIAS[value] || value;
}

module.exports = {
  MODELS,
  MODEL_DISPLAY_NAMES,
  CODEX_VISIBLE_MODEL_ALIASES,
  CUSTOM_PROVIDER_CONTEXT_WINDOW,
  CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT,
  ANTIGRAVITY_CONTEXT_WINDOW,
  ANTIGRAVITY_AUTO_COMPACT_PERCENT,
  modelInfo,
  buildCodexModelsResponse,
  buildAntigravityCodexModelsResponse,
  codexVisibleModelAliasesForModels,
  resolveCodexModelAlias,
  codexAliasForModel
};
