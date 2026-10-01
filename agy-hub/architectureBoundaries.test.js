const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const lineCount = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).length;

test('giant runtime files stay within maintainability budgets', () => {
  assert.ok(lineCount('main.js') < 1400, 'main.js should remain an orchestrator');
  assert.ok(lineCount('renderer.js') < 3450, 'renderer.js should not absorb page controllers again');
  assert.ok(lineCount('marketplaceController.js') < 1600, 'marketplace controller should stay modular');
  assert.ok(lineCount('codexGateway.js') < 1650, 'codexGateway.js should delegate protocol adapters');
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
  assert.equal(typeof require('./gatewayIpc.js').registerGatewayIpc, 'function');
  assert.equal(typeof require('./gatewayHttp.js').readJson, 'function');
  assert.equal(typeof require('./responsesRequestAdapter.js').convertResponsesRequest, 'function');
  assert.equal(typeof require('./gatewayController.js').init, 'function');
  assert.equal(typeof require('./appShellController.js').init, 'function');
  assert.equal(typeof require('./accountIpc.js').registerAccountIpc, 'function');
  assert.equal(typeof require('./localAccountsController.js').loadLocalAccounts, 'function');
  assert.equal(typeof require('./themeIpc.js').registerThemeIpc, 'function');
  assert.equal(typeof require('./themeController.js').init, 'function');
  assert.equal(typeof require('./tokenMonitorController.js').init, 'function');
  assert.equal(typeof require('./marketplaceController.js').init, 'function');
  assert.equal(typeof require('./marketplace/marketplacePresenter.js').createPresenter, 'function');
  assert.equal(typeof require('./marketplace/marketplaceLayout.js').calculatePageSize, 'function');
  assert.equal(typeof require('./navigationController.js').bind, 'function');
  assert.equal(typeof require('./gatewayConfigStore.js').GatewayConfigStore, 'function');
  assert.equal(typeof require('./communityClient.js').CommunityClient, 'function');
  assert.equal(typeof require('./mcpProbe.js').probeMcpServer, 'function');
  assert.equal(typeof require('./patchController.js').init, 'function');
  assert.equal(typeof require('./patchBackupManager.js').PatchBackupManager, 'function');
  assert.equal(typeof require('./logTailReader.js').LogTailReader, 'function');
  assert.equal(typeof require('./retryPolicy.js').canRetryGeneration, 'function');
  assert.equal(typeof require('./patchWorker.js').inspectPatchArchive, 'function');
});

test('renderer controllers load before the renderer entry', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(html.indexOf('patchController.js') < html.indexOf('renderer.js'));
  assert.ok(html.indexOf('marketplaceController.js') < html.indexOf('renderer.js'));
  assert.ok(html.indexOf('gatewayController.js') < html.indexOf('renderer.js'));
  assert.ok(html.indexOf('appShellController.js') < html.indexOf('renderer.js'));
});
