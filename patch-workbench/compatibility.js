const fs = require('fs');
const path = require('path');
const vm = require('vm');

function normalizeVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : 'unknown';
}

function countHits(source, needle) {
  if (!needle) return 0;
  return source.split(needle).length - 1;
}

function requireSingleAnchor(source, anchor, label) {
  const hits = countHits(source, anchor);
  if (hits !== 1) {
    throw new Error(`${label} anchor expected exactly once but found ${hits}: ${anchor.slice(0, 120)}`);
  }
}

function insertAfter(source, anchor, payload, label) {
  requireSingleAnchor(source, anchor, label);
  const index = source.indexOf(anchor) + anchor.length;
  return `${source.slice(0, index)}\n${payload.trim()}\n${source.slice(index)}`;
}

function insertBefore(source, anchor, payload, label) {
  requireSingleAnchor(source, anchor, label);
  const index = source.indexOf(anchor);
  return `${source.slice(0, index)}${payload.trim()}\n${source.slice(index)}`;
}

function extractBetween(source, startAnchor, endAnchor, label, options = {}) {
  requireSingleAnchor(source, startAnchor, `${label} start`);
  requireSingleAnchor(source, endAnchor, `${label} end`);
  const start = source.indexOf(startAnchor) + (options.includeStart === false ? startAnchor.length : 0);
  const end = source.indexOf(endAnchor, start);
  if (end <= start) throw new Error(`${label} anchors are out of order`);
  return source.slice(start, end).trim();
}

function replaceBetween(source, startAnchor, endAnchor, payload, label) {
  requireSingleAnchor(source, startAnchor, `${label} start`);
  requireSingleAnchor(source, endAnchor, `${label} end`);
  const start = source.indexOf(startAnchor);
  const end = source.indexOf(endAnchor, start);
  if (end <= start) throw new Error(`${label} anchors are out of order`);
  return `${source.slice(0, start)}${payload.trim()}\n${source.slice(end)}`;
}

function applyLiteralRules(source, rules, relativePath) {
  const applied = [];
  let output = source;
  for (const [index, rule] of rules.entries()) {
    if (!rule || rule.enabled === false) continue;
    if (String(rule.file || '').replace(/\\/g, '/') !== relativePath) continue;
    const find = String(rule.find || '');
    const replace = String(rule.replace || '');
    const hits = countHits(output, find);
    if (hits === 0) {
      const replacementHits = replace ? countHits(output, replace) : 0;
      if (replacementHits > 0) {
        applied.push({ index: index + 1, file: relativePath, description: rule.description || '', hits: 0, alreadyApplied: true });
        continue;
      }
      throw new Error(`Runtime rule ${index + 1} did not match ${relativePath}`);
    }
    if (Number.isInteger(rule.expectedHits) && hits !== rule.expectedHits) {
      throw new Error(`Runtime rule ${index + 1} expected ${rule.expectedHits} matches but found ${hits} in ${relativePath}`);
    }
    output = output.split(find).join(replace);
    applied.push({ index: index + 1, file: relativePath, description: rule.description || '', hits });
  }
  return { source: output, applied };
}

function buildPreload(official, legacy) {
  const payload = legacy.slice(legacy.indexOf("electron_1.contextBridge.exposeInMainWorld('mcpLogger'"));
  if (!payload || payload === legacy) throw new Error('Legacy preload payload marker is missing');
  const anchor = "electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);";
  const output = insertAfter(official, anchor, payload, 'preload extension point');
  return output;
}

function buildMain(official, legacy) {
  const header = extractBetween(legacy, 'const agyThemePath = require("path");', 'const gotTheLock = electron_1.app.requestSingleInstanceLock();', 'main AGY header');
  const autoProxy = extractBetween(
    legacy,
    '    // Auto-Proxy Injection for Electron Main Session (Codex / Webview)',
    '    // Initialize electron-log and override console',
    'main auto proxy'
  );
  let output = insertBefore(official, 'const gotTheLock = electron_1.app.requestSingleInstanceLock();', header, 'main imports');
  output = insertBefore(output, '    // Initialize electron-log and override console', autoProxy, 'main whenReady');
  output = insertAfter(
    output,
    "electron_1.app.on('before-quit', async (event) => {",
    '    global.isQuitting = true;',
    'main graceful background quit state'
  );
  return output;
}

