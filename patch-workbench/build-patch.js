const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const asar = require('@electron/asar');
const { normalizeVersion } = require('./compatibility');
const { buildPatchForTarget } = require('../src/patchRuntimeBuilder');

const workbenchDir = __dirname;
const root = path.resolve(workbenchDir, '..');
const assetsDir = path.join(root, 'assets');
const outputAsar = path.join(assetsDir, 'app.asar');
const manifestPath = path.join(assetsDir, 'patch-manifest.json');
const reportPath = path.join(workbenchDir, 'last-build-report.json');
const legacyPayloadAsar = path.join(workbenchDir, 'legacy-payload.asar');
const runtimeRulesPath = path.join(workbenchDir, 'runtime-rules.json');

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function findOfficialAsar() {
  const explicit = process.env.ANTIGRAVITY_OFFICIAL_ASAR || process.argv[2];
  const baseInstalled = path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity', 'resources', 'app.asar');
  const candidates = [
    explicit,
    fs.existsSync(`${baseInstalled}.original`) ? `${baseInstalled}.original` : '',
    baseInstalled
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate)) || '';
}

function readPackageVersion(archivePath) {
  const pkg = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8').replace(/^\uFEFF/, ''));
  return { name: pkg.name || '', version: normalizeVersion(pkg.version) };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const officialAsar = findOfficialAsar();
  if (!officialAsar) throw new Error('未找到当前 Antigravity 官方 app.asar。可通过 ANTIGRAVITY_OFFICIAL_ASAR 指定。');
  if (!fs.existsSync(legacyPayloadAsar)) {
    throw new Error(`缺少稳定增量载荷：${legacyPayloadAsar}`);
  }
  const officialMeta = readPackageVersion(officialAsar);
  if (officialMeta.name !== 'antigravity') throw new Error(`目标 ASAR 不是 Antigravity：${officialMeta.name || 'unknown'}`);

  const runtimeBuild = await buildPatchForTarget({
    targetAsar: officialAsar,
    legacyPayloadAsar,
    runtimeRulesPath,
    outputAsar
  });
  const requiredCapabilities = [
      'package.json',
      'dist/languageServer.js',
      'dist/preload.js',
      'dist/main.js',
      'dist/tray.js',
      'dist/utils.js',
      'dist/ipcHandlers.js'
    ];
  const manifest = {
      formatVersion: 2,
      clientVersion: officialMeta.version,
      supportedClientRange: '>=2.4.3 <3.0.0',
      patchVersion: require(path.join(root, 'package.json')).version,
      pluginVersion: require(path.join(root, 'package.json')).version,
      buildStrategy: 'official-baseline-with-declarative-overlay',
      unpackedMode: 'preserve-official',
      requiredCapabilities,
      optionalCapabilities: ['dist/accountVault.js'],
      officialSha256: sha256(officialAsar),
      patchSha256: sha256(outputAsar),
      builtAt: new Date().toISOString()
  };
  writeJson(manifestPath, manifest);
  const report = {
      ok: true,
      officialAsar,
      officialVersion: officialMeta.version,
      officialSha256: manifest.officialSha256,
      outputAsar,
      outputSize: fs.statSync(outputAsar).size,
      outputSha256: manifest.patchSha256,
      compatibility: runtimeBuild.compatibility,
      unpackPattern: runtimeBuild.unpackPattern
  };
  writeJson(reportPath, report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  writeJson(reportPath, { ok: false, builtAt: new Date().toISOString(), error: error.message });
  console.error(error);
  process.exitCode = 1;
});
