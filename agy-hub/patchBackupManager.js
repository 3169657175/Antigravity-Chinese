const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const asar = require('@electron/asar');

const STATE_VERSION = 2;
const PATCH_MARKERS = [
  'AGYCustomThemeLibraryBridge',
  'AGYSupplementalTranslations',
  'AGYTranslationAuditQualityLayer',
  '__agyAuditEnhanced'
];

function normalizeVersion(value) {
  return String(value || '').trim().replace(/^v/i, '') || 'unknown';
}

function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
    return hash.digest('hex');
  } finally {
    fs.closeSync(fd);
  }
}

function inspectArchive(filePath) {
  try {
    const entries = new Set(asar.listPackage(filePath).map(entry => String(entry).replace(/^[/\\]+/, '').replace(/\\/g, '/')));
    let version = 'unknown';
    if (entries.has('package.json')) {
      const pkg = JSON.parse(asar.extractFile(filePath, 'package.json').toString('utf8').replace(/^\uFEFF/, ''));
      version = normalizeVersion(pkg.version);
    }
    const preload = entries.has('dist/preload.js')
      ? asar.extractFile(filePath, 'dist/preload.js').toString('utf8')
      : '';
    return { valid: true, patched: PATCH_MARKERS.some(marker => preload.includes(marker)), version };
  } catch (error) {
    return { valid: false, patched: false, version: 'unknown', error: error.message };
  }
}

