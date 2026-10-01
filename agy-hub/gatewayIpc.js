const path = require('path');
const os = require('os');
const { MODELS, classifyUpstreamError } = require('./codexGateway.js');
const { connectCodex, restoreCodex } = require('./codexConfig.js');
const { connectClaudeDesktop, restoreClaudeDesktop, getClaudeDesktopStatus } = require('./claudeDesktopConfig.js');
const {
  codexAliasForModel,
  CUSTOM_PROVIDER_CONTEXT_WINDOW,
  CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT,
  ANTIGRAVITY_CONTEXT_WINDOW,
  ANTIGRAVITY_AUTO_COMPACT_PERCENT
} = require('./codexModels.js');
const { readProfiles, saveProfile, deleteProfile } = require('./codexProviderProfiles.js');
const { restartOrLaunchCodex } = require('./codexAppLifecycle.js');
const { restartOrLaunchClaudeDesktop } = require('./claudeDesktopLifecycle.js');
const {
  runCodexThreeLevelTest,
  runClaudeThreeLevelTest,
  runCustomProviderThreeLevelTest
} = require('./gatewayTestRunner.js');
const { buildDiagnosticReport, formatDiagnosticReport } = require('./gatewayDiagnostics.js');
const { createSecretCodec } = require('./secretCodec.js');
const { PROTOCOLS, AUTH_MODES, normalizeBaseUrl, parseCustomHeaders, discoverModels } = require('./providerProtocol.js');
const { ConfigSnapshotStore } = require('./configSnapshotStore.js');
const { ProviderHealthStore } = require('./providerHealthStore.js');

