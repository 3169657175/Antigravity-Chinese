const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const asar = require('@electron/asar');
const { inspectPatchArchive } = require('../src/patchWorker');

test('patch worker rejects the 2.17.0 broken tray before installing a prebuilt archive', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-tray-preflight-'));
  try {
    const dir = path.join(root, 'source');
    fs.mkdirSync(path.join(dir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ version: '2.17.0' }));
    fs.writeFileSync(path.join(dir, 'dist/tray.js'), 'exports.createTray = createTray; exports.insertTrayMenuItem = insertTrayMenuItem; exports.updateTrayAgentCount = updateTrayAgentCount; function createTray() {} function updateTrayAgentCount() {}');
    const archive = path.join(root, 'broken.asar');
    await asar.createPackage(dir, archive);
    assert.match(inspectPatchArchive(archive).syntaxErrors.join('\n'), /insertTrayMenuItem is not defined/);
    fs.writeFileSync(path.join(dir, 'dist/tray.js'), 'exports.createTray = createTray; exports.updateTrayAgentCount = updateTrayAgentCount; function createTray() {} function updateTrayAgentCount() {}');
    const missing = path.join(root, 'missing.asar');
    await asar.createPackage(dir, missing);
    assert.match(inspectPatchArchive(missing).syntaxErrors.join('\n'), /Missing official insertTrayMenuItem export/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

async function makeAsar(root, name, patched) {
  const source = path.join(root, `${name}-src`);
  fs.mkdirSync(path.join(source, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ version: '1.2.3', main: 'dist/main.js' }));
  fs.writeFileSync(path.join(source, 'dist', 'main.js'), 'module.exports = true;');
  fs.writeFileSync(path.join(source, 'dist', 'preload.js'), patched ? 'const AGYSupplementalTranslations = true;' : 'module.exports = true;');
  const archive = path.join(root, `${name}.asar`);
  await asar.createPackage(source, archive);
  return archive;
}

test('patch worker validates, installs and preserves the official original', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-worker-'));
  const resources = path.join(root, 'resources');
  const patchDir = path.join(root, 'patch');
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(patchDir, { recursive: true });
  const target = await makeAsar(root, 'official', false);
  const source = await makeAsar(root, 'patched', true);
  fs.renameSync(target, path.join(resources, 'app.asar'));
  fs.renameSync(source, path.join(patchDir, 'app.asar'));
  fs.mkdirSync(path.join(patchDir, 'app.asar.unpacked'), { recursive: true });
  fs.writeFileSync(path.join(patchDir, 'app.asar.unpacked', 'asset.txt'), 'asset');
  fs.writeFileSync(path.join(patchDir, 'patch-manifest.json'), JSON.stringify({
    clientVersion: '1.2.3',
    unpackedFiles: 1,
    requiredFiles: ['package.json', 'dist/main.js', 'dist/preload.js']
  }));

  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '..', 'src', 'patchWorker.js'), { workerData: {
      asarPath: path.join(resources, 'app.asar'),
      sourceAsar: path.join(patchDir, 'app.asar'),
      originalVersion: '1.2.3',
      statePath: path.join(root, 'state.json'),
      legacyHistoryPath: path.join(root, 'backups.json')
    }});
    worker.on('message', message => {
      if (message.type === 'validated') worker.postMessage({ type: 'continue' });
      if (['success', 'error', 'cancelled'].includes(message.type)) resolve(message);
    });
    worker.on('error', reject);
  });

  assert.equal(result.type, 'success');
  assert.equal(fs.existsSync(path.join(resources, 'app.asar.original')), true);
  assert.equal(fs.existsSync(path.join(resources, 'app.asar.unpacked', 'asset.txt')), true);
  fs.rmSync(root, { recursive: true, force: true });
});

test('patch worker cancellation before commit leaves the target archive unchanged', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-worker-cancel-'));
  const resources = path.join(root, 'resources');
  const patchDir = path.join(root, 'patch');
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(patchDir, { recursive: true });
  const target = await makeAsar(root, 'official-cancel', false);
  const source = await makeAsar(root, 'patched-cancel', true);
  const targetPath = path.join(resources, 'app.asar');
  fs.renameSync(target, targetPath);
  fs.renameSync(source, path.join(patchDir, 'app.asar'));
  fs.mkdirSync(path.join(patchDir, 'app.asar.unpacked'), { recursive: true });
  fs.writeFileSync(path.join(patchDir, 'app.asar.unpacked', 'asset.txt'), 'asset');
  fs.writeFileSync(path.join(patchDir, 'patch-manifest.json'), JSON.stringify({
    clientVersion: '1.2.3', unpackedFiles: 1, requiredFiles: ['package.json', 'dist/main.js', 'dist/preload.js']
  }));
  const before = fs.readFileSync(targetPath);

  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '..', 'src', 'patchWorker.js'), { workerData: {
      asarPath: targetPath,
      sourceAsar: path.join(patchDir, 'app.asar'),
      originalVersion: '1.2.3',
      statePath: path.join(root, 'state.json'),
      legacyHistoryPath: path.join(root, 'backups.json')
    }});
    worker.on('message', message => {
      if (message.type === 'validated') worker.postMessage({ type: 'cancel' });
      if (['success', 'error', 'cancelled'].includes(message.type)) resolve(message);
    });
    worker.on('error', reject);
  });

  assert.equal(result.type, 'cancelled');
  assert.deepEqual(fs.readFileSync(targetPath), before);
  fs.rmSync(root, { recursive: true, force: true });
});

test('format v2 preserves the official app.asar.unpacked directory', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-worker-v2-'));
  const resources = path.join(root, 'resources');
  const patchDir = path.join(root, 'patch');
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(patchDir, { recursive: true });
  const target = await makeAsar(root, 'official-v2', false);
  const source = await makeAsar(root, 'patched-v2', true);
  const targetPath = path.join(resources, 'app.asar');
  fs.renameSync(target, targetPath);
  fs.renameSync(source, path.join(patchDir, 'app.asar'));
  fs.mkdirSync(`${targetPath}.unpacked`, { recursive: true });
  fs.writeFileSync(path.join(`${targetPath}.unpacked`, 'official-native.txt'), 'keep-me');
  fs.writeFileSync(path.join(patchDir, 'patch-manifest.json'), JSON.stringify({
    formatVersion: 2,
    clientVersion: '1.2.3',
    unpackedMode: 'preserve-official',
    requiredCapabilities: ['package.json', 'dist/main.js', 'dist/preload.js']
  }));

  const result = await new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '..', 'src', 'patchWorker.js'), { workerData: {
      asarPath: targetPath,
      sourceAsar: path.join(patchDir, 'app.asar'),
      originalVersion: '1.2.3',
      statePath: path.join(root, 'state.json'),
      legacyHistoryPath: path.join(root, 'backups.json')
    }});
    worker.on('message', message => {
      if (message.type === 'validated') worker.postMessage({ type: 'continue' });
      if (['success', 'error', 'cancelled'].includes(message.type)) resolve(message);
    });
    worker.on('error', reject);
  });

  assert.equal(result.type, 'success');
  assert.equal(fs.readFileSync(path.join(`${targetPath}.unpacked`, 'official-native.txt'), 'utf8'), 'keep-me');
  assert.equal(fs.existsSync(path.join(patchDir, 'app.asar.unpacked')), false);
  fs.rmSync(root, { recursive: true, force: true });
});
