const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const asar = require('@electron/asar');
const { assertTrayModuleLoads } = require('./compatibility');

const root = path.resolve(__dirname, '..');
const archivePath = path.join(root, 'assets', 'app.asar');
const manifestPath = path.join(root, 'assets', 'patch-manifest.json');
const reportPath = path.join(__dirname, 'last-verify-report.json');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function writeReport(report) {
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function requireText(source, expected, file) {
  if (!source.includes(expected)) throw new Error(`${file} is missing runtime marker: ${expected}`);
}

function rejectText(source, forbidden, file) {
  if (source.includes(forbidden)) throw new Error(`${file} contains obsolete runtime logic: ${forbidden}`);
}

function requireSingleText(source, expected, file) {
  const count = source.split(expected).length - 1;
  if (count !== 1) throw new Error(`${file} must contain exactly one runtime marker (${count} found): ${expected}`);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-verify-'));
try {
  if (!fs.existsSync(archivePath)) throw new Error(`Missing archive: ${archivePath}`);
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.formatVersion !== 2) throw new Error(`Unsupported patch format: ${manifest.formatVersion}`);
  if (manifest.unpackedMode !== 'preserve-official') throw new Error(`Unexpected unpacked mode: ${manifest.unpackedMode}`);
  if (manifest.patchSha256 !== sha256(archivePath)) throw new Error('Patch manifest SHA-256 does not match assets/app.asar');

  const requiredFiles = manifest.requiredCapabilities || [];
  const entries = new Set(asar.listPackage(archivePath).map(entry => String(entry).replace(/^[/\\]+/, '').replace(/\\/g, '/')));
  const missingFiles = requiredFiles.filter(relativePath => !entries.has(relativePath));
  if (missingFiles.length) throw new Error(`Patch archive is missing required capabilities: ${missingFiles.join(', ')}`);

  const syntaxFiles = [
    'dist/languageServer.js',
    'dist/preload.js',
    'dist/main.js',
    'dist/tray.js',
    'dist/utils.js',
    'dist/ipcHandlers.js',
    'dist/accountVault.js'
  ].filter(relativePath => entries.has(relativePath));
  for (const relativePath of syntaxFiles) {
    new vm.Script(asar.extractFile(archivePath, relativePath).toString('utf8'), { filename: relativePath });
  }

  const pkg = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8'));
  if (String(pkg.version) !== String(manifest.clientVersion)) {
    throw new Error(`Archive version ${pkg.version} does not match manifest ${manifest.clientVersion}`);
  }
  const preload = asar.extractFile(archivePath, 'dist/preload.js').toString('utf8');
  const main = asar.extractFile(archivePath, 'dist/main.js').toString('utf8');
  const tray = asar.extractFile(archivePath, 'dist/tray.js').toString('utf8');
  const trayExports = assertTrayModuleLoads(tray);
  const utils = asar.extractFile(archivePath, 'dist/utils.js').toString('utf8');
  const ipc = asar.extractFile(archivePath, 'dist/ipcHandlers.js').toString('utf8');
  const languageServer = asar.extractFile(archivePath, 'dist/languageServer.js').toString('utf8');
  requireText(preload, 'AGYCustomThemeLibraryBridge', 'dist/preload.js');
  requireText(preload, 'AGYSupplementalTranslations', 'dist/preload.js');
  requireText(preload, "ipcRenderer.send('token:report'", 'dist/preload.js');
  requireText(preload, 'showOpenMultipleFolderDialog', 'dist/preload.js');
  requireText(preload, 'revealInFilePicker', 'dist/preload.js');
  requireSingleText(main, "ipcMain.handle('agy-theme:list-custom'", 'dist/main.js');
  requireSingleText(main, "ipcMain.handle('agy-theme:set-custom'", 'dist/main.js');
  requireText(main, "ipcMain.on('token:report'", 'dist/main.js');
  requireText(main, 'global.isQuitting = true;', 'dist/main.js');
  requireText(tray, "tray.on('click'", 'dist/tray.js');
  requireText(tray, "tray.on('double-click'", 'dist/tray.js');
  requireText(tray, '打开 Antigravity', 'dist/tray.js');
  requireText(utils, "win.on('close'", 'dist/utils.js');
  requireText(utils, 'event.preventDefault();', 'dist/utils.js');
  requireText(utils, 'win.hide();', 'dist/utils.js');
  requireText(utils, 'function shouldRunInBackground()', 'dist/utils.js');
  requireText(ipc, 'https://daily-cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary', 'dist/ipcHandlers.js');
  rejectText(ipc, 'if (gemini5hVal === null) gemini5hVal = 100;', 'dist/ipcHandlers.js');
  rejectText(preload, 'antigravity-version-widget', 'dist/preload.js');
  rejectText(preload, "ipcRenderer.invoke('patch:check-update'", 'dist/preload.js');
  requireText(preload, 'agy-hub-integration.json', 'dist/preload.js');
  requireText(preload, "translationAuditRow.style.display = isAgyDeveloperModeEnabled() ? 'flex' : 'none'", 'dist/preload.js');
  rejectText(ipc, "ipcMain.handle('patch:check-update'", 'dist/ipcHandlers.js');
  rejectText(ipc, "ipcMain.handle('patch:trigger-update'", 'dist/ipcHandlers.js');
  rejectText(ipc, "ipcMain.handle('patch:restart-app'", 'dist/ipcHandlers.js');
  rejectText(ipc, 'taskkill /F /IM language_server.exe', 'dist/ipcHandlers.js');
  rejectText(ipc, 'taskkill /f /im language_server.exe', 'dist/ipcHandlers.js');
  rejectText(ipc, 'win.reload();', 'dist/ipcHandlers.js');
  requireText(ipc, '[Account Switch] Relaunching the full Antigravity process', 'dist/ipcHandlers.js');
  requireText(ipc, 'electron_1.app.relaunch();', 'dist/ipcHandlers.js');
  requireText(ipc, 'electron_1.app.exit(0);', 'dist/ipcHandlers.js');
  requireText(languageServer, 'https://generativelanguage.googleapis.com', 'dist/languageServer.js');
  requireText(languageServer, 'https://daily-cloudcode-pa.googleapis.com', 'dist/languageServer.js');
  requireText(languageServer, "env['HTTP_PROXY']", 'dist/languageServer.js');
  requireText(languageServer, "env['HTTPS_PROXY']", 'dist/languageServer.js');
  rejectText(languageServer, 'TOKEN_MONITOR_API_PORT = 31000', 'dist/languageServer.js');
  rejectText(languageServer, 'TOKEN_MONITOR_CLOUD_PORT = 31001', 'dist/languageServer.js');
  rejectText(languageServer, 'isTokenMonitorAvailable()', 'dist/languageServer.js');
  const obsoleteSkillHooks = [...entries].filter(entry => /(?:^|\/)autodetect_skills\.py$/i.test(String(entry).replace(/\\/g, '/')));
  if (obsoleteSkillHooks.length) throw new Error(`Obsolete autodetect_skills.py hook is still packaged: ${obsoleteSkillHooks.join(', ')}`);
  const clientVersionParts = String(pkg.version || '').split('.').map(value => Number.parseInt(value, 10) || 0);
  if (clientVersionParts[0] > 2 || (clientVersionParts[0] === 2 && clientVersionParts[1] >= 17)) {
    if (!trayExports.includes('insertTrayMenuItem')) throw new Error('Missing official tray insertion capability');
  }
  if (clientVersionParts[0] > 2 || (clientVersionParts[0] === 2 && clientVersionParts[1] >= 10)) {
    const optionFields = languageServer.match(/const\s*\{([^}]+)\}\s*=\s*options\s*;/)?.[1].split(',').map(field => field.trim()) || [];
    const expectedFields = ['headless', 'hostBridgeUrl', 'hostBridgeToken'];
    if (clientVersionParts[0] > 2 || (clientVersionParts[0] === 2 && clientVersionParts[1] >= 17)) expectedFields.push('wsl');
    for (const field of expectedFields) {
      if (!optionFields.includes(field)) throw new Error(`dist/languageServer.js is missing official option: ${field}`);
    }
    requireText(languageServer, '--host_bridge_url=${hostBridgeUrl}', 'dist/languageServer.js');
    requireText(languageServer, '--host_bridge_token=${hostBridgeToken}', 'dist/languageServer.js');
    rejectText(languageServer, 'function startLanguageServer(port, csrf, headless)', 'dist/languageServer.js');
  }
  const unpackedProbe = 'node_modules\\chrome-devtools-mcp\\package.json';
  const unpackedStat = asar.statFile(archivePath, unpackedProbe);
  if (!unpackedStat.unpacked) throw new Error('Official chrome-devtools-mcp files were incorrectly packed back into app.asar');

  const report = {
    verifiedAt: new Date().toISOString(),
    ok: true,
    archivePath,
    archiveSize: fs.statSync(archivePath).size,
    archiveSha256: sha256(archivePath),
    packageVersion: pkg.version,
    formatVersion: manifest.formatVersion,
    unpackedMode: manifest.unpackedMode,
    requiredFiles,
    checkedSyntax: syntaxFiles,
    checkedTrayModuleExports: trayExports,
    preservedOfficialCapabilities: ['dialog:open-workspaces', 'shell:reveal-in-file-picker', 'tray:double-click', 'window:close-to-background']
  };
  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  writeReport({ verifiedAt: new Date().toISOString(), ok: false, archivePath, error: error.message });
  console.error(error);
  process.exitCode = 1;
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
