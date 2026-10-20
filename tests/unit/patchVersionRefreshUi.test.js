const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function createPage(api) {
  const elements = new Map();
  const document = { getElementById(id) {
    if (!elements.has(id)) elements.set(id, { value: '', style: {}, dataset: {}, listeners: new Map(), addEventListener(name, callback) { this.listeners.set(name, callback); } });
    return elements.get(id);
  } };
  const window = { agyHubAPI: api };
  vm.runInNewContext(fs.readFileSync('patchController.js', 'utf8'), { window, document });
  return { init: () => window.AgyPatchController.init(), elements };
}

test('injection refreshes versions immediately for the selected client without redetecting another installation', async () => {
  let version = '2.22.0', detects = 0;
  const reads = [];
  const page = createPage({
    detectPaths: async () => { detects++; return { detected: true, installDir: 'C:\\First', asarPath: 'C:\\First\\resources\\app.asar' }; },
    getAsarVersions: async target => { reads.push(target); return { success: true, originalVersion: version, patchVersion: '1.4.0', runtimeResourcesReady: true, clientStructureReady: true }; },
    getPatchBackupStatus: async () => ({ success: true, hasOriginal: true }),
    installPatch: async target => { assert.equal(target, 'D:\\Selected\\resources\\app.asar'); version = '2.24.0'; return { success: true, msg: 'done' }; }
  });
  await page.init();
  page.elements.get('input-install-dir').value = 'D:\\Selected';
  await page.elements.get('btn-install-patch').listeners.get('click')();
  assert.equal(detects, 1);
  assert.equal(reads.at(-1), 'D:\\Selected\\resources\\app.asar');
  assert.equal(page.elements.get('input-install-dir').value, 'D:\\Selected');
  assert.equal(page.elements.get('text-original-version').textContent, 'v2.24.0');
  assert.equal(page.elements.get('text-patch-version').textContent, 'v1.4.0');
  assert.equal(page.elements.get('btn-install-patch').disabled, false);
});

test('missing runtime build resources are shown before injection and disable the install action', async () => {
  const page = createPage({
    detectPaths: async () => ({ detected: true, installDir: 'C:\\Client', asarPath: 'C:\\Client\\resources\\app.asar' }),
    getAsarVersions: async () => ({ success: true, originalVersion: '2.24.0', patchVersion: '1.4.0', runtimeResourcesReady: false, warnings: ['汉化运行资源缺失：accountQuota.js'] }),
    getPatchBackupStatus: async () => ({ success: true })
  });
  await page.init();
  assert.equal(page.elements.get('btn-install-patch').disabled, true);
  assert.equal(page.elements.get('patch-compatibility-strip').dataset.state, 'warning');
  assert.match(page.elements.get('patch-compatibility-detail').textContent, /accountQuota.js/);
  assert.notEqual(page.elements.get('patch-compatibility-title').textContent, '兼容性预检通过');
});
