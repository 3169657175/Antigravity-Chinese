const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function translator() {
  const source = fs.readFileSync('patch-workbench/injections/translation-enhancement.js', 'utf8');
  const context = { console, queueMicrotask, globalThis: { __agyI18nCatalog: require('./patch-workbench/locales/zh-CN.json') } };
  vm.runInNewContext(source, context, { timeout: 1000 });
  return context.globalThis.__agyTranslateEnhancementText;
}

test('translation enhancement handles screenshot settings labels and dynamic project counts', () => {
  const translate = translator();
  assert.equal(translate('Global Permissions'), '全局权限');
  assert.equal(translate('Modified in 12 projects'), '已在 12 个项目中修改');
  assert.equal(translate('Plan Review Policy'), '计划审查策略');
  assert.equal(translate('Type / and select plan to have the agent generate a plan.'), '输入 / 并选择 plan，让智能体生成计划。');
  assert.equal(translate('Configure the browser subagent. It requires Google Chrome browser. You can invoke browser capabilities by typing /browser in the chat input.'), '配置浏览器子智能体。需要 Google Chrome 浏览器。你可以在聊天输入框中输入 /browser 来调用浏览器能力。');
  assert.equal(translate('App version'), '应用版本');
  assert.equal(translate('Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu.'), '有新版本可用时自动提示重启应用。关闭后，你仍可从应用菜单手动检查更新。');
});

test('translation enhancement preserves technical identifiers and translates split text fragments', () => {
  const translate = translator();
  assert.equal(translate('C:\\work\\src\\main.js'), 'C:\\work\\src\\main.js');
  assert.equal(translate('Type'), '类型');
  assert.equal(translate('and select'), '并选择');
  assert.equal(translate('projects'), '项目');
  assert.equal(translate('Google Chrome browser'), 'Google Chrome 浏览器');
});

test('templates cover arbitrary counts, normalized case and whitespace', () => {
  const translate = translator();
  assert.equal(translate('  Modified in\n275 projects  '), '  已在 275 个项目中修改  ');
  assert.equal(translate('GLOBAL PERMISSIONS'), '全局权限');
  assert.equal(translate('8 tools enabled'), '已启用 8 个工具');
  assert.equal(translate('Type', true), '输入');
  assert.equal(translate('projects', true), '个项目中修改');
  assert.equal(translate('Unknown proof of concept'), 'Unknown proof of concept');
  assert.equal(translate('https://example.com/plan'), 'https://example.com/plan');
  assert.equal(translate('/browser'), '/browser');
  assert.equal(translate('Worked for 1m'), 'Worked for 1m');
  assert.equal(translate('Thinking for 1m 12s'), 'Thinking for 1m 12s');
  assert.equal(translate('Analyzed flow_frontend.py#L20-30'), 'Analyzed flow_frontend.py#L20-30');
  assert.equal(translate('Edited docker-compose.yml'), 'Edited docker-compose.yml');
});

test('installed-resource translations cover complete marketplace, permission, skill and token screens', () => {
  const translate = translator();
  assert.equal(translate('Marketplace'), '功能市场');
  assert.equal(translate('Installed'), '已安装');
  assert.equal(translate('Search customizations...'), '搜索自定义功能…');
  assert.equal(translate('No Project'), '无项目');
  assert.equal(translate('Ask anything, @ to mention, / for actions'), '输入问题，输入 @ 提及，/ 执行动作');
  assert.equal(translate('Settings'), '设置');
  assert.equal(translate('No scheduled tasks configured.'), '暂无计划任务。');
  assert.equal(translate('Read, write, and format spreadsheets.'), '读取、写入和格式化电子表格。');
  assert.equal(translate('No description available.'), '暂无说明。');
  assert.equal(translate('Yes, save rule in this workspace'), '允许，并在此工作区保存规则');
  assert.equal(translate('See 37 more'), '再显示 37 项');
  assert.equal(translate('2,840 / 20,000 tokens (14.2%)'), '2,840 / 20,000 词元（14.2%）');
  assert.equal(translate('2,840 / 20,000 tokens'), '2,840 / 20,000 词元');
  const skill = 'Build, package, run, and debug UI extensions for Antigravity: interactive web panels that render in the side pane, served by a Node.js sidecar using the built-in Sidecar SDK.';
  assert.match(translate(skill), /^构建、打包、运行和调试 Antigravity 界面扩展/);
  assert.equal(translate('ui-extension'), 'ui-extension');
  assert.equal(translate('Gemini 3.8 Flash'), 'Gemini 3.8 Flash');
  assert.equal(translate('My personal plugin description'), 'My personal plugin description');
});

