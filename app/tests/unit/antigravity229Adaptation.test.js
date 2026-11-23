const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const asar = require('@electron/asar');
const { buildPreload } = require('../../patch-workbench/compatibility');

function translator() {
  const context = {
    console,
    queueMicrotask,
    globalThis: { __agyI18nCatalog: require('../../patch-workbench/locales/zh-CN.json') }
  };
  vm.runInNewContext(
    fs.readFileSync('patch-workbench/injections/translation-enhancement.js', 'utf8'),
    context,
    { timeout: 1000 }
  );
  return context.globalThis.__agyI18n.translate;
}

test('Antigravity 2.29 root surfaces expose the wallpaper on home and auxiliary views', () => {
  const legacy = asar.extractFile('patch-workbench/legacy-payload.asar', 'dist/preload.js').toString();
  const source = buildPreload("electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);", legacy);
  new vm.Script(source);

  assert.match(source, /Automations/);
  assert.match(source, /自动化任务/);
  assert.match(source, /\[data-agy-surface="main"\]\.bg-background/);
  assert.match(source, /\[data-agy-surface="main"\]\[class~="bg-background"\]/);
  assert.match(source, /data-agy-view="new-chat"/);
  assert.doesNotMatch(source, /html\.agy-theme-active-v2\s+\*\s*\{\s*background/);
});

test('Antigravity 2.29 home, automation, customization and settings copy is localized', () => {
  const translate = translator();
  const cases = new Map([
    ['What can we get done today?', '今天想一起完成什么？'],
    ["Run a prompt on a schedule, like a morning summary of yesterday's changes. Runs show up here.", '按计划运行提示词，例如每天早晨汇总昨天的变更。任务运行记录会显示在这里。'],
    ['Design, Creative & Media', '设计、创意与媒体'],
    ['Productivity & Project Management', '效率与项目管理'],
    ['Configure what the agent can do in local and remote conversations.', '配置智能体在本地和远程对话中可以执行的操作。'],
    ['This Computer', '这台电脑'],
    ['Remote', '远程对话'],
    ['Configure link opening and built-in browser preferences.', '配置链接打开方式与内置浏览器偏好。'],
    ['Open Links In', '链接打开方式'],
    ['Choose where links open by default when clicked.', '选择点击链接时默认使用的打开方式。'],
    ['Download Location', '下载位置'],
    ['Folder where files downloaded in the built-in browser are saved.', '内置浏览器下载文件的保存文件夹。'],
    ['Browsing History', '浏览历史'],
    ['Clear visited URLs and autocomplete suggestions from the built-in browser.', '清除内置浏览器中的已访问网址和自动补全建议。']
  ]);

  for (const [english, chinese] of cases) assert.equal(translate(english), chinese, english);
  assert.equal(translate('Hi haisenjie, what can we get done today?'), '你好 haisenjie，今天想一起完成什么？');
  assert.equal(translate('No', true), '暂无');
  assert.equal(translate('yet', true), '记录');
});
