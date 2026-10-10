const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolvePatchWorkbenchResource } = require('./patchResourceResolver');
const { withDetachedArchive } = require('./archiveReadIsolation');
const { isAntigravityInstallerActive, createAntigravityInstallMonitor } = require('./antigravityInstallMonitor');
test('Packaged patch resources resolve from external resources/patch instead of app.asar', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-resource-test-'));
  try {
    fs.mkdirSync(path.join(dir, 'patch'));
    fs.writeFileSync(path.join(dir, 'patch', 'zh-CN.json'), '{}');
    const result = resolvePatchWorkbenchResource('locales/zh-CN.json', { resourcesPath: dir, workbenchDir: path.join(dir, 'not-on-disk') });
    assert.equal(result, path.join(dir, 'patch', 'zh-CN.json'));
    assert.throws(() => resolvePatchWorkbenchResource('injections/translation-enhancement.js', { resourcesPath: dir, workbenchDir: path.join(dir, 'not-on-disk') }), /汉化运行资源缺失/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('Archive inspection uses independent snapshot and removes it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-detached-test-'));
  try {
    const installed = path.join(dir, 'app.asar');
    fs.writeFileSync(installed, 'real-install-data');
    let snapshot;
    const inspected = withDetachedArchive(installed, tmp => { snapshot = tmp; assert.notEqual(tmp, installed); return fs.readFileSync(tmp, 'utf8'); }, { tempRoot: dir });
    assert.equal(inspected, 'real-install-data');
    assert.equal(fs.existsSync(installed), true);
    assert.equal(fs.existsSync(snapshot), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('Install detector distinguishes official Setup from running Antigravity and AGY Hub', () => {
  assert.equal(isAntigravityInstallerActive('\"Antigravity Setup 2.22.0.exe\",\"1234\"'), true);
  assert.equal(isAntigravityInstallerActive('\"Uninstall Antigravity.exe\",\"1234\"'), true);
  assert.equal(isAntigravityInstallerActive('\"Antigravity.exe\",\"1234\"\n\"AGY Hub 桌面管家.exe\",\"333\"'), false);
});
test('Install monitor signals enter and leave without stopping gateway', async () => {
  let listed = '\"Antigravity Setup 2.22.0.exe\",\"123\"', changes=[];
  const monitor = createAntigravityInstallMonitor({ execFile(_bin,_args,_opts,done){done(null,listed,'')}, onChange: value => changes.push(value), intervalMs: 999999 });
  monitor.start();
  await monitor.poll();
  assert.equal(monitor.isInstalling(), true);
  listed='\"Antigravity.exe\",\"456\"';monitor.poll();
  assert.equal(monitor.isInstalling(), false);
  assert.deepEqual(changes, [true,false]);
  monitor.stop();
});
test('Feedback dialog cancels stale close timeout and reactivates on reopen', () => {
  const source = fs.readFileSync('renderer.js', 'utf8');
  assert.match(source, /clearTimeout\(modal\._agyHideTimer\);\s*modal\.classList\.add\('active'\)/);
  assert.match(source, /if \(!detailModal\.classList\.contains\('active'\)\) detailModal\.style\.display = 'none'/);
  assert.match(source, /String\(f\.id\) === String\(id\)/);
});