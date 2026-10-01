const { app, BrowserWindow } = require('electron');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

app.commandLine.appendSwitch('disable-gpu');
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    show: false,
    webPreferences: { preload: path.join(PROJECT_ROOT, 'smoke-preload.js'), contextIsolation: true }
  });
  await win.loadFile(path.join(PROJECT_ROOT, 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 500));
  const result = await win.webContents.executeJavaScript(`(async () => {
    const started = performance.now();
    document.getElementById('btn-check-update').click();
    const immediate = {
      elapsedMs: performance.now() - started,
      visible: getComputedStyle(document.getElementById('update-modal')).display !== 'none',
      title: document.getElementById('update-modal-title').textContent,
      actionDisabled: document.getElementById('btn-update-action').disabled
    };
    await new Promise(resolve => setTimeout(resolve, 500));
    const settled = {
      title: document.getElementById('update-modal-title').textContent,
      notes: document.getElementById('update-release-notes').textContent,
      latest: document.getElementById('update-latest-version').textContent
    };
    return { immediate, settled };
  })()`);
  const passed = result.immediate.visible
    && result.immediate.elapsedMs < 200
    && result.immediate.title === '正在检查更新'
    && result.immediate.actionDisabled
    && result.settled.title === '检测到新版本'
    && result.settled.latest === 'v1.1.8'
    && !/[<>]/.test(result.settled.notes);
  console.log(JSON.stringify({ passed, result }));
  app.quit();
});