function buildTray(official, legacy) {
  const functionEnd = '\n}\n/**\n * Updates the active agents count in the tray menu.';
  const desiredSetup = extractBetween(
    legacy,
    '    const translatedActions = actions.map',
    functionEnd,
    'tray translated menu and activation handlers'
  );
  // Replace only the menu setup. New official helpers (2.17's WSL insertion,
  // for example) and all subsequent functions must remain in the module.
  const setup = '    contextMenu = electron_1.Menu.buildFromTemplate(actions);\n    tray.setContextMenu(contextMenu);';
  requireSingleAnchor(official, setup, 'official tray menu setup');
  let output = official.replace(setup, `    ${desiredSetup}`);
  const officialLabel = "countItem.label =\n                (count > 0 ? `${count}` : 'No') +\n                    ' agent' +\n                    (count === 1 ? '' : 's') +\n                    ' running';";
  requireSingleAnchor(output, officialLabel, 'official tray agent label');
  output = output.replace(officialLabel, "countItem.label = count > 0 ? `${count} 个智能体运行中` : '没有智能体在运行';");
  assertTrayModuleLoads(output, official);
  return output;
}

// Syntax checks cannot detect exports pointing at deleted declarations. Load
// only this small module against inert dependencies, never the real Electron.
function assertTrayModuleLoads(source, officialSource = source) {
  function load(code) {
    const exports = {};
    const dependencies = {
      electron: {},
      path,
      './utils': {},
      './languageServer': {}
    };
    new vm.Script(code, { filename: 'dist/tray.js' }).runInNewContext({
      exports,
      module: { exports },
      __dirname: '/validation/dist',
      require(name) {
        if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected tray dependency: ${name}`);
        return dependencies[name];
      }
    }, { timeout: 1000 });
    return exports;
  }
  const expected = load(officialSource);
  const actual = load(source);
  for (const name of ['createTray', 'updateTrayAgentCount']) {
    if (typeof actual[name] !== 'function') throw new Error(`Missing tray function: ${name}`);
  }
  for (const key of new Set(['createTray', 'updateTrayAgentCount', ...Object.keys(expected)])) {
    if (!Object.hasOwn(actual, key) || typeof actual[key] !== typeof expected[key]) {
      throw new Error(`Tray patch removed or changed official export: ${key}`);
    }
  }
  return Object.keys(actual);
}

function buildUtils(official, legacy) {
  const backgroundLifecycle = extractBetween(
    legacy,
    "    win.on('close', (event) => {",
    '    void win.loadURL(url);',
    'window background lifecycle'
  );
  const backgroundPreference = extractBetween(
    legacy,
    'function shouldRunInBackground() {',
    '/**\n * Focuses a window if it exists, or creates a new one.',
    'window background preference'
  );
  let output = insertBefore(
    official,
    '    void win.loadURL(url);',
    backgroundLifecycle,
    'window close-to-tray extension point'
  );
  output = insertBefore(
    output,
    '/**\n * Focuses a window if it exists, or creates a new one.',
    backgroundPreference,
    'window background preference extension point'
  );
  return output;
}

function buildIpcHandlers(official, legacy) {
  const top = extractBetween(legacy, 'const accountVault_1 = require("./accountVault");', 'const electron_updater_1 = require("electron-updater");', 'ipc helper block');
  const prefix = extractBetween(legacy, "    const GOOGLE_OAUTH_CLIENT_ID = '", '    // Dialog', 'ipc account prefix');
  const suffixStart = '    // Custom telemetry logger for Antigravity Quota';
  const suffixIndex = legacy.indexOf(suffixStart);
  const finalBrace = legacy.lastIndexOf('\n}');
  if (suffixIndex < 0 || finalBrace <= suffixIndex) throw new Error('Legacy ipc suffix markers are missing');
  const suffix = legacy.slice(suffixIndex, finalBrace).trim();
  let output = insertAfter(official, 'const electron_1 = require("electron");', top, 'ipc imports');
  output = insertAfter(output, 'function registerIpcHandlers(storageManager) {', prefix, 'ipc register prefix');
  const outputFinalBrace = output.lastIndexOf('\n}');
  if (outputFinalBrace < 0) throw new Error('Official ipcHandlers final brace is missing');
  output = `${output.slice(0, outputFinalBrace)}\n${suffix}\n${output.slice(outputFinalBrace)}`;
  return output;
}

function buildLanguageServerStartOverlay(officialStart) {
  let output = officialStart;
  requireSingleAnchor(output, 'function startLanguageServer(', 'official languageServer start function');

  const apiEndpoint = "            'https://generativelanguage.googleapis.com',";
  const cloudEndpoint = "            'https://daily-cloudcode-pa.googleapis.com',";
  requireSingleAnchor(output, apiEndpoint, 'languageServer API endpoint');
  requireSingleAnchor(output, cloudEndpoint, 'languageServer Cloud Code endpoint');
  output = output.replace(apiEndpoint, '            apiServerUrl,');
  output = output.replace(cloudEndpoint, '            cloudCodeEndpoint,');

  output = output.replace('function startLanguageServer(', 'async function startLanguageServer(');
  const signatureEnd = output.indexOf('\n');
  if (signatureEnd < 0) throw new Error('Official languageServer start function signature is incomplete');
  const signature = output.slice(0, signatureEnd);
  output = insertAfter(output, signature, [
    '    let proxyString = null;',
    '    let tokenMonitorAvailable = false;',
    '    try {',
    '        [proxyString, tokenMonitorAvailable] = await Promise.all([',
    "            electron_1.session.defaultSession.resolveProxy('https://generativelanguage.googleapis.com').catch(() => null),",
    '            isTokenMonitorAvailable(),',
    '        ]);',
    '    } catch (err) {',
    "        console.error('[Proxy Auto-Detect] Failed to resolve system proxy, proceeding with direct connection. Error:', err);",
    '    }',
    '    const apiServerUrl = tokenMonitorAvailable',
    '        ? `http://${TOKEN_MONITOR_HOST}:${TOKEN_MONITOR_API_PORT}`',
    "        : 'https://generativelanguage.googleapis.com';",
    '    const cloudCodeEndpoint = tokenMonitorAvailable',
    '        ? `http://${TOKEN_MONITOR_HOST}:${TOKEN_MONITOR_CLOUD_PORT}`',
    "        : 'https://daily-cloudcode-pa.googleapis.com';",
    '    console.log(tokenMonitorAvailable',
    '        ? `[Token Monitor] Routing model traffic through ${TOKEN_MONITOR_HOST}:${TOKEN_MONITOR_API_PORT}/${TOKEN_MONITOR_CLOUD_PORT}`',
    "        : '[Token Monitor] AGY Hub is unavailable; using official endpoints directly.');"
  ].join('\n'), 'languageServer routing overlay');

  const envAnchor = '        const env = { ...process.env, ...(0, shell_env_1.shellEnvSync)() };';
  output = insertAfter(output, envAnchor, [
    "        if (proxyString && typeof proxyString === 'string') {",
    "            const proxyPart = proxyString.split(';').find(part => part.trim().startsWith('PROXY'));",
    '            if (proxyPart) {',
    "                const addr = proxyPart.replace('PROXY', '').trim();",
    '                if (addr) {',
    "                    env['HTTP_PROXY'] = `http://${addr}`;",
    "                    env['HTTPS_PROXY'] = `http://${addr}`;",
    "                    console.log(`[Proxy Auto-Detect] Set HTTP_PROXY/HTTPS_PROXY = http://${addr}`);",
    '                }',
    '            }',
    '        }'
  ].join('\n'), 'languageServer proxy environment overlay');
  return output;
}

function buildLanguageServer(official, legacy) {
  let output = insertAfter(official, 'exports.getLsPort = getLsPort;', 'exports.getLsCsrf = getLsCsrf;', 'languageServer export');
  output = insertAfter(output, 'const stream_1 = require("stream");', 'const net_1 = __importDefault(require("net"));', 'languageServer net import');
  output = insertAfter(output, 'const MAX_STDERR_BUFFER = 100000;', [
    "const TOKEN_MONITOR_HOST = '127.0.0.1';",
    'const TOKEN_MONITOR_API_PORT = 31000;',
    'const TOKEN_MONITOR_CLOUD_PORT = 31001;'
  ].join('\n'), 'languageServer monitor constants');
  output = insertAfter(output, 'let _lsPort = 0;', "let _lsCsrf = '';", 'languageServer csrf state');
  const getter = extractBetween(legacy, 'function getLsCsrf() {', '/** Clears the language server process reference', 'languageServer csrf getter');
  output = insertBefore(output, '/** Clears the language server process reference', getter, 'languageServer csrf getter target');
  const monitorHelpers = extractBetween(legacy, 'function isLocalPortAvailable(', '/**\n * Spawn the language server', 'languageServer monitor helpers');
  output = insertBefore(output, '/**\n * Spawn the language server', monitorHelpers, 'languageServer helper target');
  const officialStart = extractBetween(output, 'function startLanguageServer(', '/** Sets whether the termination was intentional', 'official startLanguageServer');
  const overlaidStart = buildLanguageServerStartOverlay(officialStart);
  output = replaceBetween(output, 'function startLanguageServer(', '/** Sets whether the termination was intentional', overlaidStart, 'official startLanguageServer');
  output = insertAfter(output, '    setIntentionalTermination(false); // Reset', '    _lsCsrf = csrf;', 'languageServer csrf assignment');
  return output;
}

function syntaxCheck(relativePath, source) {
  new vm.Script(source, { filename: relativePath });
}

function assertUniqueIpcHandlers(relativePath, source) {
  const channels = new Map();
  const pattern = /ipcMain\.handle\(\s*(['"])([^'"]+)\1/g;
  for (const match of source.matchAll(pattern)) {
    channels.set(match[2], (channels.get(match[2]) || 0) + 1);
  }
  const duplicates = [...channels.entries()].filter(([, count]) => count > 1);
  if (duplicates.length) {
    throw new Error(`${relativePath} registers duplicate ipcMain handlers: ${duplicates.map(([name, count]) => `${name} (${count})`).join(', ')}`);
  }
}

function buildCompatibleTree(options) {
  const { officialDir, legacyDir, runtimeRules = [] } = options;
  const files = {
    'dist/preload.js': buildPreload,
    'dist/main.js': buildMain,
    'dist/tray.js': buildTray,
    'dist/utils.js': buildUtils,
    'dist/ipcHandlers.js': buildIpcHandlers,
    'dist/languageServer.js': buildLanguageServer
  };
  const report = { files: [], appliedRuntimeRules: [] };
  for (const [relativePath, builder] of Object.entries(files)) {
    const officialPath = path.join(officialDir, ...relativePath.split('/'));
    const legacyPath = path.join(legacyDir, ...relativePath.split('/'));
    if (!fs.existsSync(officialPath)) throw new Error(`Official client is missing required capability: ${relativePath}`);
    if (!fs.existsSync(legacyPath)) throw new Error(`Legacy payload is missing: ${relativePath}`);
    const official = fs.readFileSync(officialPath, 'utf8');
    const legacy = fs.readFileSync(legacyPath, 'utf8');
    let rebuilt = builder(official, legacy);
    const ruled = applyLiteralRules(rebuilt, runtimeRules, relativePath);
    rebuilt = ruled.source;
    syntaxCheck(relativePath, rebuilt);
    if (relativePath === 'dist/tray.js') assertTrayModuleLoads(rebuilt, official);
    assertUniqueIpcHandlers(relativePath, rebuilt);
    fs.writeFileSync(officialPath, rebuilt, 'utf8');
    report.appliedRuntimeRules.push(...ruled.applied);
    report.files.push({ file: relativePath, officialBytes: Buffer.byteLength(official), rebuiltBytes: Buffer.byteLength(rebuilt) });
  }
  const legacyVault = path.join(legacyDir, 'dist', 'accountVault.js');
  if (fs.existsSync(legacyVault)) {
    const targetVault = path.join(officialDir, 'dist', 'accountVault.js');
    fs.copyFileSync(legacyVault, targetVault);
    syntaxCheck('dist/accountVault.js', fs.readFileSync(targetVault, 'utf8'));
    report.files.push({ file: 'dist/accountVault.js', addedByPatch: true, rebuiltBytes: fs.statSync(targetVault).size });
  }
  return report;
}

module.exports = {
  normalizeVersion,
  countHits,
  applyLiteralRules,
  buildCompatibleTree,
  buildPreload,
  buildMain,
  buildTray,
  assertTrayModuleLoads,
  buildUtils,
  buildIpcHandlers,
  buildLanguageServer,
  buildLanguageServerStartOverlay,
  assertUniqueIpcHandlers
};
