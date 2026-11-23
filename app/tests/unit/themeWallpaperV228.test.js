const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const asar = require('@electron/asar');
const { buildPreload } = require('../../patch-workbench/compatibility');

test('2.28 workbench shell stops hiding background without changing widgets or menus', () => {
  const legacy = asar.extractFile('patch-workbench/legacy-payload.asar', 'dist/preload.js').toString();
  const source = buildPreload("electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);", legacy);
  new vm.Script(source);
  assert.match(source, /html\.agy-theme-active-v2 #root \.agy-shell\.bg-background/);
  assert.match(source, /background-color: transparent !important/);
  assert.doesNotMatch(source, /markThemeWallpaperCoverLayers/);
  assert.doesNotMatch(source, /html\.agy-theme-active-v2 \* \{ background: transparent/);
});
