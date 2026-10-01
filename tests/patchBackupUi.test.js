const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const main = fs.readFileSync('main.js', 'utf8');
const preload = fs.readFileSync('preload.js', 'utf8');
const patchController = fs.readFileSync('src/patchController.js', 'utf8');
const markup = fs.readFileSync('index.html', 'utf8');

test('patch page exposes inject, previous patch and official original as separate actions', () => {
  assert.match(markup, /id="btn-install-patch"/);
  assert.match(markup, /id="btn-cancel-patch"/);
  assert.match(markup, /id="btn-restore-previous"[\s\S]*?退回上一版汉化/);
  assert.match(markup, /id="btn-restore-original"[\s\S]*?还原官方英文原版/);
});

test('patch controller and preload wire separate previous and original restore IPC calls', () => {
  assert.match(preload, /restorePreviousPatch:[\s\S]*?restore-previous-patch/);
  assert.match(preload, /restoreOriginal:[\s\S]*?restore-original/);
  assert.match(patchController, /restorePreviousPatch\(asarPath\)/);
  assert.match(patchController, /restoreOriginal\(asarPath\)/);
  assert.match(patchController, /getPatchBackupStatus\(asarPath\)/);
  assert.match(preload, /cancelPatchInstall:[\s\S]*?cancel-patch-install/);
  assert.match(patchController, /cancelPatchInstall\(\)/);
});

test('main process uses fixed backup manager instead of timestamped backup history', () => {
  assert.match(main, /new PatchBackupManager/);
  assert.match(main, /restore-previous-patch/);
  assert.match(main, /restorePatchBackup\('original'/);
  assert.doesNotMatch(main, /app\.asar\.backup_\$\{/);
  assert.doesNotMatch(main, /backupHistory\.push/);
});
