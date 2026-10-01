const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const lineCount = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).length;

test('giant runtime files stay within maintainability budgets', () => {
  assert.ok(lineCount('main.js') < 1400, 'main.js should remain an orchestrator');
  assert.ok(lineCount('renderer.js') < 3450, 'renderer.js should not absorb page controllers again');
  assert.ok(lineCount('src/marketplaceController.js') < 1600, 'marketplace controller should stay modular');
  assert.ok(lineCount('src/codexGateway.js') < 1650, 'codexGateway.js should delegate protocol adapters');
  assert.ok(lineCount('styles/base.css') < 3600, 'base.css should stay within its module budget');
  assert.ok(lineCount('styles/gateway.css') < 500, 'gateway.css should stay within its module budget');
  assert.ok(lineCount('styles/theme-modes.css') < 800, 'theme-modes.css should stay within its module budget');
  assert.ok(lineCount('styles/claude-access.css') < 150, 'claude-access.css should stay within its module budget');

  const runtimeCss = fs.readFileSync('style.css', 'utf8');
  assert.doesNotMatch(
    runtimeCss,
    /^\s*@import/m,
    'Electron must load a complete runtime stylesheet instead of nested local imports'
  );
});

test('extracted modules expose explicit registration or initialization boundaries', () => {
  assert.equal(typeof require('../src/gatewayIpc.js').registerGatewayIpc, 'function');
  assert.equal(typeof require('../src/gatewayHttp.js').readJson, 'function');
  assert.equal(typeof require('../src/responsesRequestAdapter.js').convertResponsesRequest, 'function');
  assert.equal(typeof require('../src/gatewayController.js').init, 'function');
  assert.equal(typeof require('../src/appShellController.js').init, 'function');
  assert.equal(typeof require('../src/accountIpc.js').registerAccountIpc, 'function');
  assert.equal(typeof require('../src/localAccountsController.js').loadLocalAccounts, 'function');
  assert.equal(typeof require('../src/themeIpc.js').registerThemeIpc, 'function');
  assert.equal(typeof require('../src/themeController.js').init, 'function');
  assert.equal(typeof require('../src/tokenMonitorController.js').init, 'function');
  assert.equal(typeof require('../src/marketplaceController.js').init, 'function');
  assert.equal(typeof require('../src/marketplace/marketplacePresenter.js').createPresenter, 'function');
  assert.equal(typeof require('../src/marketplace/marketplaceLayout.js').calculatePageSize, 'function');
  assert.equal(typeof require('../src/navigationController.js').bind, 'function');
  assert.equal(typeof require('../src/gatewayConfigStore.js').GatewayConfigStore, 'function');
  assert.equal(typeof require('../src/communityClient.js').CommunityClient, 'function');
  assert.equal(typeof require('../src/mcpProbe.js').probeMcpServer, 'function');
  assert.equal(typeof require('../src/patchController.js').init, 'function');
  assert.equal(typeof require('../src/patchBackupManager.js').PatchBackupManager, 'function');
  assert.equal(typeof require('../src/logTailReader.js').LogTailReader, 'function');
  assert.equal(typeof require('../src/retryPolicy.js').canRetryGeneration, 'function');
  assert.equal(typeof require('../src/patchWorker.js').inspectPatchArchive, 'function');
});

test('renderer controllers load before the renderer entry', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('src/patchController.js') < html.indexOf('renderer.js'));
  assert.ok(html.indexOf('src/marketplaceController.js') < html.indexOf('renderer.js'));
  assert.ok(html.indexOf('src/gatewayController.js') < html.indexOf('renderer.js'));
  assert.ok(html.indexOf('src/appShellController.js') < html.indexOf('renderer.js'));
});
