const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const asar = require('@electron/asar');
const { buildCompatibleTree, normalizeVersion } = require('../patch-workbench/compatibility');

const RUNTIME_TEMP_PREFIX = 'agy-runtime-patch-';
const RETRYABLE_REMOVE_CODES = new Set(['ENOTEMPTY', 'EBUSY', 'EPERM', 'EACCES']);

function waitSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function isSafeRuntimeTempDir(tempDir, tempRoot = os.tmpdir()) {
  const resolvedRoot = path.resolve(tempRoot);
  const resolvedDir = path.resolve(tempDir);
  return path.dirname(resolvedDir) === resolvedRoot
    && path.basename(resolvedDir).startsWith(RUNTIME_TEMP_PREFIX);
}

function removeRuntimeTempDir(tempDir, options = {}) {
  const fsModule = options.fsModule || fs;
  const tempRoot = options.tempRoot || os.tmpdir();
  const maxAttempts = Number.isInteger(options.maxAttempts) ? options.maxAttempts : 8;
  const retryDelay = Number.isInteger(options.retryDelay) ? options.retryDelay : 150;
  const wait = options.wait || waitSync;
  if (!isSafeRuntimeTempDir(tempDir, tempRoot)) {
    throw new Error(`Refusing to remove an unsafe runtime patch path: ${tempDir}`);
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      fsModule.rmSync(tempDir, {
        recursive: true,
        force: true,
        maxRetries: 2,
        retryDelay
      });
      return { removed: true, attempts: attempt, warning: '' };
    } catch (error) {
      if (!RETRYABLE_REMOVE_CODES.has(error.code) || attempt === maxAttempts) {
        return {
          removed: false,
          attempts: attempt,
          warning: `Runtime patch was built, but temporary directory cleanup failed (${error.code || 'UNKNOWN'}): ${tempDir}`
        };
      }
      wait(retryDelay * attempt);
    }
  }
  return { removed: false, attempts: maxAttempts, warning: `Temporary directory cleanup did not complete: ${tempDir}` };
}

function cleanupStaleRuntimeTempDirs(options = {}) {
  const fsModule = options.fsModule || fs;
  const tempRoot = options.tempRoot || os.tmpdir();
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const minimumAgeMs = Number.isFinite(options.minimumAgeMs) ? options.minimumAgeMs : 6 * 60 * 60 * 1000;
  const warnings = [];
  let entries = [];
  try {
    entries = fsModule.readdirSync(tempRoot, { withFileTypes: true });
  } catch (error) {
    return [`Unable to inspect stale runtime patch directories: ${error.message}`];
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith(RUNTIME_TEMP_PREFIX)) continue;
    const candidate = path.join(tempRoot, entry.name);
    try {
      const stat = fsModule.statSync(candidate);
      if (now - stat.mtimeMs < minimumAgeMs) continue;
      const result = removeRuntimeTempDir(candidate, { ...options, fsModule, tempRoot });
      if (result.warning) warnings.push(result.warning);
    } catch (error) {
      warnings.push(`Unable to clean stale runtime patch directory ${candidate}: ${error.message}`);
    }
  }
  return warnings;
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readArchiveMeta(archivePath) {
  const pkg = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8').replace(/^\uFEFF/, ''));
  return { name: pkg.name || '', version: normalizeVersion(pkg.version) };
}

