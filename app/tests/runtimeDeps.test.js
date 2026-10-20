const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');

function resolveLocalModule(fromFile, request) {
  const target = path.resolve(path.dirname(fromFile), request);
  return [target, `${target}.js`, path.join(target, 'index.js')].find(candidate => fs.existsSync(candidate));
}

function collectRuntimeGraph(entryFile, visited = new Set()) {
  const absolute = path.resolve(PROJECT_ROOT, entryFile);
  if (visited.has(absolute)) return visited;
  assert.ok(fs.existsSync(absolute), `Missing runtime entry: ${entryFile}`);
  visited.add(absolute);

  const source = fs.readFileSync(absolute, 'utf8');
  for (const match of source.matchAll(/require\(['"](\.\.?\/[^'"]+)['"]\)/g)) {
    const resolved = resolveLocalModule(absolute, match[1]);
    assert.ok(resolved, `${path.relative(PROJECT_ROOT, absolute)} requires missing module ${match[1]}`);
    if (resolved.endsWith('.js')) collectRuntimeGraph(path.relative(PROJECT_ROOT, resolved), visited);
  }
  return visited;
}

test('all packaged main-process local dependencies exist', () => {
  const graph = collectRuntimeGraph('main.js');
  assert.ok([...graph].some(file => file.endsWith(`${path.sep}brainMonitor.js`)));
  assert.ok([...graph].some(file => file.endsWith(`${path.sep}logTailReader.js`)));
  assert.ok([...graph].some(file => file.endsWith(`${path.sep}retryPolicy.js`)));
  assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'src/patchWorker.js')), 'Worker runtime entry patchWorker.js must be packaged');
  assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'src/appShutdown.js')), 'Shutdown coordinator must be packaged');
});

test('NSIS updater uses the dedicated graceful shutdown include', () => {
  const packageJson = require('../package.json');
  assert.equal(packageJson.build.nsis.include, 'build/installer.nsh');
  const builderVersion = packageJson.devDependencies['electron-builder'].replace(/^[^\d]*/, '').split('.').map(Number);
  assert.ok(
    builderVersion[0] > 26 || (builderVersion[0] === 26 && (builderVersion[1] > 15 || (builderVersion[1] === 15 && builderVersion[2] >= 3))),
    'electron-builder 26.15.3+ is required for install-directory-scoped process detection'
  );
  const installerScript = fs.readFileSync(path.join(PROJECT_ROOT, 'build', 'installer.nsh'), 'utf8');
  assert.match(installerScript, /--quit-for-update/);
  assert.match(installerScript, /\$INSTDIR\\\$\{APP_EXECUTABLE_FILENAME\}/);
  assert.match(installerScript, /IS_POWERSHELL_AVAILABLE/);
  assert.match(installerScript, /KILL_PROCESS/);
  assert.match(installerScript, /Sleep 4000/);
  assert.ok(
    (installerScript.match(/FIND_PROCESS/g) || []).length <= 4,
    'installer must not repeatedly launch PowerShell/CIM while waiting for shutdown'
  );
  assert.doesNotMatch(installerScript, /agy_wait_for_exit/);
  assert.doesNotMatch(installerScript, /AGY Hub\*/i);
  assert.doesNotMatch(installerScript, /taskkill/i);
});

test('renderer entry files required by BrowserWindow exist', () => {
  for (const file of [
    'preload.js', 'index.html', 'renderer.js', 'src/patchController.js', 'style.css', 'src/safeDom.js', 'src/communityController.js', 'src/navigationController.js',
    'src/gatewayController.js', 'src/appShellController.js', 'src/localAccountsController.js',
    'src/themeController.js', 'src/tokenMonitorController.js', 'src/marketplaceController.js', 'src/operationFeedback.js',
    'src/marketplace/marketplacePresenter.js', 'src/marketplace/marketplaceLayout.js',
    'styles/base.css', 'styles/gateway.css', 'styles/theme-modes.css', 'styles/claude-access.css'
  ]) {
    assert.ok(fs.existsSync(path.join(PROJECT_ROOT, file)), `Missing renderer runtime file: ${file}`);
  }
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'index.html'), 'utf8');
  for (const dependency of ['src/safeDom.js', 'src/communityController.js', 'src/navigationController.js', 'src/marketplace/marketplacePresenter.js', 'src/marketplace/marketplaceLayout.js']) {
    assert.ok(html.includes(`src="${dependency}"`), `index.html must load ${dependency}`);
    assert.ok(html.indexOf(`src="${dependency}"`) < html.indexOf('src="renderer.js"'), `${dependency} must load before renderer.js`);
  }
});

test('all built-in theme preview images are present in the package source', () => {
  for (const file of ['哆啦A梦.png', '蜡笔小新.jpg', '线条小狗.png', '海贼王.png', '狐妖小红娘.png']) {
    const imagePath = path.join(PROJECT_ROOT, 'assets', 'themes', file);
    assert.ok(fs.existsSync(imagePath), `Missing built-in theme image: ${file}`);
    assert.ok(fs.statSync(imagePath).size > 100 * 1024, `Theme image is unexpectedly small: ${file}`);
  }
});
