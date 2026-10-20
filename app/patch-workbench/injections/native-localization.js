(function AGYNativeLocalization() {
  'use strict';
  const electron = require('electron');
  const fs = require('fs'), path = require('path'), os = require('os');
  const builtin = /*__AGY_NATIVE_MESSAGES__*/ {};
  const dictionary = new Map(), normalize = text => text.replace(/\s+/g, ' ').trim().toLowerCase();
  const marker = Symbol.for('agy.nativeLocalization');
  function merge(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    for (const [english, chinese] of Object.entries(data).slice(0, 10000)) {
      if (typeof chinese !== 'string' || english.length > 2000 || chinese.length > 4000 || !/[\u3400-\u9fff]/.test(chinese)) continue;
      if (/^(?:__proto__|constructor|prototype)$/i.test(english) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(english+chinese)) continue;
      dictionary.set(normalize(english), chinese);
    }
  }
  merge(builtin);
  let lastChecked = -Infinity;
  function reload() {
    if (Date.now() - lastChecked < 2000) return;
    lastChecked = Date.now();
    try {
      const base = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData/Roaming'), 'Antigravity');
      let config = {};
      try {config = JSON.parse(fs.readFileSync(path.join(base,'agy-hub-integration.json'),'utf8').replace(/^\uFEFF/,''));} catch (_) {}
      for (const file of [config.translationCatalogPath,path.join(base,'agy-translations.zh-CN.json')]) {
        if (typeof file !== 'string' || !path.isAbsolute(file) || !fs.existsSync(file) || fs.statSync(file).size > 2*1024*1024) continue;
        const data = JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'')); merge(data.messages || data);
      }
    } catch (_) { /* Keep the compiled translations if optional data is unavailable. */ }
  }
  function translate(text) {
    if (typeof text !== 'string') return text;
    const match = dictionary.get(normalize(text));
    return match ? (text.match(/^\s*/)?.[0] || '') + match + (text.match(/\s*$/)?.[0] || '') : text;
  }
  // Sandboxed preloads cannot require fs. Expose only translation data from
  // our fixed catalog paths, never an arbitrary file-read endpoint.
  if (electron.ipcMain?.handle && !electron.ipcMain[marker]) {
    electron.ipcMain.handle('agy:i18n:catalog', event => {
      try {
        const origin = new URL(event.senderFrame?.url || event.sender?.getURL?.() || '');
        if (!['http:','https:'].includes(origin.protocol) || !['127.0.0.1','localhost','[::1]'].includes(origin.hostname)) return {};
        reload(); return {messages:Object.fromEntries(dictionary)};
      } catch (_) {return {};}
    });
    electron.ipcMain[marker] = true;
  }
  const plain = value => value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
  function options(value) {
    if (!plain(value)) return value;
    const copy = {...value};
    for (const field of ['title','message','detail','buttonLabel','cancelLabel','label','sublabel','toolTip']) {
      if (typeof copy[field] === 'string') copy[field] = translate(copy[field]);
    }
    if (Array.isArray(copy.buttons)) copy.buttons = copy.buttons.map(translate);
    if (Array.isArray(copy.submenu)) copy.submenu = copy.submenu.map(options);
    return copy;
  }
  function wrap(object, method, transform) {
    const original = object?.[method];
    if (typeof original !== 'function' || original[marker]) return;
    const wrapped = function(...args) {reload(); return original.apply(this, transform(args));};
    wrapped[marker] = true;
    try {object[method] = wrapped;} catch (_) { /* Do not prevent startup on a read-only Electron export. */ }
  }
  for (const method of ['showMessageBox','showMessageBoxSync','showOpenDialog','showOpenDialogSync','showSaveDialog','showSaveDialogSync']) {
    wrap(electron.dialog,method,args=>{const copy=[...args],last=copy.length-1;if (last>=0) copy[last]=options(copy[last]);return copy;});
  }
  wrap(electron.dialog,'showErrorBox',args=>args.map(translate));
  wrap(electron.Menu,'buildFromTemplate',args=>{const copy=[...args];if (Array.isArray(copy[0])) copy[0]=copy[0].map(options);return copy;});
})();
