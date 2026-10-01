const test = require('node:test');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { buildMain, buildTray, buildUtils, assertTrayModuleLoads } = require('./patch-workbench/compatibility');

const legacyArchive = path.join(__dirname, 'patch-workbench', 'legacy-payload.asar');
const patchArchive = path.join(__dirname, 'assets', 'app.asar');
const officialTray = fs.readFileSync(path.join(__dirname, 'patch-workbench/fixtures/tray-2.17.0.js.txt'), 'utf8');

function loadTray(source) {
  const state = { events: new Map(), menu: null, resetCount: 0 };
  class Tray {
    setToolTip() {}
    setContextMenu(menu) { state.menu = menu; state.resetCount += 1; }
    on(event, callback) { state.events.set(event, callback); }
  }
  class MenuItem { constructor(options) { Object.assign(this, options); } }
  const dependencies = {
    electron: {
      Tray, MenuItem,
      nativeImage: { createFromPath: () => ({ setTemplateImage() {} }) },
      app: { getName: () => 'Antigravity', focus() {} },
      Menu: { buildFromTemplate: items => ({ items: items.map(item => new MenuItem(item)), insert(position, item) { this.items.splice(position, 0, item); } }) },
      BrowserWindow: { getAllWindows: () => [] }
    },
    path,
    './utils': { isMacOS: () => false, showOrCreateWindow() {} },
    './languageServer': { getLsPort: () => 1234 }
  };
  const exports = {};
  new vm.Script(source).runInNewContext({ exports, __dirname: '/fixtures/dist', require: name => dependencies[name] }, { timeout: 1000 });
  return { exports, state };
}

function read(archive, file) {
  return asar.extractFile(archive, file).toString('utf8');
}

function replaceSection(source, start, end, replacement = '') {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `missing fixture start: ${start}`);
  assert.notEqual(endIndex, -1, `missing fixture end: ${end}`);
  return `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
}

test('compatibility builder restores tray activation without replacing the current tray module wholesale', () => {
  const legacy = read(legacyArchive, 'dist/tray.js');
  const functionEnd = '\n}\n/**\n * Updates the active agents count in the tray menu.';
  const officialStyleInput = replaceSection(
    read(legacyArchive, 'dist/tray.js'),
    'const translatedActions = actions.map',
    functionEnd,
    '    contextMenu = electron_1.Menu.buildFromTemplate(actions);\n    tray.setContextMenu(contextMenu);'
  );
  const originalAgentLabel = officialTray.slice(officialTray.indexOf('countItem.label ='), officialTray.indexOf('            tray.setContextMenu(contextMenu);', officialTray.indexOf('countItem.label ='))).trim();
  const rebuilt = buildTray(officialStyleInput.replace("countItem.label = count > 0 ? `${count} 个智能体运行中` : '没有智能体在运行';", originalAgentLabel), legacy);
  assert.match(rebuilt, /tray\.on\('click'/);
  assert.match(rebuilt, /tray\.on\('double-click'/);
  assert.match(rebuilt, /打开 Antigravity/);
});

test('2.17.0 tray module loads and asynchronous WSL menu insertion survives translation', () => {
  const rebuilt = buildTray(officialTray, read(legacyArchive, 'dist/tray.js'));
  const { exports, state } = loadTray(rebuilt);
  assert.equal(typeof exports.insertTrayMenuItem, 'function');
  exports.insertTrayMenuItem(0, { label: 'Before initialization' });
  assert.equal(state.menu, null);
  exports.createTray([{ id: 'running-agents', label: 'No agents running' }, { label: 'Open Antigravity' }, { label: 'Quit' }]);
  assert.equal(state.menu.items[1].label, '打开 Antigravity');
  assert.equal(state.menu.items[2].label, '退出');
  exports.insertTrayMenuItem(1, { id: 'wsl', label: 'Ubuntu' });
  assert.equal(state.menu.items[1].id, 'wsl');
  exports.insertTrayMenuItem(999, { label: 'Last item' });
  assert.equal(state.menu.items.at(-1).label, 'Last item');
  exports.updateTrayAgentCount(2);
  assert.equal(state.menu.items[0].label, '2 个智能体运行中');
  exports.updateTrayAgentCount(0);
  assert.equal(state.menu.items[0].label, '没有智能体在运行');
  assert.equal(state.resetCount, 5);
  assert.equal(state.events.has('click'), true);
  assert.equal(state.events.has('double-click'), true);
});

test('tray patch preserves official functions after the count updater and other create behavior', () => {
  const extra = '\nexports.futureTrayFeature = futureTrayFeature;\nfunction futureTrayFeature() { return 217; }\n';
  const input = officialTray.replace('    tray.setToolTip(electron_1.app.getName());', '    tray.setToolTip(electron_1.app.getName());\n    tray.officialFutureFlag = true;') + extra;
  const rebuilt = buildTray(input, read(legacyArchive, 'dist/tray.js'));
  assert.match(rebuilt, /tray\.officialFutureFlag = true;/);
  assert.ok(rebuilt.endsWith(extra));
  assert.equal(loadTray(rebuilt).exports.futureTrayFeature(), 217);
});

test('module load validation rejects the syntax-valid missing declaration seen in 2.17.0', () => {
  const broken = replaceSection(officialTray, 'function insertTrayMenuItem(', '/**\n * Updates the active agents count');
  assert.doesNotThrow(() => new vm.Script(broken));
  assert.throws(() => assertTrayModuleLoads(broken, officialTray), /insertTrayMenuItem is not defined/);
  assert.throws(() => assertTrayModuleLoads(officialTray.replace('exports.insertTrayMenuItem = insertTrayMenuItem;', ''), officialTray), /removed or changed official export/);
});

test('compatibility builder restores close-to-background and safe real quit state', () => {
  const legacyUtils = read(legacyArchive, 'dist/utils.js');
  let officialStyleUtils = read(patchArchive, 'dist/utils.js');
  if (officialStyleUtils.includes("win.on('close'")) {
    officialStyleUtils = replaceSection(officialStyleUtils, "win.on('close'", '    void win.loadURL(url);');
  }
  if (officialStyleUtils.includes('function shouldRunInBackground() {')) {
    officialStyleUtils = replaceSection(
      officialStyleUtils,
      'function shouldRunInBackground() {',
      '/**\n * Focuses a window if it exists, or creates a new one.'
    );
  }
  const rebuiltUtils = buildUtils(officialStyleUtils, legacyUtils);
  assert.match(rebuiltUtils, /win\.on\('close'/);
  assert.match(rebuiltUtils, /event\.preventDefault\(\)/);
  assert.match(rebuiltUtils, /win\.hide\(\)/);
  assert.match(rebuiltUtils, /function shouldRunInBackground\(\)/);

  const patchedMain = read(patchArchive, 'dist/main.js');
  const officialStyleMain = patchedMain.split('global.isQuitting = true;').join('');
  const rebuiltMain = buildMain(officialStyleMain, read(legacyArchive, 'dist/main.js'));
  assert.equal(rebuiltMain.split('global.isQuitting = true;').length - 1, 1);
});
