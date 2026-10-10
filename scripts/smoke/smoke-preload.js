const { contextBridge } = require('electron');

const ok = async () => ({ success: true });
let updaterCallback = null;
let claudeDesktopConnected = false;
const mockSkills = Array.from({ length: 60 }, (_, index) => ({
  id: `responsive-skill-${String(index + 1).padStart(2, '0')}`,
  name: `Responsive Skill ${index + 1}`,
  description: `Frontend design and development workflow number ${index + 1}.`,
  category: 'frontend',
  risk: 'low',
  path: `skills/responsive-skill-${String(index + 1).padStart(2, '0')}`,
  source: 'smoke'
}));
const mockUsageLogs = [
  ...Array.from({ length: 45 }, (_, index) => ({
    source: 'codex-gateway',
    time: new Date(Date.now() - index * 1000).toISOString(),
    model: `codex-model-${index + 1}`,
    input: 1000 + index,
    output: 100 + index,
    cached: 500 + index,
    cacheKnown: true
  })),
  ...Array.from({ length: 23 }, (_, index) => ({
    source: 'claude-code-gateway',
    time: new Date(Date.now() - index * 1000).toISOString(),
    model: `claude-model-${index + 1}`,
    input: 800 + index,
    output: 80 + index,
    cached: 400 + index,
    cacheKnown: true
  }))
];
contextBridge.exposeInMainWorld('agyHubAPI', {
  minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
  focusMainWindow: ok,
  detectPaths: async () => ({ detected: true, installDir: 'C:\\Program Files\\Antigravity', asarPath: 'C:\\Program Files\\Antigravity\\resources\\app.asar' }),
  getAsarVersions: async () => ({ success: true, originalVersion: '2.3.1', patchVersion: '2.3.1' }),
  getNetworkConfig: async () => ({}), checkProxyPort: async () => true,
  listLocalAccounts: async () => ({ success: true, currentAccountId: 'demo', accounts: [{ id: 'demo', email: 'demo@example.com', name: 'Demo', current: true, storageState: 'encrypted' }] }),
  fetchAccountQuota: async () => ({ success: true, quota: { gemini5h: '71%', geminiWeekly: '89%', claude5h: '100%', claudeWeekly: '77%', gemini5hReset: new Date(Date.now() + 3600000).toISOString(), geminiWeeklyReset: new Date(Date.now() + 86400000).toISOString(), claude5hReset: new Date(Date.now() + 7200000).toISOString(), claudeWeeklyReset: new Date(Date.now() + 172800000).toISOString() } }),
  getTokenStats: async () => ({ logs: mockUsageLogs, totalTokens: 6476004, promptTokens: 6447411, completionTokens: 28593, cachedTokens: 4588497, cachePromptTokens: 6447411, cacheDataAvailable: true }),
  getTokenMonitorStatus: async () => ({ ready: true, routed: true, localMonitor: { ready: true, watchedFiles: 12 } }),
  getCodexGatewayStatus: async () => ({ running: true, host: '127.0.0.1', port: 8046, apiKey: 'sk-demo', accountId: 'demo', model: 'agy-auto', autoResolvedModel: 'claude-sonnet-4-6', baseUrl: 'http://127.0.0.1:8046/v1', models: ['agy-auto','gemini-3.5-flash-lite','gemini-3.6-flash-high','gemini-3.1-pro-high','claude-sonnet-4-6'] }),
  startCodexGateway: async settings => ({ success: true, status: { running: true, host: '127.0.0.1', port: settings.port || 8046, apiKey: 'sk-demo', accountId: settings.accountId || 'demo', model: settings.model || 'agy-auto', baseUrl: 'http://127.0.0.1:8046/v1', models: ['agy-auto','gemini-3.5-flash-lite','gemini-3.6-flash-high','gemini-3.1-pro-high','claude-sonnet-4-6'] } }),
  listThemes: async () => ({ success: true, themes: [], palettes: [] }),
  getActiveTheme: async () => ({ enabled: false }),
  setActiveTheme: ok, disableTheme: ok, pickThemeImage: ok, saveThemeDesign: ok,
  resetThemeImage: ok, deleteCustomTheme: ok,
  fetchSkillCatalog: async () => ({ success: true, skills: mockSkills }),
  readSkillCatalogCache: async () => ({ success: true, skills: mockSkills }), listInstalledSkills: async () => ({ success: true, skills: [] }),
  installCommunitySkill: ok, uninstallSkill: ok, writeSkill: ok,
  readMcpConfig: async () => ({ success: true, servers: {} }), writeMcpConfig: ok, validateMcpServer: ok,
  getAuthSession: async () => ({ success: false }), authLogin: ok, authRegister: ok, authLogout: ok,
  uploadImage: ok, fetchFeedbacks: async () => ({ success: true, data: [] }), submitFeedback: ok, deleteFeedback: ok,
  communityRequest: async () => ({ success: true, ok: true, status: 200, data: [] }),
  openExternalUrl: ok, switchLocalAccount: ok, addLocalAccount: ok, openOfficialClient: ok,
  exportLocalAccount: ok, importLocalAccountFile: ok,
  startOauthLogin: ok, submitOauthCode: ok,
  saveNetworkConfig: ok, installPatch: ok, restoreOriginal: ok,
  startTokenProxy: ok,
  stopCodexGateway: ok, testCodexGateway: ok, connectCodexGateway: ok, restoreCodexGateway: ok,
  getClaudeDesktopStatus: async () => ({ success: true, configured: claudeDesktopConnected, active: claudeDesktopConnected, connected: claudeDesktopConnected, modelCatalogReady: claudeDesktopConnected, actualBaseUrl: claudeDesktopConnected ? 'http://127.0.0.1:8046' : '', profilePath: 'C:\\Temp\\Claude-3p\\configLibrary\\agy.json', gateway: { running: true, host: '127.0.0.1', port: 8046, apiKey: 'sk-demo', accountId: 'demo', claudeModel: 'claude-sonnet-4-6', claudeBaseUrl: 'http://127.0.0.1:8046' } }),
  testClaudeDesktopGateway: async () => ({ success: true, inputTokens: 11 }),
  connectClaudeDesktop: async () => {
    claudeDesktopConnected = true;
    return { success: true, baseUrl: 'http://127.0.0.1:8046', profilePath: 'C:\\Temp\\Claude-3p\\configLibrary\\agy.json', registryPath: 'HKCU\\Software\\Policies\\Anthropic', backupDir: 'C:\\Temp\\claude-backup', lifecycle: { success: true, action: 'restarted', launchMethod: 'shortcut' }, desktopStatus: { connected: true, runtimeBaseUrl: 'http://127.0.0.1:8046', modelCatalogReady: true } };
  },
  restoreClaudeDesktop: async () => ({ success: true, restoredFrom: 'C:\\Temp\\claude-backup' }),
  testCustomCodexProvider: async () => ({ success: true, status: 200, model: 'gpt-5.6', baseUrl: 'http://localhost:8080/v1', matched: true }),
  connectCustomCodexProvider: async () => ({ success: true, providerName: 'Sub2API', baseUrl: 'http://localhost:8080/v1', model: 'gpt-5.6', models: ['gpt-5.6'], backupDir: 'C:\\Temp\\codex-backup' }),
  listCustomCodexProviders: async () => ({ success: true, profiles: [
    { id: 'sub2api', providerName: 'Sub2API 本地反代', protocol: 'responses', baseUrl: 'http://localhost:8080/v1', apiKey: 'sk-local-demo-1029', modelMode: 'openai', model: 'gpt-5.6', models: ['gpt-5.6', 'gpt-5.6-sol', 'gpt-5.5'] },
    { id: 'lab', providerName: '测试实验室', protocol: 'responses', baseUrl: 'http://127.0.0.1:9000/v1', apiKey: 'sk-lab-demo-7175', modelMode: 'custom', model: 'claude-sonnet-4-6', models: ['claude-sonnet-4-6', 'gemini-3.1-pro-high'] }
  ] }),
  saveCustomCodexProvider: async settings => ({ success: true, profile: { ...settings, id: settings.id || 'saved-profile', models: ['gpt-5.6'], model: 'gpt-5.6' } }),
  deleteCustomCodexProvider: async () => ({ success: true }),
  checkAppUpdate: async () => {
    setTimeout(() => updaterCallback?.({ status: 'checking', currentVersion: '1.1.7' }), 0);
    setTimeout(() => updaterCallback?.({
      status: 'available', currentVersion: '1.1.7', version: '1.1.8',
      releaseNotes: '新增反代功能，同时修复 token 监控问题'
    }), 250);
    await new Promise(resolve => setTimeout(resolve, 2500));
    return { success: true };
  },
  startDownloadUpdate: ok, quitAndInstallUpdate: ok,
  onOauthCodeCaptured() {}, onThemeChanged() {}, onTokenLogUpdate() {},
  onUpdaterMessage(callback) {
    updaterCallback = callback;
  }
});
