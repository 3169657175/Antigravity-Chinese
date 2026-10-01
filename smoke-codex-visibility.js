const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    x: -32000,
    y: -32000,
    skipTaskbar: true,
    width: 1180,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'smoke-preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  await win.loadFile(path.join(__dirname, 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 1200));
  win.showInactive();
  await new Promise(resolve => setTimeout(resolve, 100));
  const result = await win.webContents.executeJavaScript(`(async () => {
    const afterPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    document.querySelector('[data-target="tab-codex-gateway"]').click();
    await afterPaint();
    const pages = {};
    for (const name of ['overview', 'claude', 'usage', 'provider']) {
      document.querySelector('[data-codex-page="' + name + '"]').click();
      await afterPaint();
      const page = document.getElementById('codex-page-' + name);
      const rect = page.getBoundingClientRect();
      const style = getComputedStyle(page);
      pages[name] = {
        active: page.classList.contains('active'),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        display: style.display,
        visibility: style.visibility,
        otherVisiblePages: [...document.querySelectorAll('.codex-workspace-page')]
          .filter(other => other !== page && getComputedStyle(other).display !== 'none').length
      };
    }
    document.querySelector('[data-codex-page="usage"]').click();
    await afterPaint();
    const firstPage = {
      rows: document.querySelectorAll('#codex-usage-log .codex-usage-row').length,
      firstModel: document.querySelector('#codex-usage-log .codex-usage-row strong')?.textContent || '',
      summary: document.getElementById('codex-usage-page-summary').textContent
    };
    document.querySelector('[data-page-action="next"]').click();
    await afterPaint();
    const secondPage = {
      rows: document.querySelectorAll('#codex-usage-log .codex-usage-row').length,
      firstModel: document.querySelector('#codex-usage-log .codex-usage-row strong')?.textContent || '',
      summary: document.getElementById('codex-usage-page-summary').textContent
    };
    document.querySelector('[data-usage-source="claude-code-gateway"]').click();
    await afterPaint();
    const claudeFirstPage = {
      rows: document.querySelectorAll('#codex-usage-log .codex-usage-row').length,
      firstModel: document.querySelector('#codex-usage-log .codex-usage-row strong')?.textContent || '',
      summary: document.getElementById('codex-usage-page-summary').textContent
    };
    document.querySelector('[data-page-action="next"]').click();
    await afterPaint();
    const claudeSecondPage = {
      rows: document.querySelectorAll('#codex-usage-log .codex-usage-row').length,
      firstModel: document.querySelector('#codex-usage-log .codex-usage-row strong')?.textContent || '',
      summary: document.getElementById('codex-usage-page-summary').textContent
    };
    return { pages, pagination: { firstPage, secondPage, claudeFirstPage, claudeSecondPage } };
  })()`);
  console.log(JSON.stringify(result));
  const invalid = Object.values(result.pages).some(page => !page.active || page.width < 300 || page.height < 200 || page.display === 'none' || page.visibility !== 'visible' || page.otherVisiblePages !== 0)
    || result.pagination.firstPage.rows !== 20
    || result.pagination.secondPage.rows !== 20
    || result.pagination.firstPage.firstModel !== 'codex-model-1'
    || result.pagination.secondPage.firstModel !== 'codex-model-21'
    || !result.pagination.firstPage.summary.includes('第 1 / 3 页')
    || !result.pagination.secondPage.summary.includes('第 2 / 3 页')
    || result.pagination.claudeFirstPage.rows !== 20
    || result.pagination.claudeSecondPage.rows !== 3
    || result.pagination.claudeFirstPage.firstModel !== 'claude-model-1'
    || result.pagination.claudeSecondPage.firstModel !== 'claude-model-21'
    || !result.pagination.claudeFirstPage.summary.includes('第 1 / 2 页')
    || !result.pagination.claudeSecondPage.summary.includes('第 2 / 2 页');
  if (invalid) process.exitCode = 1;
  win.destroy();
  app.quit();
});
