const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { RELEASE_REPOSITORY, cleanVersion } = require('./releaseConfig.js');
const { PACKAGED_NAMES, resolvePatchWorkbenchResource } = require('./patchResourceResolver');

function fail(message) { throw new Error(`[release-guard] ${message}`); }
function readPackage() { return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')); }
function parseLatestYaml(text) {
  const version = /^version:\s*['"]?([^'"\r\n]+)['"]?/m.exec(text)?.[1]?.trim() || '';
  const pathValue = /^path:\s*['"]?([^'"\r\n]+)['"]?/m.exec(text)?.[1]?.trim() || '';
  return { version, path: pathValue };
}
function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function verify(options = {}) {
  const pkg = readPackage();
  const version = cleanVersion(pkg.version);
  if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`invalid semver: ${pkg.version}`);
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname, 'package-lock.json'), 'utf8'));
  if (cleanVersion(lock.version) !== version || cleanVersion(lock.packages?.['']?.version) !== version) fail('package-lock version differs from package.json');
  const publish = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : null;
  if (!publish || publish.provider !== 'github') fail('build.publish must use GitHub');
  if (publish.owner !== RELEASE_REPOSITORY.owner || publish.repo !== RELEASE_REPOSITORY.repo) fail('package publish repository differs from releaseConfig');
  const requiredFiles = ['releaseConfig.js','featureFlags.js','communityState.js','communityMedia.js','pageLifecycle.js','uiFeedback.js','errorDiagnostics.js','antigravityQuotaBridge.js','styles/community.css'];
  for (const file of requiredFiles) if (!pkg.build.files.includes(file)) fail(`missing packaged module: ${file}`);
  const patchManifestPath = path.join(__dirname, 'assets', 'patch-manifest.json');
  const patchArchivePath = path.join(__dirname, 'assets', 'app.asar');
  if (!fs.existsSync(patchManifestPath)) fail('assets/patch-manifest.json missing');
  if (!fs.existsSync(patchArchivePath)) fail('assets/app.asar missing');
  const patchManifest = JSON.parse(fs.readFileSync(patchManifestPath, 'utf8'));
  if (cleanVersion(patchManifest.patchVersion) !== version) fail(`patchVersion ${patchManifest.patchVersion} differs from package ${version}`);
  if (cleanVersion(patchManifest.pluginVersion) !== version) fail(`pluginVersion ${patchManifest.pluginVersion} differs from package ${version}`);
  const actualPatchSha256 = sha256(patchArchivePath);
  if (String(patchManifest.patchSha256 || '').toLowerCase() !== actualPatchSha256) fail('patchSha256 differs from assets/app.asar');
  if (options.expectedVersion && cleanVersion(options.expectedVersion) !== version) fail(`expected ${options.expectedVersion}, got ${version}`);
  if (options.artifacts) {
    const latestPath = path.join(__dirname, 'dist', 'latest.yml');
    if (!fs.existsSync(latestPath)) fail('dist/latest.yml missing');
    const latest = parseLatestYaml(fs.readFileSync(latestPath, 'utf8'));
    if (cleanVersion(latest.version) !== version) fail(`latest.yml version ${latest.version} differs from package ${version}`);
    const installer = path.join(__dirname, 'dist', latest.path || `agy-hub-setup-${version}.exe`);
    if (!fs.existsSync(installer)) fail(`installer missing: ${path.basename(installer)}`);
    if (!fs.existsSync(`${installer}.blockmap`)) fail(`blockmap missing: ${path.basename(installer)}.blockmap`);
    const resources = path.join(__dirname, 'dist', 'win-unpacked', 'resources');
    const asar = require('@electron/asar');
    if (!asar.extractFile(path.join(resources, 'app.asar'), 'accountQuota.js').equals(fs.readFileSync(path.join(__dirname, 'accountQuota.js')))) fail('Hub quota module missing or differs from source');
    if (!asar.extractFile(path.join(resources, 'app.asar'), 'antigravityQuotaBridge.js').equals(fs.readFileSync(path.join(__dirname, 'antigravityQuotaBridge.js')))) fail('Hub local quota bridge missing or differs from source');
    for (const [name, file] of Object.entries(PACKAGED_NAMES)) {
      const source = resolvePatchWorkbenchResource(name, { resourcesPath: '' });
      const built = path.join(resources, 'patch', file);
      if (!fs.existsSync(built)) fail(`missing external runtime build resource: patch/${file}`);
      if (sha256(source) !== sha256(built)) fail(`external runtime resource differs from source: ${file}`);
    }
    if (sha256(path.join(resources, 'patch', 'app.asar')) !== actualPatchSha256) fail('built patch differs from source patch');
  }
  return { version, repository: `${RELEASE_REPOSITORY.owner}/${RELEASE_REPOSITORY.repo}` };
}
if (require.main === module) {
  const result = verify({ artifacts: process.argv.includes('--artifacts'), expectedVersion: process.env.EXPECTED_RELEASE_VERSION || '' });
  console.log(`[release-guard] OK ${result.version} -> ${result.repository}`);
}
module.exports = { verify, parseLatestYaml, sha256 };
