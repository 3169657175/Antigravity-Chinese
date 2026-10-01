const crypto = require('crypto');
const { getAntigravityModelCatalog } = require('./antigravityModelCatalog');

const CLAUDE_MODEL_ROUTES = [
  { route: 'claude-sonnet-4-5-agy-auto', model: 'agy-auto', label: 'AGY 自动路由', tier: 'sonnet' },
  { route: 'claude-haiku-4-5-agy-35fl', model: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', tier: 'haiku' },
  { route: 'claude-haiku-4-5-agy-36fh', model: 'gemini-3.6-flash-high', label: 'Gemini 3.6 Flash (High)', tier: 'haiku' },
  { route: 'claude-haiku-4-5-agy-36fm', model: 'gemini-3.6-flash-medium', label: 'Gemini 3.6 Flash (Medium)', tier: 'haiku' },
  { route: 'claude-haiku-4-5-agy-36fl', model: 'gemini-3.6-flash-low', label: 'Gemini 3.6 Flash (Low)', tier: 'haiku' },
  { route: 'claude-sonnet-4-5-agy-31ph', model: 'gemini-3.1-pro-high', label: 'Gemini 3.1 Pro (High)', tier: 'sonnet' },
  { route: 'claude-sonnet-4-5-agy-31pl', model: 'gemini-3.1-pro-low', label: 'Gemini 3.1 Pro (Low)', tier: 'sonnet' },
  { route: 'claude-sonnet-4-6', model: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', tier: 'sonnet' },
  { route: 'claude-opus-4-6', model: 'claude-opus-4-6-thinking', label: 'Claude Opus 4.6 Thinking', tier: 'opus' },
  { route: 'claude-sonnet-4-5-agy-oss', model: 'gpt-oss-120b-medium', label: 'GPT-OSS 120B (Medium)', tier: 'sonnet' }
];

function dynamicClaudeRoute(model) {
  const value = String(model || '');
  const tier = /opus/i.test(value) ? 'opus' : /flash|haiku/i.test(value) ? 'haiku' : 'sonnet';
  const digest = crypto.createHash('sha1').update(value).digest('hex').slice(0, 10);
  return `claude-${tier}-4-5-agy-${digest}`;
}

function claudeRoutesForModels(availableModels) {
  const supplied = Array.isArray(availableModels) ? [...new Set(availableModels.map(String).filter(Boolean))] : [];
  const live = supplied.length ? supplied : getAntigravityModelCatalog().models;
  if (!live.length) return [...CLAUDE_MODEL_ROUTES];
  const available = new Set(live);
  const routes = CLAUDE_MODEL_ROUTES.filter(entry => entry.model === 'agy-auto' || available.has(entry.model));
  const known = new Set(CLAUDE_MODEL_ROUTES.map(entry => entry.model));
  for (const model of live) {
    if (model === 'agy-auto' || known.has(model)) continue;
    const tier = /opus/i.test(model) ? 'opus' : /flash|haiku/i.test(model) ? 'haiku' : 'sonnet';
    routes.push({ route: dynamicClaudeRoute(model), model, label: model, tier });
  }
  return routes.length ? routes : [...CLAUDE_MODEL_ROUTES];
}

function routeForClaudeModel(model, availableModels) {
  const routes = claudeRoutesForModels(availableModels);
  return routes.find(entry => entry.model === model)?.route
    || CLAUDE_MODEL_ROUTES.find(entry => entry.model === model)?.route
    || routes[0]?.route
    || CLAUDE_MODEL_ROUTES[0].route;
}

function modelForClaudeRoute(route, fallback = 'claude-sonnet-4-6', availableModels) {
  const normalized = String(route || '').replace(/\[1m\]$/i, '');
  const routes = claudeRoutesForModels(availableModels);
  const matched = routes.find(entry => entry.route === normalized)
    || CLAUDE_MODEL_ROUTES.find(entry => entry.route === normalized);
  if (matched) return matched.model;
  if (routes.some(entry => entry.model === normalized) || CLAUDE_MODEL_ROUTES.some(entry => entry.model === normalized)) return normalized;
  return fallback;
}

function claudePickerModels(selectedModel, availableModels) {
  const routes = claudeRoutesForModels(availableModels);
  const selectedRoute = routeForClaudeModel(selectedModel, availableModels);
  return [...routes]
    .sort((left, right) => Number(right.route === selectedRoute) - Number(left.route === selectedRoute))
    .map((entry, index) => ({
      name: entry.route,
      labelOverride: entry.label,
      anthropicFamilyTier: entry.tier,
      ...(index === 0 ? { isFamilyDefault: true } : {})
    }));
}

module.exports = {
  CLAUDE_MODEL_ROUTES,
  claudeRoutesForModels,
  routeForClaudeModel,
  modelForClaudeRoute,
  claudePickerModels
};