function backupPaths(asarPath) {
  return {
    originalAsar: `${asarPath}.original`,
    originalUnpacked: `${asarPath}.unpacked.original`,
    previousAsar: `${asarPath}.previous`,
    previousUnpacked: `${asarPath}.unpacked.previous`,
    targetUnpacked: `${asarPath}.unpacked`,
    legacyAsar: `${asarPath}.backup`
  };
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')); } catch (_) { return fallback; }
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function copyFileVerified(source, destination) {
  const tempPath = `${destination}.tmp-${process.pid}-${Date.now()}`;
  fs.copyFileSync(source, tempPath);
  if (hashFile(tempPath) !== hashFile(source)) {
    fs.rmSync(tempPath, { force: true });
    throw new Error(`备份文件校验失败：${path.basename(destination)}`);
  }
  fs.copyFileSync(tempPath, destination);
  fs.rmSync(tempPath, { force: true });
}

function defaultReplaceDirectory(sourceDir, targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

class PatchBackupManager {
  constructor(options = {}) {
    this.statePath = options.statePath;
    this.legacyHistoryPath = options.legacyHistoryPath;
    this.inspectArchive = options.inspectArchive || inspectArchive;
    this.replaceDirectory = options.replaceDirectory || defaultReplaceDirectory;
  }

  readState() {
    const state = readJson(this.statePath, { version: STATE_VERSION, currentClientVersion: '', clients: {} });
    if (!state.clients || typeof state.clients !== 'object') state.clients = {};
    if (typeof state.currentClientVersion !== 'string') state.currentClientVersion = '';
    return state;
  }

  writeState(state) {
    state.version = STATE_VERSION;
    if (!state.clients || typeof state.clients !== 'object') state.clients = {};
    writeJsonAtomic(this.statePath, state);
  }

  clientState(state, clientVersion) {
    const version = normalizeVersion(clientVersion);
    const existing = state.clients && state.clients[version];
    const previousVersion = state.currentClientVersion;
    const previousKeys = Object.keys(state.clients || {});
    // Only the currently installed Antigravity version may remain in state.
    // This also migrates v1/legacy state files that had no currentClientVersion
    // but accumulated entries for several historical client versions.
    state.clients = existing ? { [version]: existing } : {};
    state.currentClientVersion = version;
    if (!state.clients[version]) state.clients[version] = { original: null, previous: null };
    if (previousVersion !== version || previousKeys.length !== 1 || previousKeys[0] !== version) {
      this.writeState(state);
    }
    return state.clients[version];
  }

  resetForClientVersion(state, clientVersion) {
    const version = normalizeVersion(clientVersion);
    state.currentClientVersion = version;
    state.clients = { [version]: { original: null, previous: null } };
    return state.clients[version];
  }

  saveSlot(kind, sourceAsar, sourceUnpacked, asarPath, clientVersion, source = 'current') {
    const paths = backupPaths(asarPath);
    const targetAsar = kind === 'original' ? paths.originalAsar : paths.previousAsar;
    const targetUnpacked = kind === 'original' ? paths.originalUnpacked : paths.previousUnpacked;
    const hadUnpacked = Boolean(sourceUnpacked && fs.existsSync(sourceUnpacked));
    copyFileVerified(sourceAsar, targetAsar);
    if (hadUnpacked) this.replaceDirectory(sourceUnpacked, targetUnpacked);
    else fs.rmSync(targetUnpacked, { recursive: true, force: true });

    const state = this.readState();
    const client = this.clientState(state, clientVersion);
    client[kind] = {
      asarPath: targetAsar,
      unpackedPath: targetUnpacked,
      hadUnpacked,
      sha256: hashFile(targetAsar),
      savedAt: new Date().toISOString(),
      source
    };
    this.writeState(state);
    return client[kind];
  }

  findOriginalCandidate(asarPath, clientVersion) {
    const paths = backupPaths(asarPath);
    const wantedVersion = normalizeVersion(clientVersion);
    const history = readJson(this.legacyHistoryPath, []);
    const entries = Array.isArray(history) ? [...history].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0)) : [];
    for (const entry of entries) {
      if (!entry || !entry.fullPath || !fs.existsSync(entry.fullPath)) continue;
      const inspection = this.inspectArchive(entry.fullPath);
      if (!inspection.valid || inspection.patched) continue;
      if (wantedVersion !== 'unknown' && inspection.version !== 'unknown' && inspection.version !== wantedVersion) continue;
      return {
        asarPath: entry.fullPath,
        unpackedPath: entry.hadUnpacked ? entry.unpackedBackupPath : null,
        source: 'legacy-history'
      };
    }
    if (fs.existsSync(paths.legacyAsar) && !fs.existsSync(paths.targetUnpacked)) {
      const inspection = this.inspectArchive(paths.legacyAsar);
      if (inspection.valid && !inspection.patched && (wantedVersion === 'unknown' || inspection.version === 'unknown' || inspection.version === wantedVersion)) {
        return { asarPath: paths.legacyAsar, unpackedPath: null, source: 'legacy-single-backup' };
      }
    }
    const currentInspection = this.inspectArchive(asarPath);
    if (currentInspection.valid && !currentInspection.patched) {
      return { asarPath, unpackedPath: paths.targetUnpacked, source: 'current-official' };
    }
    return null;
  }

  ensureOriginal(asarPath, clientVersion) {
    const paths = backupPaths(asarPath);
    const wantedVersion = normalizeVersion(clientVersion);
    const state = this.readState();
    const client = this.clientState(state, clientVersion);
    if (fs.existsSync(paths.originalAsar)) {
      const originalInspection = this.inspectArchive(paths.originalAsar);
      const versionMatches = wantedVersion === 'unknown'
        || originalInspection.version === 'unknown'
        || originalInspection.version === wantedVersion;
      if (originalInspection.valid && !originalInspection.patched && versionMatches) {
        if (!client.original) {
          client.original = {
            asarPath: paths.originalAsar,
            unpackedPath: paths.originalUnpacked,
            hadUnpacked: fs.existsSync(paths.originalUnpacked),
            sha256: hashFile(paths.originalAsar),
            savedAt: new Date().toISOString(),
            source: 'existing-original'
          };
          this.writeState(state);
        }
        return client.original;
      }

      const currentInspection = this.inspectArchive(asarPath);
      const currentMatches = wantedVersion === 'unknown'
        || currentInspection.version === 'unknown'
        || currentInspection.version === wantedVersion;
      if (currentInspection.valid && !currentInspection.patched && currentMatches) {
        this.resetForClientVersion(state, clientVersion);
        this.writeState(state);
        fs.rmSync(paths.originalAsar, { force: true });
        fs.rmSync(paths.originalUnpacked, { recursive: true, force: true });
        fs.rmSync(paths.previousAsar, { force: true });
        fs.rmSync(paths.previousUnpacked, { recursive: true, force: true });
        return this.saveSlot('original', asarPath, paths.targetUnpacked, asarPath, clientVersion, 'new-client-official');
      }
      throw new Error(`现有官方原版备份与当前客户端 v${wantedVersion} 不匹配，且当前 app.asar 已汉化。请先安装对应版本的官方客户端。`);
    }
    const candidate = this.findOriginalCandidate(asarPath, clientVersion);
    if (!candidate) {
      throw new Error('当前客户端已经汉化，但没有找到可信的官方英文原版备份。为避免把汉化版误存为原版，已取消注入。');
    }
    return this.saveSlot('original', candidate.asarPath, candidate.unpackedPath, asarPath, clientVersion, candidate.source);
  }

  createInstallSnapshot(asarPath) {
    const paths = backupPaths(asarPath);
    const stamp = `${process.pid}-${Date.now()}`;
    const snapshotAsar = `${asarPath}.install-rollback-${stamp}`;
    const snapshotUnpacked = `${asarPath}.unpacked.install-rollback-${stamp}`;
    copyFileVerified(asarPath, snapshotAsar);
    const hadUnpacked = fs.existsSync(paths.targetUnpacked);
    if (hadUnpacked) this.replaceDirectory(paths.targetUnpacked, snapshotUnpacked);
    return { asarPath: snapshotAsar, unpackedPath: snapshotUnpacked, hadUnpacked };
  }

  beginInstall(asarPath, clientVersion) {
    const paths = backupPaths(asarPath);
    const inspection = this.inspectArchive(asarPath);
    if (!inspection.valid) throw new Error(`无法识别当前 app.asar：${inspection.error || '文件无效'}`);
    const original = this.ensureOriginal(asarPath, clientVersion);
    let previous = null;
    if (inspection.patched) {
      previous = this.saveSlot('previous', asarPath, paths.targetUnpacked, asarPath, clientVersion, 'current-patched');
    }
    const rollback = this.createInstallSnapshot(asarPath);
    return { asarPath, clientVersion: normalizeVersion(clientVersion), original, previous, rollback, currentWasPatched: inspection.patched };
  }

  ensurePreviousEntry(asarPath, clientVersion) {
    const paths = backupPaths(asarPath);
    if (!fs.existsSync(paths.previousAsar)) return null;
    const version = normalizeVersion(clientVersion);
    const inspection = this.inspectArchive(paths.previousAsar);
    const versionMatches = version === 'unknown' || inspection.version === 'unknown' || inspection.version === version;
    if (!inspection.valid || !inspection.patched || !versionMatches) return null;
    const state = this.readState();
    const client = this.clientState(state, clientVersion);
    if (!client.previous) {
      client.previous = {
        asarPath: paths.previousAsar,
        unpackedPath: paths.previousUnpacked,
        hadUnpacked: fs.existsSync(paths.previousUnpacked),
        sha256: hashFile(paths.previousAsar),
        savedAt: new Date().toISOString(),
        source: 'existing-previous'
      };
      this.writeState(state);
    }
    return client.previous;
  }

  finishInstall(transaction, success) {
    if (!transaction || !transaction.rollback) return;
    const paths = backupPaths(transaction.asarPath);
    const rollback = transaction.rollback;
    if (!success) {
      copyFileVerified(rollback.asarPath, transaction.asarPath);
      if (rollback.hadUnpacked) this.replaceDirectory(rollback.unpackedPath, paths.targetUnpacked);
      else fs.rmSync(paths.targetUnpacked, { recursive: true, force: true });
    }
    fs.rmSync(rollback.asarPath, { force: true });
    fs.rmSync(rollback.unpackedPath, { recursive: true, force: true });
    if (success) return { cleanupWarnings: this.cleanupLegacy(transaction.asarPath) };
    return { cleanupWarnings: [] };
  }

  cleanupLegacy(asarPath) {
    const directory = path.dirname(asarPath);
    const base = path.basename(asarPath);
    const escapedBase = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`^${escapedBase}\\.(?:backup|broken|white_screen)(?:[_-]|$)`),
      new RegExp(`^${escapedBase}\\.unpacked\\.(?:backup|broken)(?:[_-]|$)`)
    ];
    const warnings = [];
    for (const name of fs.readdirSync(directory)) {
      if (patterns.some(pattern => pattern.test(name))) {
        try { fs.rmSync(path.join(directory, name), { recursive: true, force: true }); }
        catch (error) { warnings.push(`${name}: ${error.message}`); }
      }
    }
    try { fs.rmSync(`${asarPath}.backup`, { force: true }); }
    catch (error) { warnings.push(`${path.basename(asarPath)}.backup: ${error.message}`); }
    if (this.legacyHistoryPath) {
      try { fs.rmSync(this.legacyHistoryPath, { force: true }); }
      catch (error) { warnings.push(`${path.basename(this.legacyHistoryPath)}: ${error.message}`); }
    }
    return warnings;
  }

  status(asarPath, clientVersion) {
    const paths = backupPaths(asarPath);
    if (fs.existsSync(paths.previousAsar)) this.ensurePreviousEntry(asarPath, clientVersion);
    const state = this.readState();
    const version = normalizeVersion(clientVersion);
    const client = state.currentClientVersion === version && state.clients && state.clients[version]
      || { original: null, previous: null };
    const originalInspection = fs.existsSync(paths.originalAsar) ? this.inspectArchive(paths.originalAsar) : null;
    const previousInspection = fs.existsSync(paths.previousAsar) ? this.inspectArchive(paths.previousAsar) : null;
    const versionMatches = inspection => inspection && inspection.valid
      && (version === 'unknown' || inspection.version === 'unknown' || inspection.version === version);
    return {
      hasOriginal: Boolean(client.original && versionMatches(originalInspection) && !originalInspection.patched),
      hasPrevious: Boolean(client.previous && versionMatches(previousInspection) && previousInspection.patched),
      original: client.original,
      previous: client.previous
    };
  }

  restore(kind, asarPath, clientVersion) {
    if (!['original', 'previous'].includes(kind)) throw new Error('未知的备份类型');
    if (kind === 'original') this.ensureOriginal(asarPath, clientVersion);
    else this.ensurePreviousEntry(asarPath, clientVersion);
    const paths = backupPaths(asarPath);
    const state = this.readState();
    const client = this.clientState(state, clientVersion);
    const entry = client[kind];
    const sourceAsar = kind === 'original' ? paths.originalAsar : paths.previousAsar;
    const sourceUnpacked = kind === 'original' ? paths.originalUnpacked : paths.previousUnpacked;
    if (!entry || !fs.existsSync(sourceAsar)) {
      throw new Error(kind === 'original' ? '未找到官方英文原版备份。' : '未找到上一版汉化备份。');
    }
    if (entry.sha256 && hashFile(sourceAsar) !== entry.sha256) throw new Error('备份文件校验失败，未执行还原。');
    if (entry.hadUnpacked) {
      if (!fs.existsSync(sourceUnpacked)) throw new Error('对应的 app.asar.unpacked 备份缺失，未执行还原。');
    }
    const rollback = this.createInstallSnapshot(asarPath);
    try {
      copyFileVerified(sourceAsar, asarPath);
      if (entry.hadUnpacked) this.replaceDirectory(sourceUnpacked, paths.targetUnpacked);
      else fs.rmSync(paths.targetUnpacked, { recursive: true, force: true });
      fs.rmSync(rollback.asarPath, { force: true });
      fs.rmSync(rollback.unpackedPath, { recursive: true, force: true });
    } catch (error) {
      copyFileVerified(rollback.asarPath, asarPath);
      if (rollback.hadUnpacked) this.replaceDirectory(rollback.unpackedPath, paths.targetUnpacked);
      else fs.rmSync(paths.targetUnpacked, { recursive: true, force: true });
      fs.rmSync(rollback.asarPath, { force: true });
      fs.rmSync(rollback.unpackedPath, { recursive: true, force: true });
      throw error;
    }
    return { kind, clientVersion: normalizeVersion(clientVersion), restoredFrom: sourceAsar };
  }
}

module.exports = { PatchBackupManager, backupPaths, inspectArchive, PATCH_MARKERS };
