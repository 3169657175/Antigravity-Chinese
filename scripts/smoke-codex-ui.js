const { app, BrowserWindow } = require('electron');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(PROJECT_ROOT, 'smoke-preload.js'), contextIsolation: true } });
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
  await win.loadFile(path.join(PROJECT_ROOT, 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 1200));
  const result = await win.webContents.executeJavaScript(`(() => {
    const nav = document.querySelector('[data-target="tab-codex-gateway"]');
    nav.click();
    const panel = document.getElementById('panel-la-codex');
    const mount = document.getElementById('codex-overview-mount');
    document.querySelector('[data-codex-page="usage"]').click();
    document.querySelector('[data-usage-source="claude-code-gateway"]').click();
    const claudeUsage = {
      active: document.querySelector('[data-usage-source="claude-code-gateway"]').classList.contains('active'),
      title: document.getElementById('gateway-usage-source-title').textContent,
      model: document.querySelector('#codex-usage-log .codex-usage-row strong')?.textContent || '',
      requests: document.getElementById('codex-stat-requests').textContent
    };
    return {
      navActive: nav.classList.contains('active'),
      panelMounted: panel.parentElement === mount,
      panelVisible: getComputedStyle(panel).display !== 'none',
      quotaItems: document.querySelectorAll('.codex-gateway-quota-item').length,
      usageMetrics: document.querySelectorAll('.codex-usage-metric').length,
      usageVisible: document.getElementById('codex-page-usage').classList.contains('active'),
      usageValues: {
        input: document.getElementById('codex-stat-input').textContent,
        output: document.getElementById('codex-stat-output').textContent,
        cached: document.getElementById('codex-stat-cached').textContent,
        context: document.getElementById('codex-stat-input').nextElementSibling.textContent
      },
      exactInputTitle: document.getElementById('codex-stat-input').title,
      usageSourceTabs: document.querySelectorAll('.codex-usage-source-tab').length,
      claudeUsage,
      localMonitorValues: {
        total: document.getElementById('stat-total-token').textContent,
        output: document.getElementById('stat-output-token').textContent,
        cached: document.getElementById('stat-cached-token').textContent
      },
      duplicateIds: [...document.querySelectorAll('[id]')].map(n => n.id).filter((id, i, all) => all.indexOf(id) !== i)
    };
  })()`);
  const feedback = await win.webContents.executeJavaScript(`(async () => {
    window.__smokeAlerts = [];
    window.alert = message => window.__smokeAlerts.push(String(message));
    document.querySelector('[data-codex-page="provider"]').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const firstCard = document.querySelector('.provider-profile-card');
    firstCard.querySelector('[data-action="test"]').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const testText = firstCard.querySelector('.provider-profile-result').textContent;
    firstCard.querySelector('[data-action="connect"]').click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const activeCard = document.querySelector('.provider-profile-card.active');
    return {
      testText,
      connectText: activeCard?.querySelector('.provider-profile-result')?.textContent || '',
      connectButtonText: activeCard?.querySelector('[data-action="connect"]')?.textContent || '',
      alerts: window.__smokeAlerts
    };
  })()`);
  const claudeFeedback = await win.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-codex-page="claude"]').click();
    await new Promise(resolve => setTimeout(resolve, 50));
    const button = document.getElementById('btn-claude-desktop-connect');
    button.click();
    await new Promise(resolve => setTimeout(resolve, 150));
    return {
      resultText: document.getElementById('claude-desktop-result').textContent,
      statusText: document.getElementById('claude-gateway-state-title').textContent,
      account: document.getElementById('claude-desktop-account').value,
      quotaItems: document.querySelectorAll('#claude-gateway-quota-grid .codex-gateway-quota-item').length,
      quotaValues: [...document.querySelectorAll('#claude-gateway-quota-grid .codex-gateway-quota-item strong')].map(node => node.textContent),
      apiKey: document.getElementById('claude-desktop-api-key').value,
      pageVisible: document.getElementById('codex-page-claude').classList.contains('active'),
      navLabel: document.querySelector('[data-target="tab-codex-gateway"] .nav-text').textContent,
      buttonText: button.textContent,
      disabled: button.disabled,
      alerts: window.__smokeAlerts
    };
  })()`);
  console.log(JSON.stringify({ result, feedback, claudeFeedback, errors }));
  app.quit();
});
