// Exercise the shipped Hub ASAR/Worker, never the source-tree implementation.
const path = require('path');
const root = path.resolve(__dirname, '../..');
const childMode = process.argv.includes('--electron-child');
if (!childMode) {
  const { spawnSync } = require('child_process');
  const result = spawnSync(path.join(root, 'dist/win-unpacked/AGY Hub 桌面管家.exe'), [__filename, '--electron-child'], {
    windowsHide: true, stdio: 'inherit', timeout: 180000,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
  });
  if (result.error) console.error(result.error.message);
  process.exit(result.status === null ? 1 : result.status);
}

const fs = require('original-fs');
const wrappedFs = require('fs');
const assert = require('assert/strict');
const crypto = require('crypto');
const asar = require('@electron/asar');
const { Worker } = require('worker_threads');
const resources = path.join(path.dirname(process.execPath), 'resources');
const hubArchive = path.join(resources, 'app.asar');
assert.equal(typeof require(path.join(hubArchive, 'accountIpc.js')).registerAccountIpc, 'function');
const { getPatchVersionInfo } = require(path.join(hubArchive, 'patchVersionInfo.js'));
const { resolveUnpackedSource, discoverUnpackPattern } = require(path.join(hubArchive, 'patchRuntimeBuilder.js'));
const pkg = require(path.join(root, 'package.json'));
const work = fs.mkdtempSync(path.join(root, '.codex-stage', 'packaged-patch-'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report = { version: pkg.version, work, cases: [], ok: false };

async function runWorker(target, directory) {
  return new Promise((resolve, reject) => {
    const messages = [];
    const worker = new Worker(path.join(hubArchive, 'patchWorker.js'), { workerData: {
      asarPath: target, sourceAsar: path.join(resources, 'patch/app.asar'),
      statePath: path.join(directory, 'state.json'), legacyHistoryPath: path.join(directory, 'history.json')
    } });
    const timer = setTimeout(() => { worker.terminate(); reject(new Error('Packaged Worker timed out')); }, 45000);
    let final;
    worker.on('message', message => {
      messages.push(message);
      if (message.type === 'validated') worker.postMessage({ type: 'continue' });
      if (['success', 'error', 'cancelled'].includes(message.type)) final = message;
    });
    worker.on('error', error => { clearTimeout(timer); reject(error); });
    worker.on('exit', code => {
      clearTimeout(timer);
      final ? resolve({ ...final, messages }) : reject(new Error(`Worker exited without a result (${code})`));
    });
  });
}

async function makeClient(name, official, version, { crlf = false, changed = false, broken = false } = {}) {
  const directory = path.join(work, name);
  const clientResources = path.join(directory, 'resources');
  fs.mkdirSync(clientResources, { recursive: true });
  const target = path.join(clientResources, 'app.asar');
  const unpacked = resolveUnpackedSource(official);
  if (unpacked) fs.cpSync(unpacked, `${target}.unpacked`, { recursive: true });
  fs.copyFileSync(official, target);
  if (version || changed || broken) {
    const tree = path.join(directory, 'official-tree');
    // Backups store dependencies as app.asar.unpacked.original. Extract the
    // isolated canonical copy, whose unpacked directory was resolved above.
    asar.extractAll(target, tree);
    asar.uncache(target);
    const packagePath = path.join(tree, 'package.json');
    const metadata = JSON.parse(fs.readFileSync(packagePath));
    if (version) metadata.version = version;
    fs.writeFileSync(packagePath, JSON.stringify(metadata));
    if (crlf) {
      for (const name of ['main', 'preload', 'tray', 'utils', 'ipcHandlers', 'languageServer']) {
        const file = path.join(tree, 'dist', `${name}.js`);
        fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n').replace(/\n/g, '\r\n'));
      }
    }
    if (changed) fs.writeFileSync(path.join(tree, 'new-official-capability.txt'), 'preserve this newer official file');
    if (broken) fs.unlinkSync(path.join(tree, 'dist/ipcHandlers.js'));
    const unpackDir = discoverUnpackPattern(official);
    await asar.createPackageWithOptions(tree, target, unpackDir ? { unpackDir } : {});
  }
  fs.mkdirSync(`${target}.unpacked`, { recursive: true });
  fs.writeFileSync(path.join(`${target}.unpacked`, 'keep-official-dependency.txt'), name);
  return { directory, target };
}

function assertInjected(target, expectedVersion, marker) {
  const quota = asar.extractFile(target, 'dist/accountQuota.js');
  assert.deepEqual(quota, fs.readFileSync(path.join(resources, 'patch/accountQuota.js')));
  const quotaCache = asar.extractFile(target, 'dist/accountQuotaCache.js');
  assert.deepEqual(quotaCache, fs.readFileSync(path.join(resources, 'patch/accountQuotaCache.js')));
  assert.ok(asar.extractFile(target, 'dist/ipcHandlers.js').toString().includes('require("./accountQuota").fetchAccountQuota'));
  assert.equal(fs.readFileSync(path.join(`${target}.unpacked`, 'keep-official-dependency.txt'), 'utf8'), marker);
  const version = getPatchVersionInfo(target, path.join(resources, 'patch/app.asar'));
  assert.equal(version.originalVersion, expectedVersion);
  assert.equal(version.patchVersion, pkg.version);
  assert.equal(version.runtimeResourcesReady, true);
  assert.equal(fs.existsSync(`${target}.original`), true);
}

async function main() {
  const build = JSON.parse(fs.readFileSync(path.join(root, 'patch-workbench/last-build-report.json')));
  const official = process.env.ANTIGRAVITY_OFFICIAL_ASAR || build.officialAsar;
  assert.ok(fs.existsSync(official), 'The verified official baseline must be available for the packaged smoke test');
  const officialHash = hash(official);
  const manifest = JSON.parse(fs.readFileSync(path.join(resources, 'patch/patch-manifest.json')));
  const version = JSON.parse(asar.extractFile(official, 'package.json')).version;

  const current = await makeClient('current-official', official);
  // Warm Electron's native ASAR cache before the Worker replaces this file.
  wrappedFs.readFileSync(path.join(current.target, 'package.json'), 'utf8');
  const first = await runWorker(current.target, current.directory);
  assert.equal(first.type, 'success', first.message);
  assert.equal(first.dynamicallyBuilt, officialHash !== manifest.officialSha256);
  assertInjected(current.target, version, 'current-official');
  report.cases.push({ name: 'current official client + immediate version refresh', clientVersion: version });

  const futureVersion = `${version.split('.')[0]}.${Number(version.split('.')[1]) + 1}.0`;
  const future = await makeClient('future-structure-fixture', official, futureVersion, { crlf: true });
  const futureResult = await runWorker(future.target, future.directory);
  assert.equal(futureResult.type, 'success', futureResult.message);
  assert.equal(futureResult.dynamicallyBuilt, true);
  assertInjected(future.target, futureVersion, 'future-structure-fixture');
  report.cases.push({ name: 'unlisted version and CRLF fixture runtime rebuild', syntheticVersion: futureVersion });
  const officialBackupHash = hash(`${future.target}.original`);
  const repeat = await runWorker(future.target, future.directory);
  assert.equal(repeat.type, 'success', repeat.message);
  assert.equal(repeat.dynamicallyBuilt, true);
  assert.equal(hash(`${future.target}.original`), officialBackupHash);
  assert.equal(fs.existsSync(`${future.target}.previous`), true);
  assertInjected(future.target, futureVersion, 'future-structure-fixture');
  report.cases.push({ name: 'repeat injection from matching official backup' });

  const changed = await makeClient('same-version-rebuilt-official', official, version, { changed: true });
  const changedResult = await runWorker(changed.target, changed.directory);
  assert.equal(changedResult.type, 'success', changedResult.message);
  assert.equal(changedResult.dynamicallyBuilt, true);
  assertInjected(changed.target, version, 'same-version-rebuilt-official');
  assert.equal(asar.extractFile(changed.target, 'new-official-capability.txt').toString(), 'preserve this newer official file');
  report.cases.push({ name: 'same version with different official bytes rebuilds without downgrading' });

  const broken = await makeClient('unsupported-structure-fixture', official, futureVersion, { broken: true });
  const before = hash(broken.target);
  const rejected = await runWorker(broken.target, broken.directory);
  assert.equal(rejected.type, 'error');
  assert.equal(rejected.messages.some(message => message.type === 'validated'), false);
  assert.equal(hash(broken.target), before);
  assert.equal(fs.existsSync(`${broken.target}.original`), false);
  report.cases.push({ name: 'unsupported structure rejected before client shutdown or writes' });
  assert.equal(hash(official), officialHash);
  report.officialVersion = version;
  report.officialSha256 = officialHash;
  report.liveOfficialUnchanged = true;
  report.injectedQuotaArchive = future.target;
  report.ok = true;
}
main().catch(error => { report.error = error.stack; process.exitCode = 1; }).finally(() => {
  fs.writeFileSync(path.join(work, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(root, '.codex-stage/packaged-patch-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
});
