const { contextBridge } = require('electron');

let tokenStatsCalls = 0;
let tokenStatusCalls = 0;
const operationProgressCallbacks = [];
let finishPatch;

const ok = async () => ({ success: true });
contextBridge.exposeInMainWorld('agyHubAPI', {
  minimizeWindow() {}, maximizeWindow() {}, closeWindow() {},
  detectPaths: async () => ({ detected: true, installDir: 'C:\\Program Files\\Antigravity', asarPath: 'C:\\Program Files\\Antigravity\\resources\\app.asar' }),
  getAsarVersions: async () => ({ success: true, originalVersion: '1.2.3', patchVersion: '1.2.3' }),
  getPatchBackupStatus: async () => ({ success: true, hasOriginal: true, hasPrevious: true }),
  getNetworkConfig: async () => ({}),
  listLocalAccounts: async () => ({ success: true, accounts: [] }),
  getTokenStats: async () => { tokenStatsCalls += 1; return { logs: [], totalTokens: 0 }; },
  getTokenMonitorStatus: async () => { tokenStatusCalls += 1; return { ready: true, routed: true, localMonitor: { ready: true, watchedFiles: 1 } }; },
  getTokenSmokeCounts: async () => ({ tokenStatsCalls, tokenStatusCalls }),
  listThemes: async () => ({ success: true, themes: [], palettes: [] }), getActiveTheme: async () => ({ enabled: false }),
  fetchSkillCatalog: async () => ({ success: true, skills: [] }), readSkillCatalogCache: async () => ({ success: true, skills: [] }), listInstalledSkills: async () => ({ success: true, skills: [] }),
  readMcpConfig: async () => ({ success: true, servers: {} }),
  getAuthSession: async () => ({ success: false }), fetchFeedbacks: async () => ({ success: true, data: [] }),
  communityRequest: async () => ({ success: true, ok: true, status: 200, data: [] }),
  getCodexGatewayStatus: async () => ({ running: false, models: [] }), getClaudeDesktopStatus: async () => ({ success: true, connected: false, gateway: {} }),
  listCustomCodexProviders: async () => ({ success: true, profiles: [] }),
  installPatch: () => new Promise(resolve => { finishPatch = resolve; }),
  cancelPatchInstall: async () => ({ success: true, message: '已请求取消' }),
  finishPatchSmoke: async () => { finishPatch?.({ success: false, cancelled: true, error: '已取消注入' }); },
  emitPatchProgress: async payload => operationProgressCallbacks.forEach(callback => callback(payload)),
  onOperationProgress(callback) { operationProgressCallbacks.push(callback); },
  onTokenLogUpdate() {}, onThemeChanged() {}, onOauthCodeCaptured() {}, onUpdaterMessage() {},
  saveNetworkConfig: ok, checkProxyPort: ok, startTokenProxy: ok, restorePreviousPatch: ok, restoreOriginal: ok
});
