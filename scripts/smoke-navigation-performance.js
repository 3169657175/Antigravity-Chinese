const { app, BrowserWindow } = require('electron');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    x: -32000,
    y: -32000,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(PROJECT_ROOT, 'smoke-preload.js'),
      contextIsolation: true,
      backgroundThrottling: false
    }
  });
  await win.loadFile(path.join(PROJECT_ROOT, 'index.html'));
  await new Promise(resolve => setTimeout(resolve, 1500));
  win.showInactive();
  await new Promise(resolve => setTimeout(resolve, 150));
  const metrics = await win.webContents.executeJavaScript(`(async () => {
    const afterPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const measureClick = async element => {
      const started = performance.now();
      element.click();
      const handlerMs = performance.now() - started;
      await afterPaint();
      return { handlerMs, paintedMs: performance.now() - started };
    };
    const patch = document.querySelector('[data-target="tab-patch"]');
    const themes = document.querySelector('[data-target="tab-themes"]');
    const gateway = document.querySelector('[data-target="tab-codex-gateway"]');
    const overview = document.querySelector('[data-codex-page="overview"]');
    const claude = document.querySelector('[data-codex-page="claude"]');

    patch.click();
    await afterPaint();
    const themeFirst = await measureClick(themes);
    patch.click();
    await afterPaint();
    const themeRepeat = await measureClick(themes);
    patch.click();
    await afterPaint();
    const gatewayFirst = await measureClick(gateway);
    patch.click();
    await afterPaint();
    const gatewayRepeat = await measureClick(gateway);
    const codexPage = await measureClick(overview);
    const claudePage = await measureClick(claude);
    return { themeFirst, themeRepeat, gatewayFirst, gatewayRepeat, codexPage, claudePage };
  })()`);
  console.log(JSON.stringify(metrics));
  const values = Object.values(metrics);
  if (values.some(item => item.handlerMs > 50 || item.paintedMs > 150)) process.exitCode = 1;
  win.destroy();
  app.quit();
});
