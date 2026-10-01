const crypto = require('crypto');

const PROFILE_VERSION = 2;
const PROFILE_IDS = Object.freeze({
  CODEX_ANTIGRAVITY: 'codex-antigravity',
  CODEX_CUSTOM: 'codex-custom',
  CLAUDE_ANTIGRAVITY: 'claude-antigravity'
});

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : []).map(value => String(value).trim()).filter(Boolean))];
}

function validAgyModel(value, models, fallback, allowAuto = true) {
  const candidate = String(value || fallback);
  if (!models.includes(candidate)) return fallback;
  if (!allowAuto && candidate === 'agy-auto') return fallback;
  return candidate;
}

function activeCodexProfileId(config) {
  return config.activeCodexProfile === 'custom'
    ? PROFILE_IDS.CODEX_CUSTOM
    : PROFILE_IDS.CODEX_ANTIGRAVITY;
}

function profile(config, id) {
  return config.profiles[id];
}

function syncLegacyFields(config) {
  const codexAgy = profile(config, PROFILE_IDS.CODEX_ANTIGRAVITY);
  const codexCustom = profile(config, PROFILE_IDS.CODEX_CUSTOM);
  const claude = profile(config, PROFILE_IDS.CLAUDE_ANTIGRAVITY);
  const active = profile(config, activeCodexProfileId(config));
  config.version = PROFILE_VERSION;
  config.mode = config.activeCodexProfile === 'custom' ? 'custom' : 'antigravity';
  config.accountId = codexAgy.accountId;
  config.model = active.model;
  config.autoResolvedModel = codexAgy.autoResolvedModel;
  config.modelControl = active.modelControl;
  config.claudeModel = claude.model;
  config.claudeAccountId = claude.accountId;
  config.claudeAutoResolvedModel = claude.autoResolvedModel;
  config.customBaseUrl = codexCustom.baseUrl;
  config.customApiKey = codexCustom.apiKey;
  config.customProviderName = codexCustom.providerName;
  config.customModels = [...codexCustom.models];
  return config;
}

function normalizeGatewayConfig(stored = {}, options = {}) {
  const models = options.models || [];
  const defaultModel = options.defaultModel;
  const defaultClaudeModel = options.defaultClaudeModel;
  const savedProfiles = stored.profiles && typeof stored.profiles === 'object' ? stored.profiles : {};
  const savedAgy = savedProfiles[PROFILE_IDS.CODEX_ANTIGRAVITY] || {};
  const savedCustom = savedProfiles[PROFILE_IDS.CODEX_CUSTOM] || {};
  const savedClaude = savedProfiles[PROFILE_IDS.CLAUDE_ANTIGRAVITY] || {};
  const legacyMode = stored.mode === 'custom' ? 'custom' : 'antigravity';
  const legacyModel = legacyMode === 'antigravity' ? stored.model : defaultModel;
  const legacyCustomModel = legacyMode === 'custom' ? stored.model : '';

  const config = {
    version: PROFILE_VERSION,
    port: Number(stored.port) || Number(options.defaultPort),
    apiKey: String(stored.apiKey || `sk-agy-${crypto.randomBytes(24).toString('hex')}`),
    activeCodexProfile: stored.activeCodexProfile === 'custom' || legacyMode === 'custom'
      ? 'custom' : 'antigravity',
    profiles: {
      [PROFILE_IDS.CODEX_ANTIGRAVITY]: {
        accountId: String(savedAgy.accountId ?? stored.accountId ?? ''),
        model: validAgyModel(savedAgy.model ?? legacyModel, models, defaultModel),
        autoResolvedModel: validAgyModel(
          savedAgy.autoResolvedModel ?? stored.autoResolvedModel,
          models,
          defaultModel,
          false
        ),
        modelControl: (savedAgy.modelControl ?? stored.modelControl) === 'client' ? 'client' : 'gateway'
      },
      [PROFILE_IDS.CODEX_CUSTOM]: {
        providerId: String(savedCustom.providerId || stored.customProviderId || ''),
        providerName: String(savedCustom.providerName ?? stored.customProviderName ?? ''),
        baseUrl: String(savedCustom.baseUrl ?? stored.customBaseUrl ?? '').replace(/\/+$/, ''),
        apiKey: String(savedCustom.apiKey ?? stored.customApiKey ?? ''),
        protocol: String(savedCustom.protocol || stored.customProtocol || 'responses'),
        authMode: String(savedCustom.authMode || stored.customAuthMode || 'bearer'),
        authQueryName: String(savedCustom.authQueryName || stored.customAuthQueryName || 'key'),
        customHeaders: savedCustom.customHeaders && typeof savedCustom.customHeaders === 'object' ? { ...savedCustom.customHeaders } : {},
        fallbackBaseUrls: uniqueStrings(savedCustom.fallbackBaseUrls || stored.customFallbackBaseUrls),
        models: uniqueStrings(savedCustom.models ?? stored.customModels),
        model: String(savedCustom.model || legacyCustomModel || ''),
        modelControl: savedCustom.modelControl === 'gateway' ? 'gateway' : 'client'
      },
      [PROFILE_IDS.CLAUDE_ANTIGRAVITY]: {
        accountId: String(savedClaude.accountId ?? stored.claudeAccountId ?? stored.accountId ?? ''),
        model: validAgyModel(savedClaude.model ?? stored.claudeModel, models, defaultClaudeModel),
        autoResolvedModel: validAgyModel(
          savedClaude.autoResolvedModel ?? stored.claudeAutoResolvedModel ?? stored.autoResolvedModel,
          models,
          defaultModel,
          false
        )
      }
    }
  };
  const custom = profile(config, PROFILE_IDS.CODEX_CUSTOM);
  if (!custom.model || (custom.models.length && !custom.models.includes(custom.model))) {
    custom.model = custom.models[0] || custom.model;
  }
  return syncLegacyFields(config);
}

