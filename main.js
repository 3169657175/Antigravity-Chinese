const { app, BrowserWindow, ipcMain, Tray, Menu, dialog, net, safeStorage, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const physicalFs = require('original-fs');
const os = require('os');
const crypto = require('crypto');
const vm = require('vm');
const asar = require('@electron/asar');
const { exec, execFile, execFileSync, spawn } = require('child_process');
const { Worker } = require('worker_threads');
const { startProxy, stopProxy, getInitialStats, getProxyStatus, recordTokenLog } = require('./src/proxy.js');
const { BrainTokenMonitor } = require('./src/brainMonitor.js');
const { CodexGateway, MODELS, parseUpstreamEvents, collectParts } = require('./src/codexGateway.js');
const { probeMcpServer, validateMcpConfig } = require('./src/mcpProbe.js');
const { registerGatewayIpc } = require('./src/gatewayIpc.js');
const { registerUpdaterService } = require('./src/updaterService.js');
const { getGoogleClientId, getGoogleClientSecret, registerAccountIpc } = require('./src/accountIpc.js');
const { registerThemeIpc } = require('./src/themeIpc.js');
const { PatchBackupManager } = require('./src/patchBackupManager.js');
const { LogTailReader, detectLatestRouteState } = require('./src/logTailReader.js');
const { SkillTranslationService } = require('./src/skillTranslationService.js');
const { SkillTranslationStore, defaultSkillTranslationPath } = require('./src/skillTranslationStore.js');
const { CommunityClient } = require('./src/communityClient.js');
const { registerCommunityIpc } = require('./src/communityIpc.js');
const { readJsonSafe, writeJsonAtomic: writeJsonAtomicSafe } = require('./src/fsUtils.js');
const { hasQuitForUpdateArgument, createAppShutdownCoordinator } = require('./src/appShutdown.js');
const { createSecretCodec } = require('./src/secretCodec.js');
let activePatchInstall = null;
let skillTranslationService = null;
let mainWindow = null;
let tray = null;
let codexGateway = null;
let brainTokenMonitor = null;

const shutdownCoordinator = createAppShutdownCoordinator({
  app,
  destroyTray: () => {
    if (!tray) return;
    tray.destroy();
    tray = null;
  },
  stopRuntime: async () => {
    stopProxy();
    if (brainTokenMonitor) brainTokenMonitor.stop();
    if (codexGateway) await codexGateway.stop();
  }
});

function getSkillTranslationService() {
  if (skillTranslationService) return skillTranslationService;
  skillTranslationService = new SkillTranslationService({
    store: new SkillTranslationStore(defaultSkillTranslationPath(os.homedir())),
    maxBatch: 12,
    generate: async prompt => {
      const gateway = requireCodexGateway();
      const status = gateway.status();
      const model = status.codexAntigravityModel || 'agy-auto';
      const result = await gateway.probeUpstream({
        model,
        stream: false,
        input: [{ role: 'user', content: prompt }]
      });
      const parts = collectParts(parseUpstreamEvents(result.text));
      const text = parts.map(part => part && part.text).filter(Boolean).join('\n').trim();
      if (!text) throw new Error('Antigravity 翻译模型返回了空内容');
      return { text, model: result.resolvedModel || result.model || model };
    }
  });
  return skillTranslationService;
}
function writeJsonAtomic(filePath, data) {
  writeJsonAtomicSafe(filePath, data);
}

function getGlobalMcpConfigPath() {
  return path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
}

function getGlobalSkillsDir() {
  return path.join(os.homedir(), '.gemini', 'config', 'skills');
}

function normalizeSkillId(value) {
  const skillId = String(value || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(skillId)) {
    throw new Error('技能标识只能包含小写英文字母、数字和连字符，长度为 2-64 个字符');
  }
  return skillId;
}

async function fetchJson(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AGY-Hub/1.0' }
    });
    if (!response.ok) throw new Error(`远程服务器返回 HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AGY-Hub/1.0' }
    });
    if (!response.ok) throw new Error(`远程服务器返回 HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

function validateSkillContent(content) {
  const text = String(content || '');
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    throw new Error('SKILL.md 缺少 YAML frontmatter');
  }
  if (!/^description:\s*.+$/m.test(text)) {
    throw new Error('SKILL.md 缺少 description 字段');
  }
  return text;
}

function replaceDirectory(sourceDir, targetDir) {
  const parentDir = path.dirname(targetDir);
  const tempDir = path.join(parentDir, `.${path.basename(targetDir)}.installing-${process.pid}-${Date.now()}`);
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, tempDir, { recursive: true, force: true });

  let removed = false;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }
      removed = true;
      break;
    } catch (err) {
      if (!['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(err.code)) throw err;
      sleepSync(200);
    }
  }
  if (!removed && fs.existsSync(targetDir)) {
    const trashDir = path.join(parentDir, `.${path.basename(targetDir)}.trash-${Date.now()}`);
    try {
      fs.renameSync(targetDir, trashDir);
      setTimeout(() => { try { fs.rmSync(trashDir, { recursive: true, force: true }); } catch (e) {} }, 1000);
    } catch (e) {}
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.renameSync(tempDir, targetDir);
      return;
    } catch (err) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(err.code)) throw err;
      sleepSync(200);
    }
  }
  fs.renameSync(tempDir, targetDir);
}