test('backend model announcements translate variable versions and real dates without changing model IDs', () => {
  const translate = translator();
  assert.equal(translate('Sonnet 6.2 is now available on paid Pro and Ultra plans. Third-party model access will no longer be available on your current plan starting on January 12, 2027.'),
    'Sonnet 6.2 现已面向付费 Pro 和 Ultra 套餐开放。 自 2027 年 1 月 12 日起，当前套餐将不再提供第三方模型访问。');
  assert.equal(translate('Gemini 4.1 & 4.2 Flash Deprecation'), 'Gemini 4.1 & 4.2 Flash 停用通知');
  assert.equal(translate('Make sure you are using Gemini 4.3 Flash! We will be turning down Gemini 4.1 Flash and Gemini 4.2 Flash shortly.'),
    '请确保正在使用 Gemini 4.3 Flash！Gemini 4.1 Flash 和 Gemini 4.2 Flash 将于近期停止服务。');
  const invalid = 'Third-party model access will no longer be available on your current plan starting on February 31, 2027.';
  assert.equal(translate(invalid), invalid);
  const unknown = 'Third-party model access may change under different conditions.';
  assert.equal(translate(unknown), unknown);
});

test('built overlay unifies legacy rules and safely accepts data-only dictionary updates', () => {
  const asar = require('@electron/asar');
  const { buildPreload } = require('./patch-workbench/compatibility');
  const legacy = asar.extractFile('patch-workbench/legacy-payload.asar', 'dist/preload.js').toString('utf8');
  const output = buildPreload("electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);", legacy);
  new vm.Script(output);
  const prefix = output.slice(output.indexOf('globalThis.__agyI18nCatalog'), output.indexOf("electron_1.contextBridge.exposeInMainWorld('mcpLogger'"));
  const dictionaryStart = output.indexOf('  const dictionary = {');
  const dictionaryEnd = output.indexOf('  const codeClassPattern', dictionaryStart);
  const supplementalStart = output.indexOf('(function AGYSupplementalTranslations()');
  const supplementalEnd = output.indexOf('(function AGYTranslationAuditQualityLayer()', supplementalStart);
  const context = { console, queueMicrotask, globalThis: {} };
  vm.runInNewContext(prefix + output.slice(dictionaryStart, dictionaryEnd)
    + '\nglobalThis.__agyI18n.configure({dictionary, phrases:substringReplacements,dynamic:translateLegacyDynamic});\n'
    + output.slice(supplementalStart, supplementalEnd), context, { timeout: 2000 });
  const engine = context.globalThis.__agyI18n;
  assert.equal(engine.translate('2 tasks running'), '2 个任务运行中');
  assert.equal(engine.translate('1 file, 2 folders, 3 pages'), '1 个文件，2 个文件夹，3 个页面');
  assert.equal(engine.translate('Outside of folders file access policy'), '项目文件夹外部的文件访问策略');
  assert.equal(engine.translate('The Cloud Audit Manager remote MCP server allows you to enroll projects, generate audit and scope reports, and check resource enrollment statuses in the europe-west1 region.'), 'Cloud Audit Manager 远程 MCP 服务可用于登记项目、生成审计与范围报告，并检查 europe-west1 区域中的资源登记状态。');
  assert.match(engine.translate('Query and act on your marketing, analytics, CRM, e-commerce, and warehouse data across 325+ connectors (Meta Ads, Google Ads, TikTok Ads, GA4, HubSpot, Salesforce, Snowflake).'), /^通过 Windsor\.ai 查询并操作营销/);
  assert.match(engine.translate('Query your GitLab SDLC as a knowledge graph. Orbit indexes groups, projects, source code, merge requests, pipelines, work items, and security findings into a single graph.'), /^将 GitLab SDLC 作为知识图谱查询/);
  assert.match(engine.translate('Search and reference over 600,000 real-world app screens, user flows, and UI patterns from Mobbin directly within your AI tools.'), /^直接在 AI 工具中搜索和参考 Mobbin/);
  assert.match(engine.translate('Build, edit, deploy, and manage full-stack web apps with Lovable, the AI-powered app builder using natural language.'), /^使用 Lovable 通过自然语言构建/);
  assert.equal(engine.translate('Unknown proof of concept'), 'Unknown proof of concept');
  assert.equal(engine.translate('NEW UI TEXT'), 'NEW UI TEXT');
  engine.mergeDictionary(JSON.parse('{"New UI Text":"新界面文本","__proto__":{"polluted":true},"Bad":"<script>危险</script>"}'));
  assert.equal(engine.translate('NEW UI TEXT'), '新界面文本');
  assert.equal(engine.translate('Global Permissions'), '全局权限');
  engine.mergeDictionary({ 'Global Permissions': '不正确的云端覆盖' });
  assert.equal(engine.translate('Global Permissions'), '全局权限');
  assert.equal(engine.translate('Bad'), 'Bad');
  assert.equal({}.polluted, undefined);
  assert.ok(!output.includes('replacedText.replaceAll(rule.search, rule.replace)'));
  assert.ok(!output.includes('setInterval(() => {\n      const quotaWidget'));
  assert.match(output, /return 'history'/);
  assert.match(output, /return 'scheduled'/);
  assert.match(output, /return 'customizations'/);
  assert.match(output, /#root main, #root \[role=\"main\"\], #root \[class\*=\"flex-1\"\]/);
  assert.match(output, /data-agy-view=\"history\"/);
  assert.match(output, /backdrop-filter: blur\(10px\) saturate\(\.98\)/);
});

test('external catalog reload invalidates cached translations without an ASAR rebuild', () => {
  const os = require('os'), path = require('path');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-locale-reload-'));
  try {
    const dir = path.join(temp,'Antigravity'); fs.mkdirSync(dir);
    const file = path.join(dir,'agy-translations.zh-CN.json');
    fs.writeFileSync(file, JSON.stringify({messages:{'Future Interface Label':'新增界面文案'}}));
    const context = { console, require, process:{env:{APPDATA:temp}}, globalThis:{__agyI18nCatalog:require('./patch-workbench/locales/zh-CN.json')} };
    vm.runInNewContext(fs.readFileSync('patch-workbench/injections/translation-enhancement.js','utf8'),context);
    const engine = context.globalThis.__agyI18n;
    assert.equal(engine.translate('Future Interface Label'),'新增界面文案');
    fs.writeFileSync(file, JSON.stringify({messages:{'Future Interface Label':'更新后的文案'}}));
    engine.reloadLocalCatalog();
    assert.equal(engine.translate('Future Interface Label'),'更新后的文案');
    fs.writeFileSync(file,'broken json'); engine.reloadLocalCatalog();
    assert.equal(engine.translate('Future Interface Label'),'更新后的文案');
  } finally { fs.rmSync(temp,{recursive:true,force:true}); }
});

test('sandboxed Electron preload loads vocabulary through a data-only IPC bridge', async () => {
  let fileAccesses=0, calls=0;
  const context = {console,queueMicrotask,globalThis:{__agyI18nCatalog:require('./patch-workbench/locales/zh-CN.json')},require(name) {
    if (name==='electron') return {ipcRenderer:{invoke(channel) {assert.equal(channel,'agy:i18n:catalog');calls++;return Promise.resolve({messages:{'Future Sandbox Label':'隔离环境新文案'}});}}};
    fileAccesses++;throw Error('Filesystem is not available in this sandbox');
  }};
  vm.runInNewContext(fs.readFileSync('patch-workbench/injections/translation-enhancement.js','utf8'),context);
  await context.globalThis.__agyI18n.reloadLocalCatalog();
  assert.equal(context.globalThis.__agyI18n.translate('Future Sandbox Label'),'隔离环境新文案');
  assert.equal(fileAccesses,0);assert.ok(calls>=1);
});


test('translation scheduler yields to paint and slices large DOM work', () => {
  const source = fs.readFileSync('patch-workbench/injections/translation-enhancement.js', 'utf8');
  const scheduler = source.slice(source.indexOf('const scanJobs = []'), source.indexOf('function observeRoot(root)'));
  assert.match(scheduler, /requestAnimationFrame/);
  assert.match(scheduler, /CRITICAL_SYNC_NODE_LIMIT\s*=\s*72/);
  assert.match(scheduler, /translateCriticalControls/);
  assert.match(scheduler, /scanImmediate/);
  assert.match(scheduler, /SLICE_NODE_LIMIT\s*=\s*250/);
  assert.match(scheduler, /SLICE_BUDGET_MS\s*=\s*6/);
  assert.match(scheduler, /deferAfterPaint\(flushPending\)/);
  assert.match(scheduler, /timer\(processSlice, 0\)/);
  assert.match(scheduler, /subtreeRoots = new Set/);
  assert.doesNotMatch(scheduler, /queueMicrotask/);
  assert.doesNotMatch(scheduler, /batch\.some/);
  assert.doesNotMatch(scheduler, /while \(\(node = walker\.nextNode\(\)\)\)/);
});
