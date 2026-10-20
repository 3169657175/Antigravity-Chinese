const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const asar = require('@electron/asar');
const { getPatchVersionInfo } = require('../../patchVersionInfo');
const { planPatchBuild, hashFile } = require('../../patchRuntimeBuilder');
const { inspectPatchArchive } = require('../../patchWorker');
const { resolvePatchWorkbenchResource, readPatchWorkbenchResource } = require('../../patchResourceResolver');

async function archive(root, version, { patched = false, padding = '', ipc = '' } = {}) {
  const source = fs.mkdtempSync(path.join(root, 'source-'));
  fs.mkdirSync(path.join(source, 'dist'));
  fs.writeFileSync(path.join(source, 'package.json'), JSON.stringify({ name: 'antigravity', version }));
  fs.writeFileSync(path.join(source, 'dist/main.js'), 'module.exports = true;');
  fs.writeFileSync(path.join(source, 'dist/preload.js'), patched ? 'const AGYSupplementalTranslations = true;' : 'module.exports = true;');
  if (padding) fs.writeFileSync(path.join(source, 'a-padding.txt'), padding);
  if (ipc) fs.writeFileSync(path.join(source, 'dist/ipcHandlers.js'), ipc);
  const output = `${source}.asar`;
  await asar.createPackage(source, output);
  return output;
}

test('version refresh immediately reads replaced archives and keeps patch metadata independent', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-version-refresh-'));
  try {
    const target = path.join(root, 'app.asar');
    const old = await archive(root, '2.22.0');
    fs.copyFileSync(old, target);
    asar.extractFile(target, 'package.json'); // Warm the cache for the old archive.
    const next = await archive(root, '2.24.0', { padding: 'new layout'.repeat(100) });
    fs.copyFileSync(next, target);
    const patch = path.join(root, 'patch/app.asar');
    fs.mkdirSync(path.dirname(patch));
    fs.writeFileSync(path.join(path.dirname(patch), 'patch-manifest.json'), JSON.stringify({ pluginVersion: '1.4.0' }));
    const result = getPatchVersionInfo(target, patch, { tempRoot: root });
    assert.equal(result.originalVersion, '2.24.0');
    assert.equal(result.patchVersion, '1.4.0');
    assert.equal(result.clientStructureReady, true);
    const missing = getPatchVersionInfo(path.join(root, 'absent.asar'), patch, { tempRoot: root });
    assert.equal(missing.originalVersion, 'unknown');
    assert.equal(missing.patchVersion, '1.4.0');
    assert.match(missing.warnings[0], /客户端版本读取失败/);
    assert.equal(fs.readdirSync(root).some(name => name.startsWith('agy-snapshot-')), false);
  } finally { asar.uncacheAll(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('runtime quota source resolves outside the Hub ASAR with physical file access', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-quota-resource-'));
  try {
    const options = { resourcesPath: root, workbenchDir: path.join(root, 'app.asar', 'patch-workbench') };
    fs.mkdirSync(path.join(root, 'patch'));
    const expected = fs.readFileSync(path.join(__dirname, '../../accountQuota.js'), 'utf8');
    fs.writeFileSync(path.join(root, 'patch/accountQuota.js'), expected);
    assert.equal(resolvePatchWorkbenchResource('accountQuota.js', options), path.join(root, 'patch/accountQuota.js'));
    assert.equal(readPatchWorkbenchResource('accountQuota.js', options), expected);
    fs.unlinkSync(path.join(root, 'patch/accountQuota.js'));
    assert.throws(() => readPatchWorkbenchResource('accountQuota.js', options), /汉化运行资源缺失：accountQuota.js/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('build planning checks official bytes and reuses only a same-version unpatched backup', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-build-plan-'));
  try {
    const official = await archive(root, '2.24.0');
    const inspection = inspectPatchArchive(official);
    const manifest = { clientVersion: '2.24.0', officialSha256: hashFile(official) };
    assert.equal(planPatchBuild(official, inspection, manifest).dynamicallyBuild, false);
    assert.equal(planPatchBuild(official, inspection, { ...manifest, officialSha256: 'changed official build' }).dynamicallyBuild, true);
    const patched = await archive(root, '2.25.0', { patched: true });
    const patchedInspection = inspectPatchArchive(patched);
    assert.throws(() => planPatchBuild(patched, patchedInspection, manifest), /缺少同版本官方原版备份/);
    fs.copyFileSync(official, `${patched}.original`);
    assert.throws(() => planPatchBuild(patched, patchedInspection, manifest), /不匹配/);
    fs.copyFileSync(await archive(root, '2.25.0'), `${patched}.original`);
    const plan = planPatchBuild(patched, patchedInspection, manifest);
    assert.equal(plan.officialAsar, `${patched}.original`);
    assert.equal(plan.dynamicallyBuild, true);
  } finally { asar.uncacheAll(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('patch inspection rejects a referenced quota helper that was omitted from the archive', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-quota-capability-'));
  try {
    const file = await archive(root, '2.24.0', { ipc: 'const quota = require("./accountQuota");' });
    assert.deepEqual(inspectPatchArchive(file).missingFiles, ['dist/accountQuota.js']);
  } finally { asar.uncacheAll(); fs.rmSync(root, { recursive: true, force: true }); }
});