function createPatchBackupManager() {
  const configDir = app.getPath('userData');
  return new PatchBackupManager({
    statePath: path.join(configDir, 'patch-backup-state.json'),
    legacyHistoryPath: path.join(configDir, 'backups.json'),
    replaceDirectory
  });
}

function hashFileSync(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = physicalFs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = physicalFs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
    return hash.digest('hex');
  } finally {
    physicalFs.closeSync(fd);
  }
}

function inspectPatchArchive(archivePath, requiredFiles) {
  const entries = new Set(asar.listPackage(archivePath).map(entry =>
    String(entry).replace(/^[/\\]+/, '').replace(/\\/g, '/')
  ));
  const packageJson = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8').replace(/^\uFEFF/, ''));
  const syntaxErrors = [];
  for (const entry of ['dist/main.js', 'dist/preload.js']) {
    if (!entries.has(entry)) continue;
    try {
      const source = asar.extractFile(archivePath, entry).toString('utf8');
      new vm.Script(source, { filename: entry });
    } catch (error) {
      syntaxErrors.push(`${entry}: ${error.message}`);
    }
  }
  return {
    version: normalizeClientVersion(packageJson.version),
    missingFiles: requiredFiles.filter(file => !entries.has(String(file).replace(/\\/g, '/'))),
    syntaxErrors
  };
}

function getDirectoryStats(directory) {
  let files = 0;
  let bytes = 0;
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(fullPath).size;
      }
    }
  };
  visit(directory);
  return { files, bytes };
}

function getWindowsFileVersion(executable) {
  const command = '& { param([string]$p) (Get-Item -LiteralPath $p).VersionInfo.ProductVersion }';
  return execFileSync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command', command, executable
  ], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function normalizeClientVersion(value) {
  const match = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1, 4).join('.') : '';
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function stopAntigravityForPatch(asarPath) {
  const appDir = path.dirname(path.dirname(asarPath));
  const executable = path.join(appDir, 'Antigravity.exe');
  let wasRunning = false;
  try {
    const tasks = execFileSync('tasklist.exe', ['/FI', 'IMAGENAME eq Antigravity.exe', '/NH'], {
      encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore']
    });
    wasRunning = /antigravity\.exe/i.test(tasks);
  } catch (e) {}
  if (wasRunning) {
    execFileSync('taskkill.exe', ['/F', '/T', '/IM', 'Antigravity.exe'], {
      windowsHide: true, stdio: 'ignore'
    });
    sleepSync(300);
  }
  const unpackedDir = `${asarPath}.unpacked`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const fd = physicalFs.openSync(asarPath, 'r+');
      physicalFs.closeSync(fd);

      if (fs.existsSync(unpackedDir)) {
        const testLockFile = path.join(unpackedDir, '.locktest');
        fs.writeFileSync(testLockFile, 'test');
        fs.unlinkSync(testLockFile);
      }
      return { wasRunning, executable };
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(error.code)) throw error;
      sleepSync(150);
    }
  }
  throw new Error('Antigravity 及其依赖文件句柄未完全释放，请稍后重试。');
}

function restartAntigravityAfterPatch(state) {
  if (!state || !state.wasRunning || !fs.existsSync(state.executable)) return;
  const child = spawn(state.executable, [], {
    cwd: path.dirname(state.executable), detached: true, windowsHide: false, stdio: 'ignore'
  });
  child.unref();
}

function decryptLocalAccountToken(detail) {
  if (detail && detail.token_storage === 'electron-safe-storage-v1' && typeof detail.token_encrypted === 'string') {
    const decrypted = safeStorage.decryptString(Buffer.from(detail.token_encrypted, 'base64'));
    return JSON.parse(decrypted);
  }
  return detail && detail.token ? detail.token : null;
}

function requireCodexGateway() {
  if (!codexGateway) throw new Error('Codex 本地接入服务尚未初始化');
  return codexGateway;
}

function createWindow() {
  try {
    fs.writeFileSync(path.join(process.resourcesPath, '../userDataPath.txt'), app.getPath('userData'), 'utf8');
  } catch (err) {}
  mainWindow = new BrowserWindow({
    width: 1020,
    height: 680,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    frame: false, // 无边框窗口，启用自定义霓虹标题栏
    transparent: false,
    backgroundColor: '#0a0a0c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile('index.html');

  // 拦截关闭事件：点击叉号时仅隐藏窗口，保留后台默默守护状态
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault(); // 阻止默认的窗口销毁
      mainWindow.hide();       // 隐藏主窗口
    }
    return false;
  });

  // 开发调试可用 Ctrl+Shift+I 唤醒
  // mainWindow.webContents.openDevTools();
}