function inferProfileId(settings = {}) {
  if (Object.values(PROFILE_IDS).includes(settings.profileId)) return settings.profileId;
  if (settings.mode === 'custom' || settings.customBaseUrl !== undefined || settings.customModels !== undefined) {
    return PROFILE_IDS.CODEX_CUSTOM;
  }
  if (settings.claudeModel !== undefined || settings.claudeAccountId !== undefined) {
    return PROFILE_IDS.CLAUDE_ANTIGRAVITY;
  }
  return PROFILE_IDS.CODEX_ANTIGRAVITY;
}

function configureGatewayConfig(config, settings = {}, options = {}) {
  const models = options.models || [];
  const defaultModel = options.defaultModel;
  const defaultClaudeModel = options.defaultClaudeModel;
  const id = inferProfileId(settings);

  if (settings.port !== undefined) config.port = Number(settings.port);
  if (settings.activateCodexProfile === 'custom' || settings.activateCodexProfile === 'antigravity') {
    config.activeCodexProfile = settings.activateCodexProfile;
  } else if (settings.mode !== undefined) {
    config.activeCodexProfile = settings.mode === 'custom' ? 'custom' : 'antigravity';
  }

  if (id === PROFILE_IDS.CODEX_ANTIGRAVITY) {
    const target = profile(config, id);
    if (settings.accountId !== undefined) target.accountId = String(settings.accountId || '');
    if (settings.model !== undefined) target.model = validAgyModel(settings.model, models, defaultModel);
    if (settings.autoResolvedModel !== undefined) {
      target.autoResolvedModel = validAgyModel(settings.autoResolvedModel, models, defaultModel, false);
    }
    if (settings.modelControl !== undefined) target.modelControl = settings.modelControl === 'client' ? 'client' : 'gateway';
  } else if (id === PROFILE_IDS.CODEX_CUSTOM) {
    const target = profile(config, id);
    if (settings.providerId !== undefined) target.providerId = String(settings.providerId || '');
    if (settings.customProviderName !== undefined) target.providerName = String(settings.customProviderName || '').slice(0, 80);
    if (settings.customBaseUrl !== undefined) target.baseUrl = String(settings.customBaseUrl || '').replace(/\/+$/, '');
    if (settings.customApiKey !== undefined) target.apiKey = String(settings.customApiKey || '');
    if (settings.customProtocol !== undefined) target.protocol = String(settings.customProtocol || 'responses');
    if (settings.customAuthMode !== undefined) target.authMode = String(settings.customAuthMode || 'bearer');
    if (settings.customAuthQueryName !== undefined) target.authQueryName = String(settings.customAuthQueryName || 'key');
    if (settings.customHeaders !== undefined) target.customHeaders = settings.customHeaders && typeof settings.customHeaders === 'object' ? { ...settings.customHeaders } : {};
    if (settings.customFallbackBaseUrls !== undefined) target.fallbackBaseUrls = uniqueStrings(settings.customFallbackBaseUrls);
    if (settings.customModels !== undefined) target.models = uniqueStrings(settings.customModels);
    if (settings.model !== undefined) target.model = String(settings.model || '');
    if (target.models.length && !target.models.includes(target.model)) target.model = target.models[0];
    if (settings.modelControl !== undefined) target.modelControl = settings.modelControl === 'gateway' ? 'gateway' : 'client';
  } else {
    const target = profile(config, PROFILE_IDS.CLAUDE_ANTIGRAVITY);
    const accountValue = settings.claudeAccountId !== undefined ? settings.claudeAccountId : settings.accountId;
    if (accountValue !== undefined) target.accountId = String(accountValue || '');
    const modelValue = settings.claudeModel !== undefined ? settings.claudeModel : settings.model;
    if (modelValue !== undefined) target.model = validAgyModel(modelValue, models, defaultClaudeModel);
    if (settings.autoResolvedModel !== undefined) {
      target.autoResolvedModel = validAgyModel(settings.autoResolvedModel, models, defaultModel, false);
    }
  }
  return syncLegacyFields(config);
}

function publicProfiles(config) {
  const codexAgy = profile(config, PROFILE_IDS.CODEX_ANTIGRAVITY);
  const custom = profile(config, PROFILE_IDS.CODEX_CUSTOM);
  const claude = profile(config, PROFILE_IDS.CLAUDE_ANTIGRAVITY);
  return {
    codexAntigravity: { ...codexAgy },
    codexCustom: {
      providerId: custom.providerId,
      providerName: custom.providerName,
      baseUrl: custom.baseUrl,
      protocol: custom.protocol,
      authMode: custom.authMode,
      fallbackBaseUrls: [...custom.fallbackBaseUrls],
      models: [...custom.models],
      model: custom.model,
      modelControl: custom.modelControl,
      hasApiKey: Boolean(custom.apiKey)
    },
    claudeAntigravity: { ...claude }
  };
}

module.exports = {
  PROFILE_VERSION,
  PROFILE_IDS,
  normalizeGatewayConfig,
  configureGatewayConfig,
  activeCodexProfileId,
  profile,
  publicProfiles,
  syncLegacyFields
};
