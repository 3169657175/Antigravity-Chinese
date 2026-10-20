const fs = 'electron' in process.versions ? require('original-fs') : require('fs');
const path = require('path');
const asar = require('@electron/asar');
const { withDetachedArchive } = require('./archiveReadIsolation');
const { PACKAGED_NAMES, resolvePatchWorkbenchResource } = require('./patchResourceResolver');

function readArchivePackage(archivePath, options = {}) {
  return withDetachedArchive(archivePath, snapshot => {
    const pkg = JSON.parse(asar.extractFile(snapshot, 'package.json').toString('utf8').replace(/^\uFEFF/, ''));
    const entries = new Set(asar.listPackage(snapshot).map(entry => entry.replace(/^[/\\]+/, '').replace(/\\/g, '/')));
    return { ...pkg, hasClientStructure: ['dist/main.js', 'dist/preload.js'].every(file => entries.has(file)) };
  }, options);
}

function getPatchVersionInfo(asarPath, sourceAsar, options = {}) {
  const io = options.fsModule || fs;
  const result = { success: true, originalVersion: 'unknown', patchVersion: 'unknown', clientStructureReady: false, runtimeResourcesReady: true, warnings: [] };
  // A bad or temporarily unavailable client must not hide the Hub patch version.
  try {
    const pkg = readArchivePackage(asarPath, options);
    if (pkg.name !== 'antigravity') throw new Error('所选文件不是 Antigravity 客户端');
    result.originalVersion = pkg.version || 'unknown';
    result.clientStructureReady = pkg.hasClientStructure;
  } catch (error) { result.warnings.push(`客户端版本读取失败：${error.message}`); }
  try {
    const manifestPath = path.join(path.dirname(sourceAsar), 'patch-manifest.json');
    if (io.existsSync(manifestPath)) {
      const manifest = JSON.parse(io.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
      result.patchVersion = manifest.pluginVersion || manifest.patchVersion || manifest.clientVersion || 'unknown';
    } else result.patchVersion = readArchivePackage(sourceAsar, options).version || 'unknown';
  } catch (error) { result.warnings.push(`补丁版本读取失败：${error.message}`); }
  for (const name of Object.keys(PACKAGED_NAMES)) {
    try { resolvePatchWorkbenchResource(name, options.resourceOptions); }
    catch (error) { result.runtimeResourcesReady = false; result.warnings.push(error.message); }
  }
  return result;
}

module.exports = { getPatchVersionInfo, readArchivePackage };
