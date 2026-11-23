const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const asar = require('@electron/asar');
const {
  buildMain,
  buildPreload,
  buildLanguageServerStartOverlay,
  assertOfficialLanguageServerRouting,
  insertIntoFunctionBody
} = require('../../patch-workbench/compatibility');

const legacyArchive = path.join(__dirname, '..', '..', 'patch-workbench', 'legacy-payload.asar');
const readLegacy = file => asar.extractFile(legacyArchive, file).toString('utf8');

function translator() {
  const context = {
    console,
    queueMicrotask,
    globalThis: { __agyI18nCatalog: require('../../patch-workbench/locales/zh-CN.json') }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', '..', 'patch-workbench', 'injections', 'translation-enhancement.js'), 'utf8'),
    context,
    { timeout: 1000 }
  );
  return context.globalThis.__agyI18n.translate;
}

test('Antigravity 2.32 main injection follows app.whenReady rather than an electron-log comment', () => {
  const official = [
    "'use strict';",
    'const gotTheLock = electron_1.app.requestSingleInstanceLock();',
    'electron_1.app',
    '  .whenReady()',
    '  .then(async () => {',
    '  // Initialize electron-log on the default window session only so browser',
    '  // <webview> partitions do not inherit the electron-log-preload script.',
    '  main_1.default.initialize({ preload: true });',
    '});',
    "electron_1.app.on('before-quit', async (event) => {",
    '});'
  ].join('\n');
  const rebuilt = buildMain(official, readLegacy('dist/main.js'), readLegacy('dist/preload.js'));

  assert.doesNotThrow(() => new vm.Script(rebuilt));
  assert.equal(rebuilt.match(/Auto-Proxy Injection for Electron Main Session/g)?.length, 1);
  assert.equal(rebuilt.match(/global\.isQuitting = true;/g)?.length, 1);
  assert.match(rebuilt, /Initialize electron-log on the default window session only/);
  assert.ok(
    rebuilt.indexOf('Auto-Proxy Injection for Electron Main Session') < rebuilt.indexOf('main_1.default.initialize'),
    'session proxy setup must run before the official initialization body'
  );
});

test('Antigravity 2.32 IPC injection accepts added registerIpcHandlers dependencies', () => {
  const official = [
    'function registerIpcHandlers(storageManager, deps = {}) {',
    '  initializeOfficialHandlers(storageManager, deps);',
    '}'
  ].join('\n');
  const rebuilt = insertIntoFunctionBody(official, 'registerIpcHandlers', '  installAgyHandlers();', 'IPC registration');
  assert.doesNotThrow(() => new vm.Script(rebuilt));
  assert.match(rebuilt, /registerIpcHandlers\(storageManager, deps = \{\}\)/);
  assert.ok(rebuilt.indexOf('installAgyHandlers') < rebuilt.indexOf('initializeOfficialHandlers'));
});

test('Antigravity 2.32 Language Server keeps baseLsArgs and receives only the proxy environment overlay', () => {
  const official = [
    'async function startLanguageServer(port, csrf, options = {}) {',
    '  const loginShellEnv = await shellEnvReads.take();',
    '  return new Promise((resolve, reject) => {',
    '    const args = [',
    '      ...(0, lsDefaults_1.baseLsArgs)({ csrfToken: csrf }),',
    "      '--enable_sidecars',",
    '    ];',
    '    const env = { ...process.env, ...loginShellEnv };',
    '    spawn(binary, args, { env });',
    '  });',
    '}'
  ].join('\n');
  const rebuilt = buildLanguageServerStartOverlay(official);

  assert.doesNotThrow(() => new vm.Script(rebuilt));
  assert.match(rebuilt, /lsDefaults_1\.baseLsArgs/);
  assert.match(rebuilt, /resolveProxy\('https:\/\/generativelanguage\.googleapis\.com'\)/);
  assert.match(rebuilt, /env\['HTTPS_PROXY'\]/);
  assert.doesNotMatch(rebuilt, /TOKEN_MONITOR_API_PORT/);
});

test('Language Server release gate accepts legacy endpoints or official baseLsArgs only', () => {
  assert.doesNotThrow(() => assertOfficialLanguageServerRouting([
    'https://generativelanguage.googleapis.com',
    'https://daily-cloudcode-pa.googleapis.com'
  ].join('\n')));
  assert.doesNotThrow(() => assertOfficialLanguageServerRouting(
    'const args = [...(0, lsDefaults_1.baseLsArgs)({ csrfToken: csrf })];'
  ));
  assert.throws(
    () => assertOfficialLanguageServerRouting('const args = buildUnknownArgs();'),
    /official endpoint configuration is unrecognized/
  );
});

test('Antigravity 2.32 theme clears the inset shell and discovers stable route roots', () => {
  const source = buildPreload(
    "electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);",
    readLegacy('dist/preload.js')
  );
  new vm.Script(source);

  assert.match(source, /\.agy-inset-shell/);
  assert.match(source, /data-testid=\\?"home-greeting\\?"/);
  assert.match(source, /data-testid=\\?"conversation-view\\?"/);
  assert.match(source, /\.agy-shell/);
  assert.doesNotMatch(source, /html\.agy-theme-active-v2\s+\*\s*\{\s*background/);
});

test('Antigravity 2.32 greetings and customization loading states are localized', () => {
  const translate = translator();
  const cases = new Map([
    ['Hey there, what should we build today?', '你好，今天想构建什么？'],
    ['Welcome back. Where should we pick up?', '欢迎回来，想从哪里继续？'],
    ["Good to see you. What's next?", '很高兴见到你，接下来做什么？'],
    ['Configure default behaviors, skills, and MCP servers.', '配置默认行为、技能和 MCP 服务。'],
    ['Loading workspace customizations...', '正在加载工作区自定义功能…'],
    ['Connecting to language server...', '正在连接语言服务器…'],
    ['Chat Layout', '对话布局'],
    ['Queued Messages', '排队消息'],
    ['Terminal Command Auto Execution', '终端命令自动执行'],
    ['Environments', '环境'],
    ['Models', '模型'],
    ['System Prompt', '系统提示词'],
    ['Loading token usage...', '正在加载词元用量…'],
    ['No token data available.', '暂无词元用量数据。'],
    ['Build With Google Plugins', 'Build with Google 插件'],
    ['Loading MCP servers...', '正在加载 MCP 服务…'],
    ['No sign-in needed', '无需登录'],
    ['Signed-in accounts', '已登录账号'],
    ['Loading resources...', '正在加载资源…'],
    ['No matching resources found.', '未找到匹配的资源。'],
    ['Files and resources in cloud workspaces', '云端工作区中的文件和资源'],
    ['Interface Layout', '界面布局']
  ]);

  for (const [english, chinese] of cases) assert.equal(translate(english), chinese, english);
  assert.equal(translate('Hey haisenjie, what should we build today?'), '你好 haisenjie，今天想构建什么？');
  assert.equal(translate('Welcome back, haisenjie. Where should we pick up?'), '欢迎回来，haisenjie。想从哪里继续？');
  assert.equal(translate("Good to see you, haisenjie. What's next?"), '很高兴见到你，haisenjie。接下来做什么？');
});
