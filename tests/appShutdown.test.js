const test = require('node:test');
const assert = require('node:assert/strict');
const {
  QUIT_FOR_UPDATE_ARGUMENT,
  hasQuitForUpdateArgument,
  createAppShutdownCoordinator
} = require('../src/appShutdown.js');

test('quit-for-update command line matching is exact', () => {
  assert.equal(hasQuitForUpdateArgument(['agy-hub.exe', QUIT_FOR_UPDATE_ARGUMENT]), true);
  assert.equal(hasQuitForUpdateArgument(['agy-hub.exe', '--quit-for-update-now']), false);
  assert.equal(hasQuitForUpdateArgument(['agy-hub.exe', 'prefix--quit-for-update']), false);
  assert.equal(hasQuitForUpdateArgument(null), false);
});

test('shutdown preparation is idempotent and completes runtime cleanup before quit', async () => {
  const calls = [];
  const app = { isQuiting: false, quit: () => calls.push('quit') };
  let releaseRuntime;
  const runtimeStopped = new Promise(resolve => { releaseRuntime = resolve; });
  const coordinator = createAppShutdownCoordinator({
    app,
    destroyTray: () => calls.push('tray'),
    stopRuntime: async () => {
      calls.push('runtime-start');
      await runtimeStopped;
      calls.push('runtime-stopped');
    },
    timeoutMs: 1000
  });

  const quitting = coordinator.quit();
  const duplicate = coordinator.prepare();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.isQuiting, true);
  assert.equal(calls.filter(call => call === 'runtime-start').length, 1);
  assert.equal(calls.includes('quit'), false);
  releaseRuntime();
  await Promise.all([quitting, duplicate]);
  assert.deepEqual(calls, ['tray', 'runtime-start', 'runtime-stopped', 'quit']);
});
