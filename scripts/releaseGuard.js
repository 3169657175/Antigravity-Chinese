const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { RELEASE_REPOSITORY, cleanVersion } = require('../src/releaseConfig.js');

function fail(message) { throw new Error(`[release-guard] ${message}`); }
function rootPath(...parts) { return path.join(__dirname, '..', ...parts); }
function readPackage() { return JSON.parse(fs.readFileSync(rootPath('package.json'), 'utf8')); }
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
  const lock = JSON.parse(fs.readFileSync(rootPath('package-lock.json'), 'utf8'));
  if (cleanVersion(lock.version) !== version || cleanVersion(lock.packages?.['']?.version) !== version) fail('package-lock version differs from package.json');
  const publish = Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : null;
  if (!publish || publish.provider !== 'github') fail('build.publish must use GitHub');
  if (publish.owner !== RELEASE_REPOSITORY.owner || publish.repo !== RELEASE_REPOSITORY.repo) fail('package publish repository differs from releaseConfig');
  if (!pkg.build.files.includes('src/**/*.js')) fail('organized public build must package src/**/*.js');
  const patchManifestPath = rootPath('assets', 'patch-manifest.json');
  const patchArchivePath = rootPath('assets', 'app.asar');
  if (!fs.existsSync(patchManifestPath)) fail('assets/patch-manifest.json missing');
  if (!fs.existsSync(patchArchivePath)) fail('assets/app.asar missing');
  const patchManifest = JSON.parse(fs.readFileSync(patchManifestPath, 'utf8'));
  if (cleanVersion(patchManifest.patchVersion) !== version) fail(`patchVersion ${patchManifest.patchVersion} differs from package ${version}`);
  if (cleanVersion(patchManifest.pluginVersion) !== version) fail(`pluginVersion ${patchManifest.pluginVersion} differs from package ${version}`);
  if (String(patchManifest.patchSha256 || '').toLowerCase() !== sha256(patchArchivePath)) fail('patchSha256 differs from assets/app.asar');
  if (options.expectedVersion && cleanVersion(options.expectedVersion) !== version) fail(`expected ${options.expectedVersion}, got ${version}`);
  if (options.artifacts) {
    const latestPath = rootPath('dist', 'latest.yml');
    if (!fs.existsSync(latestPath)) fail('dist/latest.yml missing');
    const latest = parseLatestYaml(fs.readFileSync(latestPath, 'utf8'));
    if (cleanVersion(latest.version) !== version) fail(`latest.yml version ${latest.version} differs from package ${version}`);
    const installer = rootPath('dist', latest.path || `agy-hub-setup-${version}.exe`);
    if (!fs.existsSync(installer)) fail(`installer missing: ${path.basename(installer)}`);
    if (!fs.existsSync(`${installer}.blockmap`)) fail(`blockmap missing: ${path.basename(installer)}.blockmap`);
  }
  return { version, repository: `${RELEASE_REPOSITORY.owner}/${RELEASE_REPOSITORY.repo}` };
}
if (require.main === module) {
  const result = verify({ artifacts: process.argv.includes('--artifacts'), expectedVersion: process.env.EXPECTED_RELEASE_VERSION || '' });
  console.log(`[release-guard] OK ${result.version} -> ${result.repository}`);
}
module.exports = { verify, parseLatestYaml, sha256 };
