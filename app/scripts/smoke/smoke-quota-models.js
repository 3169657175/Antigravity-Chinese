const { app, BrowserWindow } = require('electron');
const path = require('path');
const assert = require('assert/strict');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: {
    preload: path.join(__dirname, 'smoke-preload.js'), contextIsolation: true,
    additionalArguments: ['--smoke-partial-quota']
  } });
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
  await win.loadFile(path.join(__dirname, '..', '..', 'index.html'));
  const result = await win.webContents.executeJavaScript(`(async () => {
    document.querySelector('[data-target="tab-local-accounts"]').click();
    for (let i = 0; i < 10 && !document.querySelector('#local-accounts-list .quota-spinner'); i++) await new Promise(r => setTimeout(r, 20));
    const sawLoading = Boolean(document.querySelector('#local-accounts-list .quota-spinner'));
    for (let i = 0; i < 50 && !document.querySelector('#local-accounts-list .quota-grid'); i++) await new Promise(r => setTimeout(r, 50));
    const localQuota = Object.fromEntries([...document.querySelectorAll('#local-accounts-list .quota-col')].map(column => [
      column.querySelector('.quota-platform').textContent,
      [...column.querySelectorAll('.quota-label > span:first-child')].map(node => node.textContent.trim())
    ]));
    document.querySelector('[data-target="tab-codex-gateway"]').click();
    const button = document.getElementById('btn-codex-gateway-refresh-quota');
    for (let i = 0; i < 50 && !document.getElementById('codex-gateway-account').value; i++) await new Promise(r => setTimeout(r, 50));
    button.click();
    for (let i = 0; i < 50; i++) {
      await new Promise(r => setTimeout(r, 50));
      if (document.querySelector('#codex-gateway-quota-grid [data-quota="gemini5h"] strong').textContent === '71%') break;
    }
    const quota = Object.fromEntries([...document.querySelectorAll('#codex-gateway-quota-grid [data-quota]')].map(item => [item.dataset.quota, {
      text: item.querySelector('strong').textContent, detail: item.querySelector('small').textContent,
      width: getComputedStyle(item.querySelector('i')).width, empty: item.classList.contains('empty')
    }]));
    return { sawLoading, localQuota, quota, models: [...document.getElementById('codex-gateway-model').options].map(o => o.value).filter(Boolean) };
  })()`);
  assert.equal(result.sawLoading, true);
  assert.equal(result.localQuota.Gemini.length, 1);
  assert.match(result.localQuota.Gemini[0], /5h 限制/);
  assert.equal(result.localQuota.Gemini.some(label => /每周上限/.test(label)), false);
  assert.equal(result.localQuota['Claude / GPT'].some(label => /每周上限/.test(label)), true);
  assert.equal(result.localQuota['Gemini 4 Argon'].some(label => /每周上限/.test(label)), true);
  assert.equal(result.quota.gemini5h.text, '71%');
  assert.equal(result.quota.geminiWeekly.text, '--');
  assert.equal(result.quota.geminiWeekly.empty, false);
  assert.match(result.quota.geminiWeekly.detail, /上游暂未返回/);
  assert.deepEqual(result.models.filter(model => model.startsWith('gemini-')), ['gemini-3.8-flash-high', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low']);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ok: true, ...result }));
  app.quit();
}).catch(error => { console.error(error); app.exit(1); });