const gotTheLock = app.requestSingleInstanceLock();
const launchedOnlyToQuitForUpdate = hasQuitForUpdateArgument(process.argv);

if (!gotTheLock) {
  app.quit();
} else if (launchedOnlyToQuitForUpdate) {
  // 安装器在应用未运行时也可能短暂启动本进程；不要创建窗口或后台服务。
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (hasQuitForUpdateArgument(commandLine)) {
      void shutdownCoordinator.quit();
      return;
    }
    // 当试图启动第二个实例时，唤醒并显示已有的主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    // Be explicit about using the OS proxy.  The Antigravity desktop client
    // follows the system proxy, while relying on Electron's implicit fallback
    // can leave main-process net.fetch requests going direct after a restart.
    // That turns a healthy proxy node into Cloud Code's misleading
    // "User location is not supported" / 429 fallback sequence.
    try {
      await session.defaultSession.setProxy({ mode: 'system' });
      await session.defaultSession.forceReloadProxyConfig();
      if (typeof session.defaultSession.closeAllConnections === 'function') {
        await session.defaultSession.closeAllConnections();
      }
      const cloudCodeProxy = await session.defaultSession.resolveProxy('https://daily-cloudcode-pa.googleapis.com');
      console.log(`[Network] Cloud Code system proxy: ${cloudCodeProxy || 'DIRECT'}`);
    } catch (error) {
      console.warn('[Network] Failed to apply system proxy mode:', error.message);
    }
    createWindow();
    startProxy(mainWindow, 31000, 'https://generativelanguage.googleapis.com');
    codexGateway = new CodexGateway({
      fetch: net.fetch,
      accountRoot: path.join(os.homedir(), '.gemini', 'antigravity', 'tools'),
      stateDir: app.getPath('userData'),
      decryptToken: decryptLocalAccountToken,
      clientId: getGoogleClientId(),
      clientSecret: getGoogleClientSecret(),
      secretCodec: createSecretCodec(safeStorage),
      onUsage: (metadata, model, accountId, context = {}) => {
        const input = Number(metadata && metadata.promptTokenCount) || 0;
        const output = (Number(metadata && metadata.candidatesTokenCount) || 0)
          + (Number(metadata && metadata.thoughtsTokenCount) || 0);
        const cached = Number(metadata && metadata.cachedContentTokenCount) || 0;
        recordTokenLog({
          id: `codex-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          time: new Date().toISOString(),
          model: model || (context.source === 'claude-code-gateway' ? 'AGY Hub Claude Code' : 'AGY Hub Codex'),
          accountId: accountId || '',
          input, output, cached, cacheKnown: true,
          duration: 0, estimated: false,
          source: context.source || 'codex-gateway',
          requestPath: context.requestPath || '/v1/responses',
          contentType: 'text/event-stream',
          usageProtocol: 'cloud-code-usage-metadata'
        });
      }
    });
    codexGateway.start().catch(error => {
      console.error('[Codex Gateway] Auto-start failed:', error);
    });
    brainTokenMonitor = new BrainTokenMonitor({ onLog: recordTokenLog });
    brainTokenMonitor.start().catch(error => {
      console.error('[Token Monitor] Local transcript monitor failed:', error);
    });

    // 启动 3 秒后静默后台自动检测更新
    setTimeout(() => {
      try { autoUpdater.checkForUpdates(); } catch (_) {}
    }, 3000);

    // 创建系统托盘图标 (指向 assets/icon.ico)
    const iconPath = path.join(__dirname, 'assets', 'icon.ico');
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: '显示管家', 
        click: () => {
          mainWindow.show();
        } 
      },
      { type: 'separator' },
      { 
        label: '退出管家', 
        click: () => {
          void shutdownCoordinator.quit();
        } 
      }
    ]);

    tray.setToolTip('AGY Hub 桌面管家');
    tray.setContextMenu(contextMenu);

    // 双击托盘图标，还原展示主窗口
    tray.on('double-click', () => {
      mainWindow.show();
    });

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin' && app.isQuiting) app.quit();
});

app.on('before-quit', () => {
  void shutdownCoordinator.prepare();
});

// ==========================================
// IPC 通信事件监听
// ==========================================

registerGatewayIpc({
  ipcMain,
  app,
  net,
  safeStorage,
  requireCodexGateway,
  getProxyStatus,
  getTokenMonitorStatus: () => brainTokenMonitor ? brainTokenMonitor.getStatus() : { running: false }
});

// 窗口控制
ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.on('window-minimize', () => {
  mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  mainWindow.close();
});

const tokenRouteLogReader = new LogTailReader({ maxBytes: 128 * 1024, cacheTtlMs: 1500 });

ipcMain.handle('get-token-stats', () => getInitialStats());
ipcMain.handle('get-token-monitor-status', async () => {
  const proxy = getProxyStatus();
  const localMonitor = brainTokenMonitor
    ? brainTokenMonitor.getStatus()
    : { ready: false, watchedFiles: 0, lastActivityAt: null, lastError: '' };
  let routed = false;
  let routeMessage = '';
  try {
    const logPath = path.join(app.getPath('appData'), 'Antigravity', 'logs', 'main.log');
    const tail = await tokenRouteLogReader.read(logPath);
    if (!tail.missing) {
      routed = detectLatestRouteState(tail.text);
      routeMessage = routed ? 'Antigravity traffic is routed through the monitor.' : 'Restart Antigravity after the monitor is ready.';
    }
  } catch (error) {
    routeMessage = error.message;
  }
  return { ...proxy, routed, routeMessage, localMonitor };
});
ipcMain.handle('start-token-proxy', (event, port, upstream) => {
  startProxy(mainWindow, port, upstream);
  return true;
});

ipcMain.handle('focus-main-window', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.moveTop();
  mainWindow.focus();
  mainWindow.webContents.focus();
  return mainWindow.isFocused();
});

registerThemeIpc({
  ipcMain,
  dialog,
  getMainWindow: () => mainWindow
});

ipcMain.handle('detect-paths', async () => {
  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  
  // 常见安装路径列表
  const possiblePaths = [
    path.join(localAppData, 'Programs', 'antigravity-ide'),
    path.join(localAppData, 'Programs', 'Antigravity'),
    path.join(appData, 'Antigravity'),
    'C:\\Program Files\\Antigravity',
    'C:\\Program Files (x86)\\Antigravity'
  ];

  let detectedPath = '';
  let asarPath = '';

  for (const p of possiblePaths) {
    const testAsar = path.join(p, 'resources', 'app.asar');
    if (fs.existsSync(testAsar)) {
      detectedPath = p;
      asarPath = testAsar;
      break;
    }
  }

  // 默认配置文件路径
  const mcpConfigPath = getGlobalMcpConfigPath();
  const mcpConfigExists = fs.existsSync(mcpConfigPath);

  return {
    detected: !!detectedPath,
    installDir: detectedPath,
    asarPath: asarPath,
    mcpConfigPath: mcpConfigPath,
    mcpConfigExists: mcpConfigExists
  };
});

// 读取 MCP 配置文件
ipcMain.handle('read-mcp-config', async (event, configPath) => {
  try {
    if (!fs.existsSync(configPath)) {
      return { success: false, error: '配置文件不存在' };
    }
    const content = fs.readFileSync(configPath, 'utf8');
    return { success: true, data: JSON.parse(content) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 写入 MCP 配置文件
ipcMain.handle('write-mcp-config', async (event, { configPath, data }) => {
  try {
    const officialPath = getGlobalMcpConfigPath();
    if (path.resolve(configPath) !== path.resolve(officialPath)) {
      return { success: false, error: '拒绝写入非官方 MCP 配置目录' };
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { success: false, error: 'MCP 配置格式无效' };
    }
    writeJsonAtomic(officialPath, data);
    return { success: true, path: officialPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('validate-mcp-server', async (event, payload) => {
  const config = payload && payload.config ? payload.config : payload;
  const options = payload && payload.options || {};
  if (options.mode === 'config') {
    return validateMcpConfig(config);
  }
  const operationId = String(options.operationId || 'mcp-validation');
  const timeoutMs = Math.max(10_000, Math.min(120_000, Number(options.timeoutMs) || 45_000));
  const send = progress => event.sender.send('operation-progress', {
    id: operationId,
    title: options.title || 'MCP 服务验证',
    state: 'running',
    ...progress
  });
  let result;
  try {
    result = await probeMcpServer(config, timeoutMs, send);
  } catch (error) {
    result = { success: false, stage: 'internal', error: `MCP 验证器异常：${error.message}` };
  }
  event.sender.send('operation-progress', {
    id: operationId,
    title: options.title || 'MCP 服务验证',
    state: result.success ? 'success' : 'error',
    percent: 100,
    message: result.success ? 'MCP 服务启动并完成握手' : result.error
  });
  return result;
});

ipcMain.handle('read-skill-translations', (_event, items) => {
  try {
    const safeItems = Array.isArray(items) ? items.slice(0, 3000) : [];
    return { success: true, ...getSkillTranslationService().status(safeItems) };
  } catch (error) {
    return { success: false, error: error.message, translations: {}, missing: [] };
  }
});

ipcMain.handle('translate-skill-descriptions', async (_event, items, options = {}) => {
  try {
    const safeItems = (Array.isArray(items) ? items : []).slice(0, 3000).map(item => ({
      id: String(item && item.id || '').slice(0, 100),
      name: String(item && item.name || '').slice(0, 200),
      description: String(item && (item.originalDescription || item.description) || '').slice(0, 1200)
    }));
    return await getSkillTranslationService().translate(safeItems, { limit: options.limit });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 写入 Skill (SKILL.md) 配置文件
ipcMain.handle('write-skill', async (event, { skillDir, skillName, content }) => {
  try {
    const normalizedName = normalizeSkillId(skillName);
    const skillsRoot = getGlobalSkillsDir();
    const targetDir = skillDir ? path.resolve(skillDir) : path.join(skillsRoot, normalizedName);
    const relativeTarget = path.relative(skillsRoot, targetDir);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
      throw new Error('拒绝写入官方 Skill 目录之外的位置');
    }
    const validatedContent = validateSkillContent(content);
    fs.mkdirSync(targetDir, { recursive: true });
    const skillPath = path.join(targetDir, 'SKILL.md');
    const tempPath = `${skillPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, validatedContent, 'utf8');
    fs.renameSync(tempPath, skillPath);
    return { success: true, path: skillPath, skillId: normalizedName, verified: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('list-installed-skills', async () => {
  try {
    const dirs = [
      path.join(os.homedir(), '.gemini', 'config', 'skills'),
      path.join(os.homedir(), '.agents', 'skills')
    ];
    
    const skills = [];
    const seenIds = new Set();
    let primaryPath = dirs[0]; // 默认返回第一个目录作为主路径
    
    for (const skillsRoot of dirs) {
      if (!fs.existsSync(skillsRoot)) continue;
      
      for (const entry of fs.readdirSync(skillsRoot, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillId = entry.name.toLowerCase();
        if (seenIds.has(skillId)) continue;
        
        const skillPath = path.join(skillsRoot, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillPath)) continue;
        
        try {
          const content = fs.readFileSync(skillPath, 'utf8');
          let valid = true;
          let error = '';
          try {
            validateSkillContent(content);
          } catch (validationError) {
            valid = false;
            error = validationError.message;
          }
          const descriptionMatch = /^description:\s*(.+)$/m.exec(content);
          
          skills.push({
            id: entry.name,
            path: skillPath,
            valid,
            error,
            description: descriptionMatch ? descriptionMatch[1].trim() : '本地已安装的技能'
          });
          seenIds.add(skillId);
        } catch (e) {
          // 容错单个文件读取或验证异常
        }
      }
    }
    
    return { success: true, path: primaryPath, skills };
  } catch (error) {
    return { success: false, error: error.message, skills: [] };
  }
});

ipcMain.handle('fetch-skill-catalog', async () => {
  try {
    const catalog = await fetchJson(`${SKILL_CATALOG_BASE}/skills_index.json`, 20000);
    if (!Array.isArray(catalog)) throw new Error('远程技能清单格式无效');
    const skills = catalog
      .filter(item => item && typeof item.id === 'string' && typeof item.path === 'string')
      .filter(item => !String(item.risk || '').match(/critical|offensive|high/i))
      .map(item => ({
        id: item.id,
        path: item.path,
        name: item.name || item.id,
        description: item.description || '社区技能',
        category: item.category || 'community',
        risk: item.risk || 'unknown',
        source: item.source || 'community',
        setup: item.plugin && item.plugin.setup ? item.plugin.setup : null
      }));
    
    // 同步成功后，将技能数据持久化保存到本地 config 目录中
    try {
      const cachePath = path.join(os.homedir(), '.gemini', 'config', 'skills_catalog_cache.json');
      writeJsonAtomic(cachePath, skills);
    } catch (cacheErr) {
      // 捕获缓存写入异常，不影响同步操作的返回
    }

    return { success: true, source: 'sickn33/agentic-awesome-skills', total: skills.length, skills };
  } catch (error) {
    return { success: false, error: error.name === 'AbortError' ? '连接 GitHub 超时' : error.message, skills: [] };
  }
});

// 新增：优先从本地磁盘缓存中读取技能大清单
ipcMain.handle('read-skill-catalog-cache', async () => {
  try {
    const cachePath = path.join(os.homedir(), '.gemini', 'config', 'skills_catalog_cache.json');
    if (fs.existsSync(cachePath)) {
      const cacheData = readJsonSafe(cachePath, [], { preserveCorrupted: true });
      if (Array.isArray(cacheData)) {
        return { success: true, skills: cacheData };
      }
    }
  } catch (err) {
    // 忽略读取错误
  }
  return { success: false, skills: [] };
});

// 新增：物理卸载/删除已安装的 Skill 技能
ipcMain.handle('uninstall-skill', async (event, skillId) => {
  try {
    const normalized = normalizeSkillId(skillId);
    // 两个物理目录都要尝试去物理删除
    const dirs = [
      path.join(os.homedir(), '.gemini', 'config', 'skills', normalized),
      path.join(os.homedir(), '.agents', 'skills', normalized)
    ];
    let deleted = false;
    for (const targetDir of dirs) {
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        deleted = true;
      }
    }
    if (deleted) {
      return { success: true, skillId: normalized };
    }
    return { success: false, error: '本地技能目录不存在' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('install-community-skill', async (event, skill) => {
  try {
    const skillId = normalizeSkillId(skill && skill.id);
    const remotePath = String(skill && skill.path || '').replace(/\\/g, '/');
    if (!remotePath.startsWith('skills/') || remotePath.includes('..')) {
      throw new Error('远程 Skill 路径无效');
    }
    const cachePath = path.join(os.homedir(), '.gemini', 'config', 'skills_catalog_cache.json');
    const cachedCatalog = readJsonSafe(cachePath, [], { preserveCorrupted: true });
    const trusted = Array.isArray(cachedCatalog)
      ? cachedCatalog.find(item => normalizeSkillId(item.id) === skillId && String(item.path || '').replace(/\\/g, '/') === remotePath)
      : null;
    if (!trusted) throw new Error('技能不在已同步的可信清单中，请先重新同步社区仓库');
    if (/critical|offensive|high/i.test(String(trusted.risk || ''))) {
      throw new Error('该技能被标记为高风险，已阻止自动安装');
    }
    const content = validateSkillContent(await fetchText(`${SKILL_CATALOG_BASE}/${remotePath}/SKILL.md`, 20000));
    const sha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    const targetDir = path.join(getGlobalSkillsDir(), skillId);
    fs.mkdirSync(targetDir, { recursive: true });
    const skillPath = path.join(targetDir, 'SKILL.md');
    const tempPath = `${skillPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, skillPath);
    return { success: true, skillId, path: skillPath, verified: true, sha256, source: trusted.source || 'community' };
  } catch (error) {
    return { success: false, error: error.name === 'AbortError' ? '下载 SKILL.md 超时' : error.message };
  }
});

// 一键装配汉化补丁：重型哈希、目录遍历、复制和完整性校验全部在 Worker 中执行。
ipcMain.handle('install-patch', async (event, { asarPath, sourceAsar }) => {
  if (activePatchInstall) {
    return { success: false, code: 'PATCH_ALREADY_RUNNING', error: '已有汉化注入任务正在执行，请等待完成或先取消。' };
  }

  asarPath = path.resolve(String(asarPath || ''));
  if (path.basename(asarPath).toLowerCase() !== 'app.asar' || path.basename(path.dirname(asarPath)).toLowerCase() !== 'resources') {
    return { success: false, code: 'INVALID_TARGET', error: '目标必须是 Antigravity resources 目录中的 app.asar。' };
  }

  const defaultSourceAsar = app.isPackaged
    ? path.join(process.resourcesPath, 'patch', 'app.asar')
    : path.join(app.getAppPath(), 'assets', 'app.asar');
  const finalSourceAsar = path.resolve(String(sourceAsar || defaultSourceAsar));
  const executable = path.join(path.dirname(path.dirname(asarPath)), 'Antigravity.exe');
  if (!fs.existsSync(executable)) return { success: false, code: 'INVALID_TARGET', error: '目标目录中没有 Antigravity.exe。' };

  let originalVersion = 'unknown';
  try { originalVersion = normalizeClientVersion(getWindowsFileVersion(executable)) || 'unknown'; } catch (_) {}
  let clientState = null;
  let settled = false;

  const progress = (message, percent, state = 'running', cancellable = true) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('operation-progress', {
        id: 'patch-install', title: '注入中文汉化补丁', state, message, percent, cancellable
      });
    }
  };

  const worker = new Worker(path.join(__dirname, 'src', 'patchWorker.js'), {
    workerData: {
      asarPath,
      sourceAsar: finalSourceAsar,
      legacyPayloadAsar: app.isPackaged
        ? path.join(process.resourcesPath, 'patch', 'legacy-payload.asar')
        : path.join(app.getAppPath(), 'patch-workbench', 'legacy-payload.asar'),
      runtimeRulesPath: app.isPackaged
        ? path.join(process.resourcesPath, 'patch', 'runtime-rules.json')
        : path.join(app.getAppPath(), 'patch-workbench', 'runtime-rules.json'),
      originalVersion,
      statePath: path.join(app.getPath('userData'), 'patch-backup-state.json'),
      legacyHistoryPath: path.join(app.getPath('userData'), 'backups.json')
    }
  });
  activePatchInstall = { worker, cancellable: true, cancelRequested: false };

  try {
    return await new Promise(resolve => {
      const finish = result => {
        if (settled) return;
        settled = true;
        resolve(result);
      };

      worker.on('message', async message => {
        if (!message || settled) return;
        if (message.type === 'progress') {
          activePatchInstall.cancellable = message.cancellable !== false;
          progress(message.message, message.percent, 'running', activePatchInstall.cancellable);
          return;
        }
        if (message.type === 'validated') {
          for (const warning of message.warnings || []) console.warn(`[Patch-Validation] ${warning}，已开启自适应放行。`);
          if (activePatchInstall && activePatchInstall.cancelRequested) {
            worker.postMessage({ type: 'cancel' });
            return;
          }
          try {
            progress('校验通过，正在安全关闭 Antigravity', 20);
            clientState = await stopAntigravityProcessForPatch(asarPath);
            if (activePatchInstall && activePatchInstall.cancellable) worker.postMessage({ type: 'continue' });
          } catch (error) {
            worker.postMessage({ type: 'cancel' });
            progress(`无法关闭 Antigravity：${error.message}`, 100, 'error', false);
            finish({ success: false, code: 'PATCH_CLIENT_STOP_FAILED', error: `无法关闭 Antigravity：${error.message}` });
          }
          return;
        }
        if (message.type === 'commit-started') {
          activePatchInstall.cancellable = false;
          return;
        }
        if (message.type === 'cancelled') {
          progress(message.message, 100, 'error', false);
          finish({ success: false, cancelled: true, code: message.code, error: message.message });
          return;
        }
        if (message.type === 'error') {
          progress(message.message, 100, 'error', false);
          finish({ success: false, code: message.code, error: message.message });
          return;
        }
        if (message.type === 'success') {
          const cleanupWarning = message.cleanupWarnings && message.cleanupWarnings.length
            ? `\n旧备份清理未完全完成：${message.cleanupWarnings.join('；')}` : '';
          const restartMessage = clientState && clientState.wasRunning ? '\nAntigravity 将自动重新启动。' : '';
          const backupMessage = message.currentWasPatched
            ? '\n已更新唯一的上一版汉化备份。' : '\n已保留唯一的官方英文原版备份。';
          const msg = `汉化补丁安装并校验成功，适配客户端 v${message.patchVersion}。${backupMessage}${cleanupWarning}${restartMessage}`;
          progress('汉化补丁安装并校验成功', 100, 'success', false);
          finish({ success: true, msg });
        }
      });
      worker.on('error', error => {
        progress(error.message, 100, 'error', false);
        finish({ success: false, code: 'PATCH_WORKER_FAILED', error: error.message });
      });
      worker.on('exit', code => {
        if (!settled && code !== 0) finish({ success: false, code: 'PATCH_WORKER_EXITED', error: `汉化注入后台任务异常退出（${code}）` });
      });
    });
  } finally {
    activePatchInstall = null;
    restartAntigravityAfterPatch(clientState);
  }
});

ipcMain.handle('cancel-patch-install', () => {
  if (!activePatchInstall) return { success: false, error: '当前没有正在执行的汉化注入任务。' };
  if (!activePatchInstall.cancellable) return { success: false, error: '补丁已经进入最终写入阶段，为防止文件损坏，此时不能取消。' };
  activePatchInstall.cancelRequested = true;
  activePatchInstall.worker.postMessage({ type: 'cancel' });
  return { success: true, message: '已请求取消，正在安全清理临时文件。' };
});

function validatePatchTarget(asarPath) {
  const resolved = path.resolve(String(asarPath || ''));
  if (path.basename(resolved).toLowerCase() !== 'app.asar' || path.basename(path.dirname(resolved)).toLowerCase() !== 'resources') {
    throw new Error('目标必须是 Antigravity resources 目录中的 app.asar。');
  }
  if (!fs.existsSync(resolved)) throw new Error('目标 app.asar 不存在。');
  return resolved;
}

function execFileAsync(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      } else resolve({ stdout, stderr });
    });
  });
}

async function stopAntigravityProcessForPatch(asarPath) {
  const appDir = path.dirname(path.dirname(asarPath));
  const executable = path.join(appDir, 'Antigravity.exe');
  let wasRunning = false;
  try {
    const { stdout } = await execFileAsync('tasklist.exe', ['/FI', 'IMAGENAME eq Antigravity.exe', '/NH'], {
      encoding: 'utf8', windowsHide: true
    });
    wasRunning = /antigravity\.exe/i.test(stdout);
  } catch (_) {}
  if (wasRunning) {
    await execFileAsync('taskkill.exe', ['/F', '/T', '/IM', 'Antigravity.exe'], {
      windowsHide: true
    });
  }
  return { wasRunning, executable };
}

function getTargetClientVersion(asarPath) {
  const executable = path.join(path.dirname(path.dirname(asarPath)), 'Antigravity.exe');
  return normalizeClientVersion(getWindowsFileVersion(executable));
}

async function restorePatchBackup(kind, asarPath) {
  let clientState = null;
  process.noAsar = true;
  try {
    const resolved = validatePatchTarget(asarPath);
    const clientVersion = getTargetClientVersion(resolved);
    clientState = stopAntigravityForPatch(resolved);
    const result = createPatchBackupManager().restore(kind, resolved, clientVersion);
    return {
      success: true,
      msg: kind === 'original' ? '官方英文原版还原成功！' : '已退回上一版汉化！',
      ...result
    };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    process.noAsar = false;
    restartAntigravityAfterPatch(clientState);
  }
}

ipcMain.handle('get-patch-backup-status', async (event, { asarPath }) => {
  process.noAsar = true;
  try {
    const resolved = validatePatchTarget(asarPath);
    return {
      success: true,
      ...createPatchBackupManager().status(resolved, getTargetClientVersion(resolved))
    };
  } catch (error) {
    return { success: false, hasOriginal: false, hasPrevious: false, error: error.message };
  } finally {
    process.noAsar = false;
  }
});

ipcMain.handle('restore-previous-patch', async (event, { asarPath }) => restorePatchBackup('previous', asarPath));
ipcMain.handle('restore-original', async (event, { asarPath }) => restorePatchBackup('original', asarPath));

// 新增网络检测：基于 Node.js 原生 TCP 套接字检测代理端口 (不调用 shell，100% 免疫命令行注入)
ipcMain.handle('check-proxy-port', async (event, port) => {
  return new Promise((resolve) => {
    const net = require('net');
    const client = new net.Socket();
    client.setTimeout(1200);

    client.on('connect', () => {
      client.destroy();
      resolve({ success: true });
    });

    client.on('timeout', () => {
      client.destroy();
      resolve({ success: false, error: '连接超时，代理服务似乎未开启该端口。' });
    });

    client.on('error', (err) => {
      client.destroy();
      resolve({ success: false, error: `端口连接失败: ${err.message}` });
    });

    client.connect(port, '127.0.0.1');
  });
});

// 新增网络保存：保存分流配置至本地 userdata 目录
ipcMain.handle('save-network-config', async (event, networkSettings) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'network_config.json');
    writeJsonAtomicSafe(configPath, networkSettings);
    return { success: true, path: configPath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 新增网络配置读取：读取已保存的免 TUN 分流设置，默认返回 active: true, port: 7890
ipcMain.handle('get-network-config', async (event) => {
  try {
    const configPath = path.join(app.getPath('userData'), 'network_config.json');
    if (fs.existsSync(configPath)) {
      const data = readJsonSafe(configPath, null, { preserveCorrupted: true });
      if (!data) throw new Error('网络配置已损坏，已恢复默认设置');
      return { success: true, data };
    }
  } catch (e) {}
  return { success: true, data: { mode: 'bypass', active: true, port: 7890 } };
});

// 新增版本读取：安全提取官方客户端 asar 并在界面呈现与管家同步的补丁版本
ipcMain.handle('get-asar-versions', async (event, asarPath) => {
  let originalVersion = 'unknown';
  let patchVersion = 'unknown';
  
  const defaultSourceAsar = app.isPackaged
    ? path.join(process.resourcesPath, 'patch', 'app.asar')
    : path.join(app.getAppPath(), 'assets', 'app.asar');

  try {
    if (fs.existsSync(asarPath)) {
      const pkgOriginal = JSON.parse(fs.readFileSync(path.join(asarPath, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
      originalVersion = pkgOriginal.version || 'unknown';
    }
    if (fs.existsSync(defaultSourceAsar)) {
      const manifestPath = path.join(path.dirname(defaultSourceAsar), 'patch-manifest.json');
      if (fs.existsSync(manifestPath)) {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
        patchVersion = manifest.pluginVersion || manifest.clientVersion || 'unknown';
      } else {
        const pkgPatch = JSON.parse(fs.readFileSync(path.join(defaultSourceAsar, 'package.json'), 'utf8').replace(/^\uFEFF/, ''));
        patchVersion = pkgPatch.version || 'unknown';
      }
    }
  } catch (e) {}

  return { success: true, originalVersion, patchVersion };
});

registerAccountIpc({
  ipcMain,
  app,
  net,
  safeStorage,
  getMainWindow: () => mainWindow
});

const API_BASE = process.env.AGY_COMMUNITY_API_BASE || 'https://nhw1029.pages.dev/api';
const authFilePath = path.join(app.getPath('userData'), 'auth_config.json');
const communityClient = new CommunityClient({
  fetch,
  authFilePath,
  apiBase: API_BASE,
  fallbackApiBase: process.env.AGY_COMMUNITY_FALLBACK_API_BASE || '',
  cacheFilePath: path.join(app.getPath('userData'), 'community-read-cache.json')
});
registerCommunityIpc({ ipcMain, client: communityClient, shell });

// Community authentication, uploads and feedback IPC are registered by communityIpc.js.

// ==========================================
// Google OAuth 2.0 网页快捷一键登录处理器注入 (末尾安全追加)
// ==========================================
registerUpdaterService({
  ipcMain,
  app,
  net,
  getMainWindow: () => mainWindow,
  prepareForUpdate: () => shutdownCoordinator.prepare()
});