function registerGatewayIpc(options) {
  const {
    ipcMain,
    app,
    net,
    safeStorage,
    requireCodexGateway,
    getProxyStatus,
    getTokenMonitorStatus = () => ({ running: false })
  } = options;
  const secretCodec = createSecretCodec(safeStorage);
  const snapshotStore = new ConfigSnapshotStore(app.getPath('userData'));
  const providerHealthStore = new ProviderHealthStore(app.getPath('userData'));

  ipcMain.handle('gateway-snapshot-create', async (_event, label) => {
    try { return { success: true, snapshot: snapshotStore.create(label) }; }
    catch (error) { return { success: false, error: error.message }; }
  });
  ipcMain.handle('gateway-snapshot-list', async () => ({ success: true, snapshots: snapshotStore.list() }));
  ipcMain.handle('gateway-snapshot-restore', async (_event, id) => {
    try { return { success: true, ...snapshotStore.restore(id) }; }
    catch (error) { return { success: false, error: error.message }; }
  });

ipcMain.handle('codex-gateway-status', async () => requireCodexGateway().status());
  
  ipcMain.handle('gateway-diagnostics', async () => {
    try {
      const gateway = requireCodexGateway();
      const gatewayStatus = gateway.status();
      const claudeStatus = getClaudeDesktopStatus({
        stateDir: app.getPath('userData'),
        baseUrl: gatewayStatus.claudeBaseUrl
      });
      const report = buildDiagnosticReport({
        gateway,
        appVersion: app.getVersion(),
        appPath: app.getAppPath(),
        executablePath: app.getPath('exe'),
        userData: app.getPath('userData'),
        codexHome: path.join(os.homedir(), '.codex'),
        claudeStatus,
        tokenMonitorStatus: {
          proxy: getProxyStatus(),
          localMonitor: getTokenMonitorStatus()
        },
        logLimit: 50
      });
      return { success: true, report, text: formatDiagnosticReport(report) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('codex-gateway-start', async (_event, settings) => {
    try {
      const gateway = requireCodexGateway();
      const before = gateway.status();
      const status = await gateway.start({ port: settings && settings.port });
      return { success: true, status, preservedMode: before.mode === status.mode };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('codex-gateway-stop', async () => {
    try {
      return { success: true, status: await requireCodexGateway().stop() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('codex-gateway-test', async (_event, settings) => {
    try {
      const gateway = requireCodexGateway();
      const result = await runCodexThreeLevelTest({
        gateway,
        fetch: net.fetch,
        settings: settings || {}
      });
      gateway.recordTestReport('codex-antigravity', result.report);
      return result;
    } catch (error) {
      const diagnostic = classifyUpstreamError(error);
      return { success: false, error: diagnostic.message, diagnostic };
    }
  });
  
  ipcMain.handle('codex-gateway-connect', async (_event, settings) => {
    try {
      const gateway = requireCodexGateway();
      const status = await gateway.start({
        ...(settings || {}),
        profileId: 'codex-antigravity',
        activateCodexProfile: 'antigravity'
      });
      const state = connectCodex({
        codexHome: path.join(os.homedir(), '.codex'),
        stateDir: app.getPath('userData'),
        baseUrl: status.baseUrl,
        apiKey: status.apiKey,
        model: codexAliasForModel(status.model),
        models: status.models,
        antigravity: true,
        catalogKey: 'antigravity-local-gateway',
        providerName: 'AGY Hub / Antigravity',
        requiresOpenAIAuth: false,
        contextWindow: ANTIGRAVITY_CONTEXT_WINDOW,
        autoCompactPercent: ANTIGRAVITY_AUTO_COMPACT_PERCENT
      });
      const codexApp = await restartOrLaunchCodex();
      return { success: true, status, backupDir: state.backupDir, codexApp };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  const OPENAI_CODEX_MODELS = Object.freeze([
    'gpt-5.6',
    'gpt-5.6-sol',
    'gpt-5.6-terra',
    'gpt-5.6-luna',
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.3-codex'
  ]);
  
  function normalizeResponsesProviderSettings(input = {}) {
    const saved = input.id
      ? readProfiles(app.getPath('userData'), { secretCodec, revealSecrets: true }).find(item => item.id === input.id)
      : null;
    const settings = saved ? { ...saved, ...input, apiKey: input.apiKey || saved.apiKey } : input;
    const providerName = String(settings.providerName || 'Sub2API').trim().slice(0, 80) || 'Sub2API';
    const protocol = String(settings.protocol || 'responses').trim();
    if (!Object.values(PROTOCOLS).includes(protocol)) throw new Error('不支持的 Provider 协议');
  
    const rawBaseUrl = String(settings.baseUrl || '').trim();
    if (!rawBaseUrl) throw new Error('请填写 Provider URL');
    let parsed;
    try { parsed = new URL(rawBaseUrl); } catch (_) { throw new Error('Provider URL 格式不正确'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Provider URL 仅支持 HTTP 或 HTTPS');
    const baseUrl = normalizeBaseUrl(parsed.toString(), protocol);
  
    const apiKey = String(settings.apiKey || '').trim();
    if (!apiKey) throw new Error('请填写 API Key');
    const mode = settings.modelMode === 'custom' ? 'custom' : 'openai';
    const customModels = (Array.isArray(settings.models) ? settings.models : String(settings.customModels || '').split(/[\n,]/))
      .map(value => String(value).trim())
      .filter(Boolean);
    const models = mode === 'custom' ? [...new Set(customModels)] : [...OPENAI_CODEX_MODELS];
    if (!models.length) throw new Error('请至少填写一个自定义模型');
    const requestedModel = String(settings.model || '').trim();
    const model = requestedModel && models.includes(requestedModel) ? requestedModel : models[0];
    const authMode = Object.values(AUTH_MODES).includes(settings.authMode) ? settings.authMode : AUTH_MODES.BEARER;
    const customHeaders = parseCustomHeaders(settings.customHeaders);
    const fallbackBaseUrls = (Array.isArray(settings.fallbackBaseUrls) ? settings.fallbackBaseUrls : String(settings.fallbackBaseUrls || '').split(/[\n,]/))
      .map(value => String(value).trim()).filter(Boolean).map(value => normalizeBaseUrl(value, protocol)).filter(value => value !== baseUrl);
    return { providerName, protocol, baseUrl, apiKey, authMode, authQueryName: String(settings.authQueryName || 'key'), customHeaders, fallbackBaseUrls: [...new Set(fallbackBaseUrls)], modelMode: mode, models, model };
  }

  ipcMain.handle('codex-provider-discover-models', async (_event, settings) => {
    try {
      const config = normalizeResponsesProviderSettings(settings);
      return { success: true, ...(await discoverModels(net.fetch, config)), protocol: config.protocol, baseUrl: config.baseUrl };
    } catch (error) { return { success: false, error: error.message }; }
  });
  
  ipcMain.handle('codex-provider-test', async (_event, settings) => {
    try {
      const config = normalizeResponsesProviderSettings(settings);
      const result = await runCustomProviderThreeLevelTest({ fetch: net.fetch, config });
      if (settings?.id) result.health = providerHealthStore.record(settings.id, result);
      requireCodexGateway().recordTestReport('codex-custom', result.report);
      return result;
    } catch (error) {
      return { success: false, error: error.name === 'AbortError' ? '连接测试超时（30 秒）' : error.message };
    }
  });
  
  ipcMain.handle('codex-provider-connect', async (_event, settings) => {
    try {
      const config = normalizeResponsesProviderSettings(settings);
      const gateway = requireCodexGateway();
      const gatewayStatus = await gateway.start({
        profileId: 'codex-custom',
        activateCodexProfile: 'custom',
        providerId: settings && settings.id,
        customBaseUrl: config.baseUrl,
        customApiKey: config.apiKey,
        customProtocol: config.protocol,
        customAuthMode: config.authMode,
        customAuthQueryName: config.authQueryName,
        customHeaders: config.customHeaders,
        customFallbackBaseUrls: config.fallbackBaseUrls,
        customProviderName: config.providerName,
        customModels: config.models,
        model: config.model,
        modelControl: 'client'
      });
      const state = connectCodex({
        codexHome: path.join(os.homedir(), '.codex'),
        stateDir: app.getPath('userData'),
        baseUrl: gatewayStatus.baseUrl,
        apiKey: gatewayStatus.apiKey,
        model: config.model,
        models: config.models,
        catalogKey: `custom-provider:${settings && settings.id ? settings.id : config.providerName}:${config.baseUrl}`,
        protocol: config.protocol,
        providerName: config.providerName,
        requiresOpenAIAuth: false,
        contextWindow: CUSTOM_PROVIDER_CONTEXT_WINDOW,
        autoCompactPercent: CUSTOM_PROVIDER_AUTO_COMPACT_PERCENT
      });
      const codexApp = await restartOrLaunchCodex();
      if (settings?.id) providerHealthStore.record(settings.id, { success: true, report: { levelReached: 3, durationMs: 0, summary: '已接入 Codex' } });
      return {
        success: true,
        providerName: config.providerName,
        baseUrl: gatewayStatus.baseUrl,
        upstreamBaseUrl: config.baseUrl,
        model: config.model,
        models: config.models,
        compactionProtection: true,
        backupDir: state.backupDir,
        catalogPath: state.activeCatalogPath,
        modelCount: state.modelCount,
        codexApp
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('codex-provider-list', async () => {
    try {
      const health = providerHealthStore.read();
      return { success: true, profiles: readProfiles(app.getPath('userData'), { secretCodec }).map(item => ({ ...item, health: health[item.id] || null })) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('codex-provider-save', async (_event, settings) => {
    try {
      const config = normalizeResponsesProviderSettings(settings);
      const profile = saveProfile(app.getPath('userData'), { ...config, id: settings && settings.id }, { secretCodec });
      return { success: true, profile };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('codex-provider-delete', async (_event, id) => {
    try {
      deleteProfile(app.getPath('userData'), String(id || ''), { secretCodec });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('codex-gateway-restore', async () => {
    try {
      return { success: true, ...restoreCodex({ stateDir: app.getPath('userData') }) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  async function verifyClaudeDesktopGateway(gateway, settings = {}) {
    const result = await runClaudeThreeLevelTest({ gateway, fetch: net.fetch, settings });
    gateway.recordTestReport('claude-antigravity', result.report);
    if (!result.success) {
      const error = new Error(result.error || result.report?.summary || 'Claude 三级测试失败');
      error.report = result.report;
      error.diagnostic = result.report?.steps?.find(step => step.status === 'failed')?.details;
      throw error;
    }
    return result;
  }
  
  ipcMain.handle('claude-desktop-status', async () => {
    try {
      const gateway = requireCodexGateway().status();
      return {
        success: true,
        ...getClaudeDesktopStatus({
          stateDir: app.getPath('userData'),
          baseUrl: gateway.claudeBaseUrl
        }),
        gateway
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('claude-desktop-test', async (_event, settings) => {
    try {
      const gateway = requireCodexGateway();
      const test = await runClaudeThreeLevelTest({ gateway, fetch: net.fetch, settings: settings || {} });
      gateway.recordTestReport('claude-antigravity', test.report);
      return { ...test, status: gateway.status() };
    } catch (error) {
      return { success: false, error: error.message, report: error.report, diagnostic: error.diagnostic || classifyUpstreamError(error) };
    }
  });
  
  async function waitForClaudeDesktopConnection(baseUrl, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let status;
    do {
      status = getClaudeDesktopStatus({
        stateDir: app.getPath('userData'),
        baseUrl
      });
      if (status.connected) return status;
      await new Promise(resolve => setTimeout(resolve, 600));
    } while (Date.now() < deadline);
    return status;
  }
  
  ipcMain.handle('claude-desktop-connect', async (_event, settings) => {
    try {
      const gateway = requireCodexGateway();
      const gatewayStatus = await gateway.start({
        profileId: 'claude-antigravity',
        accountId: settings && settings.accountId,
        port: settings && settings.port,
        claudeModel: settings && settings.claudeModel
      });
      const test = await verifyClaudeDesktopGateway(gateway, settings || {});
      const connection = connectClaudeDesktop({
        stateDir: app.getPath('userData'),
        baseUrl: gatewayStatus.claudeBaseUrl,
        apiKey: gatewayStatus.apiKey,
        model: gatewayStatus.claudeModel,
        models: gatewayStatus.antigravityModels
      });
      const lifecycle = await restartOrLaunchClaudeDesktop();
      const desktopStatus = lifecycle.success
        ? await waitForClaudeDesktopConnection(gatewayStatus.claudeBaseUrl)
        : getClaudeDesktopStatus({
            stateDir: app.getPath('userData'),
            baseUrl: gatewayStatus.claudeBaseUrl
          });
      return {
        success: true,
        gateway: gatewayStatus,
        test,
        lifecycle,
        ...connection,
        desktopStatus
      };
    } catch (error) {
      return { success: false, error: error.message, diagnostic: error.diagnostic || classifyUpstreamError(error) };
    }
  });
  
  ipcMain.handle('claude-desktop-restore', async () => {
    try {
      return { success: true, ...restoreClaudeDesktop({ stateDir: app.getPath('userData') }) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  
}

module.exports = { registerGatewayIpc };
