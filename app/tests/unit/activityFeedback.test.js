const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), vm = require('vm');
test('localization preserves official active-count IPC without adding an activity card', async () => {
  const { buildPreload } = require('../../patch-workbench/compatibility');
  const asar = require('@electron/asar');
  const official = "const agentAPI = { updateActiveAgentCount: (count) => electron_1.ipcRenderer.invoke('agent:update-active-count', count), };\nelectron_1.contextBridge.exposeInMainWorld('ide', ideAPI);";
  const output = buildPreload(official, asar.extractFile('patch-workbench/legacy-payload.asar','dist/preload.js').toString());
  assert.doesNotMatch(output, /AGYActivityFeedback|__agyProgress|agy-activity-feedback/);
  const hook = output.slice(0, output.indexOf("electron_1.contextBridge.exposeInMainWorld('ide'"));
  const calls = [];
  const context = { electron_1: { ipcRenderer: { invoke: (...args) => { calls.push(args); return Promise.resolve('original-result'); } } }, globalThis: {} };
  vm.runInNewContext(hook + '\nglobalThis.api = agentAPI;', context);
  assert.equal(await context.globalThis.api.updateActiveAgentCount(2), 'original-result');
  assert.deepEqual(calls, [['agent:update-active-count',2]]);
});
