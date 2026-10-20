const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const resultPath = path.join(__dirname, 'injection-smoke-result.json');
const smokeComponent = process.env.AGY_SMOKE_COMPONENT || 'all';
try { fs.unlinkSync(resultPath); } catch (_) {}
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-injection-smoke-'));
process.env.APPDATA = tempRoot;
if (process.env.AGY_SMOKE_COMPONENT === 'theme') process.env.AGY_DISABLE_TRANSLATION_AUDIT_LAYER = '1';
if (process.env.AGY_SMOKE_COMPONENT === 'audit') process.env.AGY_DISABLE_CUSTOM_THEME_BRIDGE = '1';
app.setPath('userData', path.join(tempRoot, 'electron-user-data'));
app.setPath('sessionData', path.join(tempRoot, 'electron-session-data'));
const configDir = path.join(tempRoot, 'Antigravity');
const customDir = path.join(configDir, 'agy-themes', 'custom');
const customId = 'custom-smoke-cat';
fs.mkdirSync(customDir, { recursive: true });
fs.writeFileSync(path.join(customDir, `${customId}.png`), Buffer.from([137, 80, 78, 71]));
fs.writeFileSync(path.join(configDir, 'agy-theme-library.json'), JSON.stringify({
  version: 1,
  overrides: {},
  customs: [{ id: customId, name: '小猫咪', paletteId: 'line-dog', imageFile: `${customId}.png` }]
}, null, 2));

let storedItems = process.env.AGY_AUDIT_REPORT && fs.existsSync(process.env.AGY_AUDIT_REPORT)
  ? (JSON.parse(fs.readFileSync(process.env.AGY_AUDIT_REPORT, 'utf8')).items || [])
  : [
  { text: 'Gemini 3.6 Flash (High)', route: '/', element: 'span', attribute: 'textContent', selector: 'span.model', count: 4 },
  { text: 'ff51d8f8-4bfc-4325-9e1b-c42176e62664-3185', route: '/c/demo', element: 'div', attribute: 'textContent', selector: 'div.id', count: 3 },
  { text: 'git log --oneline -n 5', route: '/c/demo', element: 'span', attribute: 'textContent', selector: 'button.group span', count: 2 },
  { text: 'Generated Conversation Title', route: '/', element: 'span', attribute: 'textContent', selector: 'span[data-testid="convo-pill-demo"]', count: 2 },
  { text: 'Confirm Undo', route: '/c/demo', element: 'h2', attribute: 'textContent', selector: 'div.dialog > h2', count: 1 },
  { text: 'Lost connection to the language server. Agent features may not work.', route: '/', element: 'span', attribute: 'textContent', selector: 'div.banner > span', count: 1 },
  { text: 'Extensions are bundled collections 共 workflows and tools for collaborative engineering teams.', route: '/settings', element: 'p', attribute: 'textContent', selector: 'div.customization-description > p', count: 1 },
  { text: 'Design and validate context-aware applications with a fictional location platform. Inspect nearby resources, compare routes, and review live operational details.', route: '/settings', element: 'p', attribute: 'textContent', selector: 'div.plugin-description', count: 1 },
  { text: 'Outside 共 repositories command execution policy', route: '/settings', element: 'div', attribute: 'textContent', selector: 'div.setting-description', count: 1 },
  { text: 'Curated collection 共 engineering playbooks for reliability.', route: '/settings', element: 'p', attribute: 'textContent', selector: 'div.skill-description', count: 1 },
  { text: '使用 Antigravity Python SDK 快速构建和扩展自定义 AI 智能体', route: '/settings', element: 'p', attribute: 'textContent', selector: 'div.plugin-description', count: 1 },
  { text: 'This is a long user-authored conversation message that should remain content and must not become a fixed interface translation task even though it is written in English.', route: '/c/demo', element: 'div', attribute: 'textContent', selector: 'div.conversation-message.prose', count: 1 }
];

ipcMain.handle('agy-theme:get', () => ({ enabled: true }));
ipcMain.handle('agy-theme:list-custom', () => ({
  themes: [{ id: customId, name: '小猫咪', imageFile: `${customId}.png`, paletteId: 'line-dog', accent: '#319b73', overlay: 0.14, position: 'center center' }],
  active: { enabled: false, id: 'native' }
}));
ipcMain.handle('agy-theme:set-custom', (_event, themeId) => {
  const config = {
    version: 1, enabled: true, id: 'line-dog', sourceThemeId: themeId, isCustom: true,
    name: '小猫咪', imagePath: path.join(customDir, `${customId}.png`), accent: '#319b73',
    overlay: 0.14, backgroundPosition: 'center center', updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(configDir, 'agy-theme.json'), JSON.stringify(config, null, 2));
  return config;
});
ipcMain.handle('translations:get-missing', () => ({ success: true, path: path.join(tempRoot, 'translation-missing.json'), items: storedItems }));
ipcMain.handle('translations:clear-missing', () => { storedItems = []; return { success: true }; });
ipcMain.handle('translations:record-missing', (_event, items) => { storedItems = Array.isArray(items) ? items : []; return { success: true, count: storedItems.length }; });

