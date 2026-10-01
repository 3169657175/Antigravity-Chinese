const { app, BrowserWindow } = require('electron');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const fs = require('fs');

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1280, height: 820, show: false, webPreferences: { preload: path.join(PROJECT_ROOT, 'smoke-preload.js'), contextIsolation: true } });
  const errors = [];
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
  await win.loadFile(path.join(PROJECT_ROOT, 'index.html'));
  await win.webContents.executeJavaScript("localStorage.setItem('agy_hub_color_theme', 'light')");
  await win.webContents.reload();
  await new Promise(resolve => setTimeout(resolve, 1500));
  win.showInactive();
  await win.webContents.executeJavaScript("document.getElementById('announcement-modal')?.style.setProperty('display', 'none')");

  const output = path.join(PROJECT_ROOT, 'smoke-light');
  fs.mkdirSync(output, { recursive: true });
  const updateImage = await win.webContents.capturePage();
  fs.writeFileSync(path.join(output, 'update.png'), updateImage.toPNG());
  await win.webContents.executeJavaScript("document.body.classList.remove('light-theme')");
  await new Promise(resolve => setTimeout(resolve, 150));
  const updateDarkImage = await win.webContents.capturePage();
  fs.writeFileSync(path.join(output, 'update-dark.png'), updateDarkImage.toPNG());
  await win.webContents.executeJavaScript("document.body.classList.add('light-theme')");
  await win.webContents.executeJavaScript("document.getElementById('update-modal')?.style.setProperty('display', 'none')");
  const pages = [
    ['patch', 'tab-patch'],
    ['accounts', 'tab-local-accounts'],
    ['codex-overview', 'tab-codex-gateway'],
    ['codex-claude', 'tab-codex-gateway'],
    ['codex-usage', 'tab-codex-gateway'],
    ['codex-provider', 'tab-codex-gateway'],
    ['announcements', 'tab-announcements']
  ];
  const pageStates = [];
  for (const [name, target] of pages) {
    const clickState = await win.webContents.executeJavaScript(`(() => {
      const nav = document.querySelector('.nav-item[data-target="${target}"]');
      nav?.click();
      const pane = document.getElementById("${target}");
      return {
        navFound: Boolean(nav),
        navActive: nav?.classList.contains('active'),
        paneFound: Boolean(pane),
        paneActive: pane?.classList.contains('active'),
        parentPane: pane?.parentElement?.closest('.tab-pane')?.id || null
      };
    })()`);
    await new Promise(resolve => setTimeout(resolve, 250));
    if (name === 'codex-claude') await win.webContents.executeJavaScript("document.querySelector('[data-codex-page=\"claude\"]').click()");
    if (name === 'codex-usage') await win.webContents.executeJavaScript("document.querySelector('[data-codex-page=\"usage\"]').click()");
    if (name === 'codex-provider') await win.webContents.executeJavaScript("document.querySelector('[data-codex-page=\"provider\"]').click()");
    await win.webContents.executeJavaScript("document.getElementById('announcement-modal')?.style.setProperty('display', 'none')");
    await new Promise(resolve => setTimeout(resolve, 300));
    const settledState = await win.webContents.executeJavaScript(`(() => ({
      activeNav: document.querySelector('.nav-item.active')?.dataset.target || null,
      activePane: document.querySelector('.tab-pane.active')?.id || null,
      activeCodexPage: document.querySelector('.codex-workspace-page.active')?.id || null
    }))()`);
    const image = await win.webContents.capturePage();
    fs.writeFileSync(path.join(output, `${name}.png`), image.toPNG());
    pageStates.push({ name, target, ...clickState, ...settledState });
  }

  await win.webContents.executeJavaScript(`(() => {
    document.body.classList.remove('light-theme');
    document.querySelector('.nav-item[data-target="tab-patch"]')?.click();
  })()`);
  await new Promise(resolve => setTimeout(resolve, 200));
  let darkImage = await win.webContents.capturePage();
  fs.writeFileSync(path.join(output, 'patch-dark.png'), darkImage.toPNG());
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('.nav-item[data-target="tab-codex-gateway"]')?.click();
    document.querySelector('[data-codex-page="provider"]')?.click();
  })()`);
  await new Promise(resolve => setTimeout(resolve, 250));
  darkImage = await win.webContents.capturePage();
  fs.writeFileSync(path.join(output, 'codex-provider-dark.png'), darkImage.toPNG());
  await win.webContents.executeJavaScript("document.body.classList.add('light-theme')");
  await new Promise(resolve => setTimeout(resolve, 200));

  const audit = await win.webContents.executeJavaScript(`(() => {
    const duplicateIds = [...document.querySelectorAll('[id]')].map(n => n.id).filter((id, i, all) => all.indexOf(id) !== i);
    const visible = [...document.querySelectorAll('body *')].filter(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return r.width > 2 && r.height > 2 && s.display !== 'none' && s.visibility !== 'hidden';
    });
    const darkSurfaces = visible.filter(el => {
      const color = getComputedStyle(el).backgroundColor;
      const value = color.match(/\\d+(?:\\.\\d+)?/g);
      const alpha = value && value.length >= 4 ? Number(value[3]) : 1;
      return value && value.length >= 3 && alpha > 0.05 && Number(value[0]) < 45 && Number(value[1]) < 45 && Number(value[2]) < 45;
    }).slice(0, 20).map(el => ({ tag: el.tagName, id: el.id, className: String(el.className).slice(0, 80), bg: getComputedStyle(el).backgroundColor }));
    return { duplicateIds, darkSurfaces, title: document.title, bodyClass: document.body.className };
  })()`);
  console.log(JSON.stringify({ audit, pageStates, errors, output }));
  app.quit();
});
