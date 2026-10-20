const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeTextAtomic } = require('./fsUtils');
const {
  buildCodexModelsResponse,
  buildAntigravityCodexModelsResponse,
  CUSTOM_PROVIDER_CONTEXT_WINDOW,
  CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT,
  ANTIGRAVITY_CONTEXT_WINDOW,
  ANTIGRAVITY_AUTO_COMPACT_PERCENT
} = require('./codexModels');

// Keep one provider id across AGY Hub, Cockpit, and custom Responses endpoints so
// Codex Desktop does not hide local threads when the endpoint changes.
const PROVIDER = 'codex_local_access';
const MANAGED_PROVIDERS = new Set([PROVIDER, 'agy_hub']);
const LEGACY_MODEL_CATALOG_FILE = 'agy-hub-model-catalog.json';

function modelCatalogFile(options = {}) {
  const identity = String(options.catalogKey || [
    options.providerName || 'AGY Hub',
    options.baseUrl || '',
    ...(Array.isArray(options.models) ? options.models : [])
  ].join('|'));
  const digest = crypto.createHash('sha256').update(identity).digest('hex').slice(0, 12);
  return `agy-hub-model-catalog-${digest}.json`;
}

function quoteToml(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function removeManagedProvider(text) {
  const lines = String(text || '').split(/\r?\n/);
  const output = [];
  let skipping = false;
  for (const line of lines) {
    const table = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (table) {
      skipping = MANAGED_PROVIDERS.has(table[1].trim().replace(/^model_providers\./, ''));
      if (skipping) continue;
    }
    if (!skipping) output.push(line);
  }
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function setRootValue(text, key, value) {
  const lines = String(text || '').split(/\r?\n/);
  let inRoot = true;
  let replaced = false;
  const result = [];
  const matcher = new RegExp(`^\\s*${key.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*=`);
  for (const line of lines) {
    if (/^\s*\[/.test(line)) inRoot = false;
    if (inRoot && matcher.test(line)) {
      if (!replaced) result.push(`${key} = ${quoteToml(value)}`);
      replaced = true;
      continue;
    }
    result.push(line);
  }
  if (!replaced) result.unshift(`${key} = ${quoteToml(value)}`);
  return result.join('\n');
}

function buildCodexConfig(existing, options) {
  if (options.protocol && options.protocol !== 'responses') {
    throw new Error('当前 Codex 仅支持 Responses 协议');
  }
  let text = removeManagedProvider(existing);
  text = setRootValue(text, 'model_provider', PROVIDER);
  text = setRootValue(text, 'model', options.model);
  text = setRootValue(text, 'model_catalog_json', options.catalogPath || LEGACY_MODEL_CATALOG_FILE);
  const displayName = String(options.providerName || 'Sub2API').trim().slice(0, 60) || 'Sub2API';
  const safeProviderName = displayName;
  const section = [
    `[model_providers.${PROVIDER}]`,
    `name = ${quoteToml(safeProviderName)}`,
    'wire_api = "responses"',
    `requires_openai_auth = ${options.requiresOpenAIAuth === true ? 'true' : 'false'}`,
    'supports_websockets = false',
    `request_max_retries = ${Number.isInteger(options.requestMaxRetries) ? options.requestMaxRetries : 1}`,
    `stream_max_retries = ${Number.isInteger(options.streamMaxRetries) ? options.streamMaxRetries : 1}`,
    `stream_idle_timeout_ms = ${Number.isInteger(options.streamIdleTimeoutMs) ? options.streamIdleTimeoutMs : 120000}`,
    `base_url = ${quoteToml(options.baseUrl)}`,
    `experimental_bearer_token = ${quoteToml(options.apiKey)}`
  ].join('\n');
  return `${text.trim()}\n\n${section}\n`;
}

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function connectCodex(options) {
  const { codexHome, stateDir, baseUrl, apiKey, model } = options;
  const configPath = path.join(codexHome, 'config.toml');
  const authPath = path.join(codexHome, 'auth.json');
  const catalogFile = modelCatalogFile(options);
  const catalogPath = path.join(codexHome, catalogFile);
  const backupRoot = path.join(stateDir, 'codex-backups');
  const statePath = path.join(stateDir, 'codex-connection.json');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  let state = null;
  if (fs.existsSync(statePath)) {
    try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (_) {}
  }
  if (!state || !state.backupDir || !fs.existsSync(state.backupDir)) {
    const backupDir = path.join(backupRoot, timestamp);
    ensureDirectory(backupDir);
    const configExisted = fs.existsSync(configPath);
    const authExisted = fs.existsSync(authPath);
    if (configExisted) fs.copyFileSync(configPath, path.join(backupDir, 'config.toml'));
    if (authExisted) fs.copyFileSync(authPath, path.join(backupDir, 'auth.json'));
    state = {
      backupDir, configExisted, authExisted,
      configPath, authPath, catalogs: [], connectedAt: new Date().toISOString()
    };
  }

  if (!Array.isArray(state.catalogs)) state.catalogs = [];
  if (!state.catalogs.some(item => item && item.catalogPath === catalogPath)) {
    const catalogExisted = fs.existsSync(catalogPath);
    const backupName = `catalog-${state.catalogs.length}.json`;
    if (catalogExisted) fs.copyFileSync(catalogPath, path.join(state.backupDir, backupName));
    state.catalogs.push({ catalogPath, catalogExisted, backupName });
  }

  const existingConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
  let auth = {};
  if (fs.existsSync(authPath)) {
    try { auth = JSON.parse(fs.readFileSync(authPath, 'utf8')); } catch (_) {}
  }
  auth.OPENAI_API_KEY = apiKey;

  const nextConfig = buildCodexConfig(existingConfig, {
    baseUrl,
    apiKey,
    model,
    catalogPath: catalogFile,
    protocol: options.protocol,
    providerName: options.providerName,
    requiresOpenAIAuth: options.requiresOpenAIAuth
  });
  const models = Array.isArray(options.models) && options.models.length
    ? [...new Set(options.models.map(value => String(value).trim()).filter(Boolean))]
    : null;
  const catalog = options.antigravity
    ? buildAntigravityCodexModelsResponse({
      models: models || undefined,
      contextWindow: options.contextWindow || ANTIGRAVITY_CONTEXT_WINDOW,
      autoCompactPercent: options.autoCompactPercent || ANTIGRAVITY_AUTO_COMPACT_PERCENT
    })
    : models
      ? buildCodexModelsResponse(models, {
        description: `${options.providerName || 'Custom Provider'} model exposed through an OpenAI Responses-compatible endpoint.`,
        contextWindow: options.contextWindow || CUSTOM_PROVIDER_CONTEXT_WINDOW,
        autoCompactPercent: options.autoCompactPercent || CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT
      })
      : buildCodexModelsResponse();
  // Publish dependencies before config.toml. Codex watches config.toml and may
  // reload it immediately; publishing the config first can make every open
  // thread observe a missing or incomplete model catalog during reconnect.
  writeTextAtomic(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
  const publishedCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
  if (!Array.isArray(publishedCatalog.models) || publishedCatalog.models.length === 0) {
    throw new Error('Codex 模型目录发布校验失败');
  }
  writeTextAtomic(authPath, `${JSON.stringify(auth, null, 2)}\n`);
  writeTextAtomic(configPath, nextConfig);

  state.updatedAt = new Date().toISOString();
  writeTextAtomic(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return { ...state, activeCatalogPath: catalogPath, activeCatalogFile: catalogFile, modelCount: catalog.models.length };
}

function restoreCodex({ stateDir }) {
  const statePath = path.join(stateDir, 'codex-connection.json');
  if (!fs.existsSync(statePath)) throw new Error('没有可恢复的 Codex 配置备份');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  if (state.configExisted) {
    fs.copyFileSync(path.join(state.backupDir, 'config.toml'), state.configPath);
  } else if (fs.existsSync(state.configPath)) {
    fs.unlinkSync(state.configPath);
  }
  if (state.authExisted) {
    fs.copyFileSync(path.join(state.backupDir, 'auth.json'), state.authPath);
  } else if (fs.existsSync(state.authPath)) {
    fs.unlinkSync(state.authPath);
  }
  const catalogs = Array.isArray(state.catalogs) ? state.catalogs : [];
  for (const catalog of catalogs) {
    if (!catalog || !catalog.catalogPath) continue;
    if (catalog.catalogExisted) {
      fs.copyFileSync(path.join(state.backupDir, catalog.backupName), catalog.catalogPath);
    } else if (fs.existsSync(catalog.catalogPath)) {
      fs.unlinkSync(catalog.catalogPath);
    }
  }
  if (state.catalogPath) {
    if (state.catalogExisted) {
      fs.copyFileSync(path.join(state.backupDir, LEGACY_MODEL_CATALOG_FILE), state.catalogPath);
    } else if (fs.existsSync(state.catalogPath)) {
      fs.unlinkSync(state.catalogPath);
    }
  }
  fs.unlinkSync(statePath);
  return { restoredFrom: state.backupDir };
}

module.exports = { buildCodexConfig, connectCodex, restoreCodex };
