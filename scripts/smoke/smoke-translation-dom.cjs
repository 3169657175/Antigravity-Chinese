// Run localization in Chromium, including asynchronous React-style UI updates.
const path = require('path');
const root = path.resolve(__dirname, '../..');
if (!process.argv.includes('--electron-child')) {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const result = require('child_process').spawnSync(path.join(root, 'node_modules/electron/dist/electron.exe'),
    [__filename, '--electron-child', ...process.argv.slice(2)], { cwd: root, env, windowsHide: true, stdio: 'inherit', timeout: 45000 });
  if (result.error) console.error(result.error.message);
  process.exit(result.status ?? 1);
}
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const assert = require('assert/strict');
const asar = require('@electron/asar');
const work = fs.mkdtempSync(path.join(root, '.codex-stage/i18n-dom-'));
app.setPath('userData', path.join(work, 'user-data'));
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, nodeIntegration: false, contextIsolation: true } });
  const errors = [];
  win.webContents.on('console-message', (_,level,message) => {if (level >= 2) errors.push(message);});
  const filler = '<div class="volatile">General</div>'.repeat(3000);
  const fixture = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'"><nav>${filler}<button data-testid="settings-button"><span class="truncate text-sm">Settings</span></button></nav>
    <section data-testid="agent-input-box"><button id="project"><span>No Project</span></button>
    <div class="relative w-full"><div contenteditable="true" role="combobox" aria-label="Message input" data-placeholder="Ask anything, @ to mention, / for actions">Settings</div>
    <div id="hint">Ask anything, @ to mention, / for actions</div></div><button id="turbo"><span>Turbo</span></button></section>
    <div data-message-author-role="assistant">Settings</div><div data-testid="project-name">Settings</div><pre>Settings</pre>`;
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(fixture));
  const packed = process.argv.includes('--packaged');
  let engine;
  if (packed) {
    const preload = asar.extractFile(path.join(root,'dist/win-unpacked/resources/patch/app.asar'), 'dist/preload.js').toString();
    const start = preload.indexOf('globalThis.__agyI18nCatalog = ');
    const end = preload.indexOf('})();',preload.indexOf('(function AGYTranslationEnhancement()',start)) + 5;
    assert.ok(start >= 0 && end > start);
    engine = preload.slice(start,end);
  } else {
    engine = `globalThis.__agyI18nCatalog = ${fs.readFileSync(path.join(root,'patch-workbench/locales/zh-CN.json'),'utf8')};\n` +
      fs.readFileSync(path.join(root,'patch-workbench/injections/translation-enhancement.js'),'utf8');
  }
  await win.webContents.executeJavaScript(engine + `\nwindow.removedRows=0;window.churn=setInterval(()=>{for(const row of document.querySelectorAll('.volatile'))if(row.textContent==='常规'){row.remove();window.removedRows++;}},0);globalThis.__agyI18n.start();`);
  const snapshot = () => win.webContents.executeJavaScript(`({settings:document.querySelector('[data-testid="settings-button"]').textContent,project:document.querySelector('#project').textContent,turbo:document.querySelector('#turbo').textContent,hint:document.querySelector('#hint').textContent,input:document.querySelector('[contenteditable]').textContent,message:document.querySelector('[data-message-author-role]').textContent,projectName:document.querySelector('[data-testid="project-name"]').textContent,code:document.querySelector('pre').textContent})`);
  const expected = {settings:'设置',project:'无项目',turbo:'极速模式',hint:'输入问题，输入 @ 提及，/ 执行动作',input:'Settings',message:'Settings',projectName:'Settings',code:'Settings'};
  const waitFor = async label => {for(let i=0;i<100;i++){const value=await snapshot();if(JSON.stringify(value)===JSON.stringify(expected))return value;await new Promise(r=>setTimeout(r,20));}assert.deepEqual(await snapshot(),expected,label);};
  await waitFor('initial render');
  await win.webContents.executeJavaScript('clearInterval(window.churn)');
  await win.webContents.executeJavaScript(`document.querySelector('[data-testid="settings-button"]').innerHTML='<span class="truncate text-sm">Settings</span>';document.querySelector('#project span').firstChild.nodeValue='No Project';document.querySelector('#turbo').innerHTML='<span>Turbo</span>';document.querySelector('#hint').textContent='Ask anything, @ to mention, / for actions';`);
  await waitFor('dynamic render');
  const removedRows = await win.webContents.executeJavaScript('window.removedRows');
  assert.ok(removedRows > 250, 'The page must remove rows across multiple scan slices');
  assert.deepEqual(errors,[]);
  const archive = path.join(root,'dist/win-unpacked/resources/patch/app.asar');
  const sha256 = data => require('crypto').createHash('sha256').update(data).digest('hex');
  fs.writeFileSync(path.join(root,'.codex-stage/translation-dom-report.json'),JSON.stringify({ok:true,packed,engineSha256:sha256(engine),patchSha256:packed?sha256(require('original-fs').readFileSync(archive)):null,removedRows,cases:['concurrent list removal','dynamic render','protected user content'],values:await snapshot()},null,2));
  console.log('Translation DOM smoke passed:',packed?'packaged':'source');
  win.destroy(); app.quit();
}).catch(error => {console.error(error.stack, JSON.stringify({actual:error.actual,expected:error.expected})); app.exit(1);});
