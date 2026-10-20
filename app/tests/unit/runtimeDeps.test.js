const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

function resolveLocalModule(fromFile, request) {
  const target = path.resolve(path.dirname(fromFile), request);
  return [target, `${target}.js`, path.join(target, 'index.js')].find(candidate => fs.existsSync(candidate));
}

function collectRuntimeGraph(entryFile, visited = new Set()) {
  const absolute = path.resolve(__dirname, '..', '..', entryFile);
  if (visited.has(absolute)) return visited;
  assert.ok(fs.existsSync(absolute), `Missing runtime entry: ${entryFile}`);
  visited.add(absolute);

  const source = fs.readFileSync(absolute, 'utf8');
  for (const match of source.matchAll(/require\(['"](\.\.?\/[^'"]+)['"]\)/g)) {
    const resolved = resolveLocalModule(absolute, match[1]);
    assert.ok(resolved, `${path.relative(__dirname, absolute)} requires missing module ${match[1]}`);
    if (resolved.endsWith('.js')) collectRuntimeGraph(path.relative(path.resolve(__dirname, '..', '..'), resolved), visited);
  }
  return visited;
}

test('all packaged main-process local dependencies exist', () => {
  const graph = collectRuntimeGraph('main.js');
  assert.ok([...graph].some(file => file.endsWith(`${path.sep}brainMonitor.js`)));
  assert.ok([...graph].some(file => file.endsWith(`${path.sep}logTailReader.js`)));
  assert.ok([...graph].some(file => file.endsWith(`${path.sep}retryPolicy.js`)));
  assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'patchWorker.js')), 'Worker runtime entry patchWorker.js must be packaged');
  assert.ok(fs.existsSync(path.join(__dirname, '..', '..', 'appShutdown.js')), 'Shutdown coordinator must be packaged');
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
  assert.ok(packageJson.build.files.includes('skillCatalogRemote.js'), 'skillCatalogRemote.js must be packaged');
});

test('NSIS updater uses the dedicated graceful shutdown include', () => {
  const packageJson = require('../../package.json');
  assert.equal(packageJson.build.nsis.include, 'build/installer.nsh');
  const installerScript = fs.readFileSync(path.join(__dirname, '..', '..', 'build', 'installer.nsh'), 'utf8');
  assert.match(installerScript, /--quit-for-update/);
  assert.match(installerScript, /\$INSTDIR\\\$\{APP_EXECUTABLE_FILENAME\}/);
  assert.match(installerScript, /QueryFullProcessImageNameW/);
  assert.match(installerScript, /AGY_FIND_MAIN_PROCESS/);
  assert.match(installerScript, /AGY_FORCE_CLOSE_MAIN_PROCESS/);
  assert.match(installerScript, /AGY_BYPASS_BROKEN_LEGACY_UNINSTALLER/);
  assert.match(installerScript, /\$\{INSTALL_REGISTRY_KEY\}.*InstallLocation/);
  assert.match(installerScript, /GetFullPathName \$R9 "\$INSTDIR/);
  assert.doesNotMatch(installerScript, /\$R\d == "\d+\.\d+\.\d+"/);
  assert.match(installerScript, /DeleteRegKey/);
  assert.match(installerScript, /\$4 == "\$\{APP_EXECUTABLE_FILENAME\}"/);
  assert.match(installerScript, /\$4 == \$8/);
  assert.match(installerScript, /正在自动关闭程序以继续安装/);
  assert.doesNotMatch(installerScript, /MB_OKCANCEL/);
  assert.doesNotMatch(installerScript, /!insertmacro FIND_PROCESS/);
  assert.doesNotMatch(installerScript, /!insertmacro KILL_PROCESS/);
  assert.doesNotMatch(installerScript, /MB_RETRYCANCEL/);
  assert.doesNotMatch(installerScript, /agy_retry_shutdown/);
  assert.doesNotMatch(installerScript, /无法关闭安装目录中的/);
  assert.doesNotMatch(installerScript, /agy_wait_for_exit/);
  assert.match(installerScript, /TerminateProcess/);
  assert.doesNotMatch(installerScript, /nsExec::Exec/);
});

test('renderer entry files required by BrowserWindow exist', () => {
  for (const file of [
    'preload.js', 'index.html', 'renderer.js', 'patchController.js', 'style.css', 'safeDom.js', 'communityController.js', 'navigationController.js',
    'gatewayController.js', 'appShellController.js', 'localAccountsController.js',
    'themeController.js', 'tokenMonitorController.js', 'marketplaceController.js', 'operationFeedback.js',
    'marketplace/marketplacePresenter.js', 'marketplace/marketplaceLayout.js',
    'styles/base.css', 'styles/gateway.css', 'styles/theme-modes.css', 'styles/claude-access.css'
  ]) {
    assert.ok(fs.existsSync(path.join(__dirname, '..', '..', file)), `Missing renderer runtime file: ${file}`);
  }
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  for (const dependency of ['safeDom.js', 'communityController.js', 'navigationController.js', 'marketplace/marketplacePresenter.js', 'marketplace/marketplaceLayout.js']) {
    assert.ok(html.includes(`src="${dependency}"`), `index.html must load ${dependency}`);
    assert.ok(html.indexOf(`src="${dependency}"`) < html.indexOf('src="renderer.js"'), `${dependency} must load before renderer.js`);
  }
});

test('all built-in theme preview images are present in the package source', () => {
  for (const file of ['哆啦A梦.png', '蜡笔小新.jpg', '线条小狗.png', '海贼王.png', '狐妖小红娘.png']) {
    const imagePath = path.join(__dirname, '..', '..', 'assets', 'themes', file);
    assert.ok(fs.existsSync(imagePath), `Missing built-in theme image: ${file}`);
    assert.ok(fs.statSync(imagePath).size > 100 * 1024, `Theme image is unexpectedly small: ${file}`);
  }
});