function discoverUnpackPattern(archivePath) {
  const roots = new Set();
  for (const entry of asar.listPackage(archivePath)) {
    const normalized = String(entry).replace(/^[/\\]+/, '').replace(/\\/g, '/');
    if (!normalized) continue;
    try {
      const stat = asar.statFile(archivePath, normalized.replace(/\//g, path.sep));
      if (!stat.unpacked) continue;
      const parts = normalized.split('/');
      roots.add(parts.length > 1 ? parts.slice(0, 2).join('/') : normalized);
    } catch (_) {}
  }
  const patterns = [...roots].sort();
  if (patterns.length === 0) return '';
  return patterns.length === 1 ? patterns[0] : `{${patterns.join(',')}}`;
}

function resolveUnpackedSource(archivePath) {
  const candidates = [`${archivePath}.unpacked`];
  if (archivePath.endsWith('.original')) {
    candidates.push(`${archivePath.slice(0, -'.original'.length)}.unpacked.original`);
  }
  if (archivePath.endsWith('.previous')) {
    candidates.push(`${archivePath.slice(0, -'.previous'.length)}.unpacked.previous`);
  }
  return candidates.find(candidate => fs.existsSync(candidate)) || '';
}

async function buildPatchForTarget(options) {
  const { targetAsar, legacyPayloadAsar, runtimeRulesPath, outputAsar } = options;
  if (!fs.existsSync(targetAsar)) throw new Error('当前 Antigravity app.asar 不存在');
  if (!fs.existsSync(legacyPayloadAsar)) throw new Error('缺少 AGY 增量载荷');
  if (!fs.existsSync(runtimeRulesPath)) throw new Error('缺少 AGY 运行时规则');
  const targetMeta = readArchiveMeta(targetAsar);
  if (targetMeta.name !== 'antigravity') throw new Error(`目标文件不是 Antigravity：${targetMeta.name || 'unknown'}`);
  const cleanupWarnings = cleanupStaleRuntimeTempDirs();
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), RUNTIME_TEMP_PREFIX));
  const officialDir = path.join(tempRoot, 'official');
  const legacyDir = path.join(tempRoot, 'legacy');
  const builtPath = path.join(tempRoot, 'app.asar');
  let result;
  let buildError = null;
  try {
    fs.mkdirSync(officialDir, { recursive: true });
    fs.mkdirSync(legacyDir, { recursive: true });
    let extractionAsar = targetAsar;
    const unpackPattern = discoverUnpackPattern(targetAsar);
    const unpackedSource = unpackPattern ? resolveUnpackedSource(targetAsar) : '';
    if (unpackPattern && unpackedSource !== `${targetAsar}.unpacked`) {
      if (!unpackedSource) throw new Error(`Official unpacked dependency is missing for ${targetAsar}`);
      const extractionRoot = path.join(tempRoot, 'source');
      fs.mkdirSync(extractionRoot, { recursive: true });
      extractionAsar = path.join(extractionRoot, 'app.asar');
      fs.copyFileSync(targetAsar, extractionAsar);
      fs.cpSync(unpackedSource, `${extractionAsar}.unpacked`, { recursive: true });
    }
    asar.extractAll(extractionAsar, officialDir);
    asar.extractAll(legacyPayloadAsar, legacyDir);
    const runtimeRules = JSON.parse(fs.readFileSync(runtimeRulesPath, 'utf8').replace(/^\uFEFF/, ''));
    const compatibility = buildCompatibleTree({ officialDir, legacyDir, runtimeRules });
    if (unpackPattern) {
      await asar.createPackageWithOptions(officialDir, builtPath, { unpackDir: unpackPattern });
    } else {
      await asar.createPackage(officialDir, builtPath);
    }
    fs.copyFileSync(builtPath, outputAsar);
    result = {
      clientVersion: targetMeta.version,
      officialSha256: hashFile(targetAsar),
      patchSha256: hashFile(outputAsar),
      compatibility,
      unpackPattern,
      cleanupWarnings
    };
  } catch (error) {
    buildError = error;
  } finally {
    const cleanupResult = removeRuntimeTempDir(tempRoot);
    if (cleanupResult.warning) cleanupWarnings.push(cleanupResult.warning);
  }
  if (buildError) {
    buildError.cleanupWarnings = cleanupWarnings;
    throw buildError;
  }
  return result;
}

module.exports = {
  buildPatchForTarget,
  readArchiveMeta,
  hashFile,
  discoverUnpackPattern,
  resolveUnpackedSource,
  isSafeRuntimeTempDir,
  removeRuntimeTempDir,
  cleanupStaleRuntimeTempDirs
};
