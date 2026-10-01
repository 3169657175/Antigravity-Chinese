const { app, BrowserWindow } = require('electron');
const path = require('path');

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const errors = [];
  const win = new BrowserWindow({
    show: false,
    width: 1100,
    height: 760,
    webPreferences: {
      preload: path.join(__dirname, 'smoke-first-phase-preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) errors.push(message); });
  await win.loadFile(path.join(__dirname, 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 800));

  const baseline = await win.webContents.executeJavaScript('window.agyHubAPI.getTokenSmokeCounts()');
  await win.webContents.executeJavaScript(`(() => {
    document.querySelector('[data-target="tab-local-accounts"]')?.click();
    document.getElementById('btn-la-tab-token')?.click();
  })()`);
  await new Promise(resolve => setTimeout(resolve, 3300));
  const active = await win.webContents.executeJavaScript('window.agyHubAPI.getTokenSmokeCounts()');
  await win.webContents.executeJavaScript("document.querySelector('[data-target=\"tab-patch\"]')?.click()");
  await new Promise(resolve => setTimeout(resolve, 3300));
  const stopped = await win.webContents.executeJavaScript('window.agyHubAPI.getTokenSmokeCounts()');

  const patchUi = await win.webContents.executeJavaScript(`(async () => {
    const install = document.getElementById('btn-install-patch');
    const cancel = document.getElementById('btn-cancel-patch');
    install.click();
    await new Promise(resolve => setTimeout(resolve, 30));
    const visibleWhileRunning = getComputedStyle(cancel).display !== 'none';
    await window.agyHubAPI.emitPatchProgress({ id: 'patch-install', state: 'running', cancellable: false });
    const disabledDuringCommit = cancel.disabled;
    await window.agyHubAPI.finishPatchSmoke();
    await new Promise(resolve => setTimeout(resolve, 30));
    return { visibleWhileRunning, disabledDuringCommit, hiddenAfterFinish: getComputedStyle(cancel).display === 'none' };
  })()`);

  const result = { baseline, active, stopped, patchUi, errors };
  console.log(JSON.stringify(result));
  let exitCode = 0;
  if (active.tokenStatsCalls <= baseline.tokenStatsCalls || active.tokenStatusCalls <= baseline.tokenStatusCalls) exitCode = 1;
  if (stopped.tokenStatsCalls !== active.tokenStatsCalls || stopped.tokenStatusCalls !== active.tokenStatusCalls) exitCode = 1;
  if (!patchUi.visibleWhileRunning || !patchUi.disabledDuringCommit || !patchUi.hiddenAfterFinish) exitCode = 1;
  if (errors.some(message => !/公告系统载入失败|Failed to fetch/.test(message))) exitCode = 1;
  win.destroy();
  app.exit(exitCode);
});
