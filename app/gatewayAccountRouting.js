const { PROFILE_IDS, profile } = require('./gatewayProfiles.js');
const { modelForClaudeRoute } = require('./claudeModelRoutes.js');

function accountIdForSettings(config, settings = {}) {
  const claude = settings.profileId === PROFILE_IDS.CLAUDE_ANTIGRAVITY
    || settings.claudeModel !== undefined
    || settings.claudeAccountId !== undefined;
  const current = profile(config, claude ? PROFILE_IDS.CLAUDE_ANTIGRAVITY : PROFILE_IDS.CODEX_ANTIGRAVITY);
  return claude
    ? String(settings.claudeAccountId ?? settings.accountId ?? current.accountId ?? '')
    : String(settings.accountId ?? current.accountId ?? '');
}

function diagnosticRouteFromHeaders(headers = {}, modelsForAccount = () => []) {
  const accountId = String(headers['x-agy-account-id'] || '').trim();
  const model = String(headers['x-agy-diagnostic-model'] || '').trim();
  if (model && (!accountId || model === 'agy-auto' || !modelsForAccount(accountId).includes(model))) {
    const error = new Error('诊断请求指定的账号或模型无效');
    error.statusCode = 400;
    error.code = 'invalid_diagnostic_route';
    throw error;
  }
  return {
    accountId,
    model,
    active: Boolean(accountId && model),
    upstreamOptions(compaction) {
      return { compaction, accountId, modelOverride: model || undefined, profileId: PROFILE_IDS.CODEX_ANTIGRAVITY };
    }
  };
}

function claudeRouteFromRequest(headers, requestedModel, claudeProfile, modelsForAccount) {
  const accountId = String(headers['x-agy-account-id'] || '').trim() || claudeProfile.accountId;
  return { accountId, model: modelForClaudeRoute(requestedModel, claudeProfile.model, modelsForAccount(accountId)) };
}

module.exports = { accountIdForSettings, diagnosticRouteFromHeaders, claudeRouteFromRequest };
