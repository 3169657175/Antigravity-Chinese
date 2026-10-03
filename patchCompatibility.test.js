const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const asar = require('@electron/asar');
const { resolveUnpackedSource } = require('./patchRuntimeBuilder');
const { buildLanguageServerStartOverlay } = require('./patch-workbench/compatibility');

const installedAsar = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'resources', 'app.asar');
const officialAsar = process.env.ANTIGRAVITY_OFFICIAL_ASAR
  || (fs.existsSync(`${installedAsar}.original`) ? `${installedAsar}.original` : installedAsar);

test('modern language server overlay preserves official endpoints and proxy semantics', () => {
  const officialStart = [
    'function startLanguageServer(port, csrf, options = {}) {',
    '    const { headless, hostBridgeUrl, hostBridgeToken } = options;',
    '    return new Promise((resolve, reject) => {',
    '        const args = [',
    "            '--api_server_url',",
    "            'https://generativelanguage.googleapis.com',",
    "            '--cloud_code_endpoint',",
    "            'https://daily-cloudcode-pa.googleapis.com',",
    '        ];',
    '        if (hostBridgeUrl && hostBridgeToken) {',
    '            args.push(`--host_bridge_url=${hostBridgeUrl}`, `--host_bridge_token=${hostBridgeToken}`);',
    '        }',
    "        if (headless) args.push('--headless');",
    '        const env = { ...process.env, ...(0, shell_env_1.shellEnvSync)() };',
    '        resolve({ args, env });',
    '    });',
    '}'
  ].join('\n');

  const overlaid = buildLanguageServerStartOverlay(officialStart);
  assert.match(overlaid, /async function startLanguageServer\(port, csrf, options = \{\}\)/);
  assert.match(overlaid, /const \{ headless, hostBridgeUrl, hostBridgeToken \} = options/);
  assert.match(overlaid, /--host_bridge_url=\$\{hostBridgeUrl\}/);
  assert.match(overlaid, /--host_bridge_token=\$\{hostBridgeToken\}/);
  assert.match(overlaid, /if \(headless\)/);
  assert.match(overlaid, /https:\/\/generativelanguage\.googleapis\.com/);
  assert.match(overlaid, /https:\/\/daily-cloudcode-pa\.googleapis\.com/);
  assert.doesNotMatch(overlaid, /isTokenMonitorAvailable\(\)/);
  assert.doesNotMatch(overlaid, /TOKEN_MONITOR_API_PORT/);
  assert.doesNotMatch(overlaid, /TOKEN_MONITOR_CLOUD_PORT/);
  assert.match(overlaid, /env\['HTTP_PROXY'\]/);
  assert.match(overlaid, /env\['HTTPS_PROXY'\]/);
  assert.match(overlaid, /3100\[01\]/);
  assert.doesNotMatch(overlaid, /function startLanguageServer\(port, csrf, headless\)/);
});

test('official backup naming resolves its paired unpacked directory', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-unpacked-name-'));
  const originalAsar = path.join(root, 'app.asar.original');
  const originalUnpacked = path.join(root, 'app.asar.unpacked.original');
  fs.writeFileSync(originalAsar, 'archive');
  fs.mkdirSync(originalUnpacked, { recursive: true });
  assert.equal(resolveUnpackedSource(originalAsar), originalUnpacked);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a newer official client can generate and install a compatible patch without replacing unpacked', {
  skip: !fs.existsSync(officialAsar)
}, async () => {
  const officialPackage = JSON.parse(asar.extractFile(officialAsar, 'package.json').toString('utf8').replace(/^\uFEFF/, ''));
  const expectedVersion = String(officialPackage.version || '').match(/^(\d+)\.(\d+)\.(\d+)/)?.slice(1, 4).join('.') || '';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-compat-'));
  const resources = path.join(root, 'resources');
  const patchDir = path.join(root, 'patch');
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(patchDir, { recursive: true });
  const targetAsar = path.join(resources, 'app.asar');
  fs.copyFileSync(officialAsar, targetAsar);
  fs.cpSync(resolveUnpackedSource(officialAsar), `${targetAsar}.unpacked`, { recursive: true });
  fs.writeFileSync(path.join(`${targetAsar}.unpacked`, 'official-marker.txt'), 'preserve');
  fs.copyFileSync(path.join(__dirname, 'assets', 'app.asar'), path.join(patchDir, 'app.asar'));
  fs.copyFileSync(path.join(__dirname, 'patch-workbench', 'legacy-payload.asar'), path.join(patchDir, 'legacy-payload.asar'));
  fs.copyFileSync(path.join(__dirname, 'patch-workbench', 'runtime-rules.json'), path.join(patchDir, 'runtime-rules.json'));
  fs.writeFileSync(path.join(patchDir, 'patch-manifest.json'), JSON.stringify({
    formatVersion: 2,
    clientVersion: '2.3.1',
    unpackedMode: 'preserve-official',
    requiredCapabilities: ['package.json', 'dist/main.js', 'dist/preload.js', 'dist/tray.js', 'dist/utils.js', 'dist/ipcHandlers.js', 'dist/languageServer.js']
  }));

  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'patchWorker.js'), { workerData: {
      asarPath: targetAsar,
      sourceAsar: path.join(patchDir, 'app.asar'),
      legacyPayloadAsar: path.join(patchDir, 'legacy-payload.asar'),
      runtimeRulesPath: path.join(patchDir, 'runtime-rules.json'),
      originalVersion: expectedVersion,
      statePath: path.join(root, 'state.json'),
      legacyHistoryPath: path.join(root, 'backups.json')
    }});
    worker.on('message', message => {
      if (message.type === 'validated') worker.postMessage({ type: 'continue' });
      if (['success', 'error', 'cancelled'].includes(message.type)) resolve(message);
    });
    worker.on('error', reject);
  });

  assert.equal(result.type, 'success', result.message || result.error);
  assert.equal(result.dynamicallyBuilt, true);
  assert.equal(fs.readFileSync(path.join(`${targetAsar}.unpacked`, 'official-marker.txt'), 'utf8'), 'preserve');
  const pkg = JSON.parse(asar.extractFile(targetAsar, 'package.json').toString('utf8'));
  const preload = asar.extractFile(targetAsar, 'dist/preload.js').toString('utf8');
  const main = asar.extractFile(targetAsar, 'dist/main.js').toString('utf8');
  const ipc = asar.extractFile(targetAsar, 'dist/ipcHandlers.js').toString('utf8');
  const tray = asar.extractFile(targetAsar, 'dist/tray.js').toString('utf8');
  const utils = asar.extractFile(targetAsar, 'dist/utils.js').toString('utf8');
  assert.equal(pkg.version, expectedVersion);
  assert.match(preload, /AGYCustomThemeLibraryBridge/);
  assert.equal(main.split("ipcMain.handle('agy-theme:list-custom'").length - 1, 1);
  assert.equal(main.split("ipcMain.handle('agy-theme:set-custom'").length - 1, 1);
  assert.match(main, /global\.isQuitting = true/);
  assert.match(tray, /tray\.on\('double-click'/);
  assert.match(tray, /打开 Antigravity/);
  assert.match(utils, /win\.on\('close'/);
  assert.match(utils, /function shouldRunInBackground\(\)/);
  assert.doesNotMatch(ipc, /taskkill[^\n]*language_server\.exe/i);
  assert.doesNotMatch(ipc, /win\.reload\(\)/);
  assert.match(ipc, /app\.relaunch\(\)/);
  assert.equal(fs.existsSync(`${targetAsar}.original`), true);
  fs.rmSync(root, { recursive: true, force: true });
});
