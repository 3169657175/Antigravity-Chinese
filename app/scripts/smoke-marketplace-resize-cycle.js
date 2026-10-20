const { app, BrowserWindow } = require('electron');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

app.commandLine.appendSwitch('disable-gpu');

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitForViewport(win, predicate, timeoutMs = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const viewport = await win.webContents.executeJavaScript('({ width: window.innerWidth, height: window.innerHeight })');
    if (predicate(viewport)) {
      await wait(260);
      return viewport;
    }
    await wait(50);
  }
  throw new Error('窗口尺寸在限定时间内没有完成更新');
}

app.whenReady().then(async () => {
  const errors = [];
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    x: -32000,
    y: -32000,
    show: false,
    webPreferences: {
      preload: path.join(PROJECT_ROOT, 'smoke-preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
  await win.loadFile(path.join(PROJECT_ROOT, 'index.html'));
  await wait(1200);
  win.showInactive();
  await waitForViewport(win, viewport => viewport.width > 1400 && viewport.height > 850);

  const inspect = id => win.webContents.executeJavaScript(`(() => {
    const container = document.getElementById('${id}');
    const cards = [...container.children].filter(node => node.getBoundingClientRect().height > 10);
    const tops = [...new Set(cards.map(card => Math.round(card.getBoundingClientRect().top)))];
    return {
      cards: cards.length,
      visualRows: tops.length,
      rows: Number(container.dataset.rows || 0),
      columns: Number(container.dataset.columns || 0),
      pageSize: Number(container.dataset.pageSize || 0)
    };
  })()`);

  await win.webContents.executeJavaScript("document.querySelector('[data-target=\"tab-skill-market\"]')?.click()");
  await wait(500);
  const skillInitial = await inspect('skills-market-container');
  win.setSize(1000, 700);
  await waitForViewport(win, viewport => viewport.width < 1100 && viewport.height < 750);
  const skillSmall = await inspect('skills-market-container');
  win.setSize(1600, 1000);
  await waitForViewport(win, viewport => viewport.width > 1400 && viewport.height > 850);
  const skillRestored = await inspect('skills-market-container');

  await win.webContents.executeJavaScript("document.querySelector('[data-target=\"tab-mcp\"]')?.click()");
  await wait(500);
  const mcpInitial = await inspect('mcp-list-container');
  win.setSize(1000, 700);
  await waitForViewport(win, viewport => viewport.width < 1100 && viewport.height < 750);
  const mcpSmall = await inspect('mcp-list-container');
  win.setSize(1600, 1000);
  await waitForViewport(win, viewport => viewport.width > 1400 && viewport.height > 850);
  const mcpRestored = await inspect('mcp-list-container');

  const result = { skillInitial, skillSmall, skillRestored, mcpInitial, mcpSmall, mcpRestored, errors };
  console.log(JSON.stringify(result));
  let exitCode = 0;
  if (skillInitial.visualRows < 2 || skillRestored.visualRows < 2 || skillRestored.rows < 2) exitCode = 1;
  if (skillRestored.cards !== skillRestored.columns * skillRestored.rows) exitCode = 1;
  if (mcpInitial.visualRows < 2 || mcpRestored.visualRows < 2 || mcpRestored.rows < 2) exitCode = 1;
  if (mcpRestored.cards !== mcpRestored.columns * mcpRestored.rows) exitCode = 1;
  if (errors.some(message => !/公告系统载入失败|Failed to fetch/.test(message))) exitCode = 1;
  win.destroy();
  app.exit(exitCode);
});
