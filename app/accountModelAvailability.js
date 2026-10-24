// Account-scoped model directory derived only from authenticated upstream metadata.
// Never records access tokens or treats another account's live model list as valid.
const { normalizeAvailableModels } = require('./antigravityModelCatalog');
const catalog = new Map();
const TTL = 5 * 60 * 1000;
function setModelsForAccount(accountId, ids, source = 'oauth-cloud', now = Date.now()) {
  const key = String(accountId || '');
  if (!/^[\w-]{1,128}$/.test(key)) return null;
  const raw = Array.isArray(ids) ? ids.filter(v => typeof v === 'string').slice(0, 2000) : [];
  const previous = catalog.get(key);
  const previousIsFresh = previous && now - previous.checkedAt >= 0 && now - previous.checkedAt < TTL;
  // Both feeds describe models available to the same OAuth account. The IDE
  // feed can be more complete than Cloud Code, while Cloud Code can expose
  // newer routes (e.g. Claude 5.5 and Argon) absent from the IDE cache. Merge
  // fresh evidence from both instead of silently discarding either source.
  const mergeFreshSources = previousIsFresh
    && ((previous.source === 'local-language-server' && source === 'oauth-cloud')
      || (previous.source === 'oauth-cloud' && source === 'local-language-server')
      || previous.source === 'oauth-cloud+local-language-server');
  const combinedRaw = mergeFreshSources
    ? [...new Set([...previous.rawModelIds, ...raw])].slice(0, 2000)
    : raw;
  const normalized = normalizeAvailableModels({ models: Object.fromEntries(combinedRaw.map(id => [id, {}])) });
  if (!normalized.models.length) return null;
  const combinedSource = mergeFreshSources ? 'oauth-cloud+local-language-server' : source;
  const value = { modelIds: normalized.models, rawModelIds: normalized.rawModels, source: combinedSource, checkedAt: now };
  catalog.set(key, value);
  return value;
}
function modelsForAccount(accountId, now = Date.now()) {
  const entry = catalog.get(String(accountId || ''));
  return entry && now - entry.checkedAt >= 0 && now - entry.checkedAt < TTL ? { ...entry, modelIds: [...entry.modelIds] } : null;
}
function clearModelsForAccount(accountId) { catalog.delete(String(accountId || '')); }
function gatewayModelsForAccount(accountId, liveModels, fallback) {
  const id = String(accountId || '');
  const scoped = id && modelsForAccount(id);
  if (scoped?.modelIds?.length) return ['agy-auto', ...scoped.modelIds];
  if (id) {
    // A cached Language Server catalog belongs to the IDE's active login,
    // not necessarily the account configured for the Codex reverse proxy.
    const fs = require('fs'), path = require('path'), os = require('os');
    try {
      const registry = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.gemini', 'antigravity', 'tools', 'accounts.json'), 'utf8'));
      if (String(registry.current_account_id || '') !== id) return [...fallback];
    } catch (_) { return [...fallback]; }
  }
  return Array.isArray(liveModels) && liveModels.length
    ? ['agy-auto', ...liveModels.filter(model => model !== 'agy-auto')]
    : [...fallback];
}
module.exports = { setModelsForAccount, modelsForAccount, clearModelsForAccount, gatewayModelsForAccount };