function fail(message, details) {
  const result = { ok: false, message, details };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
  console.error(JSON.stringify(result, null, 2));
  app.exit(1);
}

function checkpoint(stage, details = '') {
  fs.writeFileSync(resultPath, JSON.stringify({ ok: null, stage, details }, null, 2), 'utf8');
}

app.whenReady().then(async () => {
  let currentStage = 'app-ready';
  checkpoint(currentStage);
  const watchdog = setTimeout(() => fail('smoke test watchdog timeout', currentStage), 15000);
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'injections', 'preload-footer.js'),
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false
    }
  });
  win.webContents.on('render-process-gone', (_event, details) => fail('renderer process exited', details));
  win.on('unresponsive', () => checkpoint('renderer-unresponsive'));
  const rendererMessages = [];
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    rendererMessages.push({ level, message, line, sourceId });
    checkpoint('renderer-console', rendererMessages.slice(-20));
  });
  currentStage = 'window-created';
  checkpoint(currentStage);
  currentStage = 'loading-page';
  checkpoint(currentStage);
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><html><body>
    <div id="agy-theme-switcher" class="open"><div id="agy-theme-menu">
      <div id="agy-theme-menu-title">Antigravity 主题皮肤</div>
      <button class="agy-theme-choice" data-theme-id="line-dog"><span></span><span>线条小狗</span></button>
      <button class="agy-theme-choice agy-theme-native" data-theme-id="native"><span></span><span>恢复原生主题</span></button>
    </div></div>
    <div id="antigravity-quota-widget"></div>
    <div id="antigravity-translation-audit"></div>
    <div role="dialog" id="settings-surface-fixture" style="width:900px;height:520px;display:block">
      <h2>Customizations</h2>
      <section><h3>Add MCP Servers</h3><p class="mcp-card-description">Ask questions. Get answers. This MCP server connects to your analytics account so the coding agent can inspect product data and explain results.</p></section>
      <section id="agy-210-fixture"><h3>Models & Usage</h3><p>Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu.</p><button id="agy-refresh-mcp" aria-label="Refresh MCP servers">Refresh</button><button id="agy-toggle-plugin" aria-label="Toggle chrome-devtools-mcp">29 tools enabled</button><span>Remote Control</span></section>
      <section><h3>已知翻译测试项</h3><p class="known-plugin-description">Plugins are packaged collections 共 skills and MCPs to help the Agent in Antigravity call Google developer products.</p><p class="known-maps-description">Build and prototype location-aware applications with Google Maps Platform. Integrate interactive maps, search and inspect Places details, calculate optimal routes.</p><p class="known-setting-description">Outside 共 folders file access policy</p></section>
    </div>
    <script>
      const quotaHost = document.getElementById('antigravity-quota-widget');
      const quotaRoot = quotaHost.attachShadow({mode:'open'});
      quotaRoot.innerHTML = '<section><p>When toggled on, Antigravity will use your AI credits to fulfill model requests once you are out of model quota. Antigravity will always use your model quota first before using AI credits.</p><p>Within each group, models share a weekly limit and a 5-hour limit. Quota is consumed proportionally to the cost of the model.</p><p>You have used some 共 your weekly limit, it will fully refresh in 4 days, 12 hours.</p><p>Future quota sentence needs translation.</p></section>';
      const host = document.getElementById('antigravity-translation-audit');
      const root = host.attachShadow({mode:'open'});
      root.innerHTML = '<div class="subtitle"></div><div class="stats"><div class="stat"><strong class="total">--</strong><span></span></div><div class="stat"><strong class="session">--</strong><span></span></div><div class="stat"><strong class="coverage">--</strong><span></span></div></div><input class="search"><button class="copy">复制 JSON</button><button class="refresh">刷新</button><div class="list"></div><div class="status"></div>';
    </script>
  </body></html>`));
  currentStage = 'page-loaded';
  checkpoint(currentStage);
  await new Promise(resolve => setTimeout(resolve, 1800));
  currentStage = 'reading-snapshot';
  checkpoint(currentStage);
  const readyState = await Promise.race([
    win.webContents.executeJavaScript('document.readyState'),
    new Promise((_, reject) => setTimeout(() => reject(new Error('basic executeJavaScript timeout')), 2500))
  ]);
  checkpoint('basic-javascript-ok', readyState);
  const snapshot = await win.webContents.executeJavaScript(`(() => {
    try {
      const root = document.getElementById('antigravity-translation-audit').shadowRoot;
      return {
      themeNames: Array.from(document.querySelectorAll('#agy-theme-menu .agy-theme-choice')).map(node => node.textContent.trim()),
      customCount: document.querySelectorAll('[data-agy-custom-theme="item"]').length,
      auditRows: Array.from(root.querySelectorAll('.row')).map(node => node.textContent.replace(/\\s+/g, ' ').trim()),
      labels: Array.from(root.querySelectorAll('.stat span')).map(node => node.textContent),
      copyText: root.querySelector('.copy').textContent,
      status: root.querySelector('.status').textContent,
        settingsText: document.getElementById('settings-surface-fixture').textContent.replace(/\\s+/g, ' ').trim(),
        refreshMcpLabel: document.getElementById('agy-refresh-mcp').getAttribute('aria-label'),
        togglePluginLabel: document.getElementById('agy-toggle-plugin').getAttribute('aria-label'),
        quotaText: document.getElementById('antigravity-quota-widget').shadowRoot.textContent.replace(/\\s+/g, ' ').trim(),
        rendererMessages: ${'rendererMessages'.replace('rendererMessages', '[]')}
      };
    } catch (error) {
      return { snapshotError: error.stack || error.message };
    }
  })()`);
  if (snapshot.snapshotError) fail('snapshot collection failed', { snapshot, rendererMessages });
  let active = null;
  if (smokeComponent !== 'audit') {
    if (snapshot.customCount !== 1 || !snapshot.themeNames.some(name => name.includes('小猫咪'))) fail('custom theme was not added to the Antigravity menu', snapshot);
    await win.webContents.executeJavaScript(`document.querySelector('[data-agy-custom-theme="item"]').click()`);
    currentStage = 'theme-clicked';
    checkpoint(currentStage);
    await new Promise(resolve => setTimeout(resolve, 200));
    active = JSON.parse(fs.readFileSync(path.join(configDir, 'agy-theme.json'), 'utf8'));
    if (active.sourceThemeId !== customId || active.name !== '小猫咪') fail('custom theme selection was not persisted', active);
  }
  if (smokeComponent !== 'theme') {
    if (snapshot.auditRows.some(row => /Gemini 3\.6|ff51d8f8|git log|Generated Conversation Title/.test(row))) fail('audit noise was not filtered', snapshot);
    if (snapshot.copyText !== '复制 AI 报告' || snapshot.labels.join('|') !== '待处理文本|高优先级|已排除噪声') fail('audit dialog labels were not upgraded', snapshot);
    if (!snapshot.quotaText.includes('启用后') || !snapshot.quotaText.includes('每个模型组共享') || !snapshot.quotaText.includes('4 天 12 小时后完全恢复')) fail('quota Shadow DOM translations were not applied', snapshot);
    if (!snapshot.auditRows.some(row => row.includes('Future quota sentence needs translation.'))) fail('unknown quota Shadow DOM English was not audited', snapshot);
    if (!snapshot.auditRows.some(row => row.includes('Extensions are bundled collections') && row.includes('半汉化文本'))) fail('unknown mixed-language customization description was not prioritized', snapshot);
    if (!snapshot.auditRows.some(row => row.includes('Design and validate context-aware applications') && row.includes('关键简介'))) fail('unknown long plugin description was not audited', snapshot);
    if (!snapshot.auditRows.some(row => row.includes('Outside 共 repositories command execution policy') && row.includes('半汉化文本'))) fail('unknown partially translated setting description was not audited', snapshot);
    if (!snapshot.auditRows.some(row => row.includes('Curated collection 共 engineering playbooks') && row.includes('半汉化文本'))) fail('unknown partially translated skill description was not audited', snapshot);
    if (snapshot.auditRows.some(row => /Plugins are packaged collections|Build and prototype location-aware applications|Outside 共 folders file access policy|Add MCP Servers/.test(row))) fail('known translated settings text remained in the audit report', snapshot);
    if (snapshot.auditRows.some(row => row.includes('使用 Google Maps Platform 构建和验证位置感知应用'))) fail('translated description with product names was incorrectly flagged as mixed language', snapshot);
    if (!snapshot.settingsText.includes('添加 MCP 服务') || !snapshot.settingsText.includes('插件是由技能和 MCP 服务组成的功能包') || !snapshot.settingsText.includes('使用 Google Maps Platform 构建和验证位置感知应用') || !snapshot.settingsText.includes('项目文件夹外部的文件访问策略') || !snapshot.settingsText.includes('让编码智能体通过自然语言查询 PostHog 数据')) fail('known settings translations were not applied to the visible DOM', snapshot);
    if (!snapshot.settingsText.includes('模型与用量') || !snapshot.settingsText.includes('有新版本可用时自动提示重启应用') || !snapshot.settingsText.includes('已启用 29 个工具') || !snapshot.settingsText.includes('远程控制') || snapshot.refreshMcpLabel !== '刷新 MCP 服务' || snapshot.togglePluginLabel !== '切换 chrome-devtools-mcp') fail('Antigravity 2.10.0 residual UI translations were not applied', snapshot);
    if (snapshot.auditRows.some(row => row.includes('使用 Antigravity Python SDK'))) fail('Chinese description with technical product terms was incorrectly flagged', snapshot);
    if (snapshot.auditRows.some(row => row.includes('long user-authored conversation message'))) fail('conversation content was incorrectly flagged', snapshot);
  }
  const result = { ok: true, snapshot, active };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  clearTimeout(watchdog);
  win.destroy();
  app.exit(0);
}).catch(error => fail(error.message, error.stack));
