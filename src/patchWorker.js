const { isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const vm = require('vm');
const asar = require('@electron/asar');
const { PatchBackupManager } = require('./patchBackupManager.js');
const { buildPatchForTarget } = require('./patchRuntimeBuilder.js');
const { assertTrayModuleLoads } = require('../patch-workbench/compatibility');

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

function normalizeClientVersion(value) {
  const match = String(value || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1, 4).join('.') : '';
}

function inspectPatchArchive(archivePath, requiredFiles = []) {
  const entries = new Set(asar.listPackage(archivePath).map(entry =>
    String(entry).replace(/^[/\\]+/, '').replace(/\\/g, '/')
  ));
  const packageJson = JSON.parse(asar.extractFile(archivePath, 'package.json').toString('utf8').replace(/^\uFEFF/, ''));
  const syntaxErrors = [];
  for (const entry of ['dist/main.js', 'dist/preload.js', 'dist/ipcHandlers.js', 'dist/languageServer.js', 'dist/tray.js', 'dist/utils.js', 'dist/accountVault.js']) {
    if (!entries.has(entry)) continue;
    try {
      new vm.Script(asar.extractFile(archivePath, entry).toString('utf8'), { filename: entry });
    } catch (error) {
      syntaxErrors.push(`${entry}: ${error.message}`);
    }
  }
  if (entries.has('dist/tray.js')) {
    try {
      const trayExports = assertTrayModuleLoads(asar.extractFile(archivePath, 'dist/tray.js').toString('utf8'));
      const [major, minor] = normalizeClientVersion(packageJson.version).split('.').map(Number);
      if ((major > 2 || (major === 2 && minor >= 17)) && !trayExports.includes('insertTrayMenuItem')) {
        throw new Error('Missing official insertTrayMenuItem export');
      }
    } catch (error) {
      syntaxErrors.push(`dist/tray.js module load: ${error.message}`);
    }
  }
  const preload = entries.has('dist/preload.js')
    ? asar.extractFile(archivePath, 'dist/preload.js').toString('utf8')
    : '';
  return {
    version: normalizeClientVersion(packageJson.version),
    missingFiles: requiredFiles.filter(file => !entries.has(String(file).replace(/\\/g, '/'))),
    syntaxErrors,
    patched: ['AGYCustomThemeLibraryBridge', 'AGYSupplementalTranslations', '__agyAuditEnhanced']
      .some(marker => preload.includes(marker))
  };
}

function getDirectoryStats(directory) {
  let files = 0;
  let bytes = 0;
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(fullPath).size;
      }
    }
  };
  visit(directory);
  return { files, bytes };
}

function waitSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function replaceDirectory(sourceDir, targetDir) {
  const parentDir = path.dirname(targetDir);
  const tempDir = path.join(parentDir, `.${path.basename(targetDir)}.installing-${process.pid}-${Date.now()}`);
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.cpSync(sourceDir, tempDir, { recursive: true, force: true });
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
      break;
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES', 'ENOTEMPTY'].includes(error.code)) throw error;
      waitSync(200);
    }
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      fs.renameSync(tempDir, targetDir);
      return;
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES'].includes(error.code)) throw error;
      waitSync(200);
    }
  }
  fs.renameSync(tempDir, targetDir);
}

function waitForFileRelease(asarPath) {
  const unpackedDir = `${asarPath}.unpacked`;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const fd = fs.openSync(asarPath, 'r+');
      fs.closeSync(fd);
      if (fs.existsSync(unpackedDir)) {
        const lockProbe = path.join(unpackedDir, `.locktest-${process.pid}`);
        fs.writeFileSync(lockProbe, 'test');
        fs.unlinkSync(lockProbe);
      }
      return;
    } catch (error) {
      if (!['EBUSY', 'EPERM', 'EACCES', 'ENOENT'].includes(error.code)) throw error;
      waitSync(150);
    }
  }
  throw new Error('Antigravity 及其依赖文件句柄尚未完全释放，请稍后重试。');
}

function createBackupManager(data) {
  return new PatchBackupManager({
    statePath: data.statePath,
    legacyHistoryPath: data.legacyHistoryPath,
    replaceDirectory
  });
}

function send(type, payload = {}) {
  parentPort.postMessage({ type, ...payload });
}

async function yieldToMessages() {
  await new Promise(resolve => setImmediate(resolve));
}

async function runWorker(data) {
  let cancelRequested = false;
  let continueInstall;
  const decision = new Promise(resolve => { continueInstall = resolve; });
  parentPort.on('message', message => {
    if (message && message.type === 'cancel') {
      cancelRequested = true;
      continueInstall('cancel');
    }
    if (message && message.type === 'continue') continueInstall('continue');
  });

  const progress = (message, percent, cancellable = true) => send('progress', { message, percent, cancellable });
  const { asarPath, sourceAsar } = data;
  const targetUnpackedDir = `${asarPath}.unpacked`;
  const manifestPath = path.join(path.dirname(sourceAsar), 'patch-manifest.json');
  let effectiveSourceAsar = sourceAsar;
  let generatedSourceAsar = '';
  let generatedBuildWarnings = [];
  let sourceUnpackedDir = `${sourceAsar}.unpacked`;
  let transaction = null;
  let stagedAsarPath = '';
  process.noAsar = true;

  try {
    progress('正在检查补丁文件与客户端版本', 8);
    if (!fs.existsSync(asarPath)) throw new Error('目标 app.asar 不存在，请重新选择正确的 Antigravity 安装目录。');
    if (!fs.existsSync(sourceAsar)) throw new Error('桌面管家缺少汉化补丁核心资源。');
    if (!fs.existsSync(manifestPath)) throw new Error('桌面管家缺少 patch-manifest.json。');

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8').replace(/^\uFEFF/, ''));
    const patchVersion = normalizeClientVersion(manifest.clientVersion);
    if (!patchVersion) throw new Error('补丁清单中的客户端版本无效。');
    const requiredFiles = manifest.requiredCapabilities || manifest.requiredFiles || [];
    const targetInspection = inspectPatchArchive(asarPath, ['package.json', 'dist/main.js', 'dist/preload.js']);
    const targetVersion = targetInspection.version || normalizeClientVersion(data.originalVersion);
    if (!targetVersion) throw new Error('无法识别当前 Antigravity 客户端版本。');

    if (patchVersion !== targetVersion) {
      if (targetInspection.patched) {
        throw new Error(`当前 app.asar 已是 v${targetVersion} 汉化版，但离线补丁是 v${patchVersion}。请先恢复当前版本官方原版再重试。`);
      }
      progress(`检测到 Antigravity v${targetVersion}，正在基于当前官方版本自动生成兼容补丁`, 12);
      generatedSourceAsar = path.join(os.tmpdir(), `agy-generated-patch-${process.pid}-${Date.now()}.asar`);
      const patchResourceDir = path.dirname(sourceAsar);
      const runtimeBuild = await buildPatchForTarget({
        targetAsar: asarPath,
        legacyPayloadAsar: data.legacyPayloadAsar || path.join(patchResourceDir, 'legacy-payload.asar'),
        runtimeRulesPath: data.runtimeRulesPath || path.join(patchResourceDir, 'runtime-rules.json'),
        outputAsar: generatedSourceAsar
      });
      generatedBuildWarnings = runtimeBuild.cleanupWarnings || [];
      effectiveSourceAsar = generatedSourceAsar;
      sourceUnpackedDir = `${effectiveSourceAsar}.unpacked`;
    }

    const inspection = inspectPatchArchive(effectiveSourceAsar, requiredFiles);
    if (inspection.missingFiles.length) throw new Error(`补丁包缺少必要文件：${inspection.missingFiles.join('、')}。已取消注入。`);
    if (inspection.syntaxErrors.length) throw new Error(`补丁脚本语法检查失败：${inspection.syntaxErrors.join('；')}。已取消注入。`);
    const unpackedMode = manifest.unpackedMode || 'replace-from-package';
    if (unpackedMode === 'replace-from-package' && !fs.existsSync(sourceUnpackedDir)) {
      throw new Error('补丁声明需要替换 app.asar.unpacked，但对应资源不存在。');
    }
    const sourceStats = fs.existsSync(sourceUnpackedDir) ? getDirectoryStats(sourceUnpackedDir) : null;
    const warnings = [];
    if (sourceStats && Number.isFinite(Number(manifest.unpackedFiles)) && sourceStats.files !== Number(manifest.unpackedFiles)) {
      warnings.push(`补丁依赖文件数实际 ${sourceStats.files}，清单声明 ${manifest.unpackedFiles}`);
    }
    send('validated', {
      patchVersion: inspection.version,
      targetVersion,
      dynamicallyBuilt: Boolean(generatedSourceAsar),
      warnings: [...warnings, ...generatedBuildWarnings]
    });

    const action = await decision;
    if (action !== 'continue' || cancelRequested) {
      send('cancelled', { code: 'PATCH_CANCELLED', message: '已取消注入，客户端文件未被替换。' });
      return;
    }

    progress('正在等待 Antigravity 释放文件句柄', 24);
    waitForFileRelease(asarPath);
    const backupManager = createBackupManager(data);
    progress('正在保存当前版本官方原版或上一版汉化', 36);
    transaction = backupManager.beginInstall(asarPath, targetVersion);
    await yieldToMessages();
    if (cancelRequested) {
      backupManager.finishInstall(transaction, false);
      transaction = null;
      send('cancelled', { code: 'PATCH_CANCELLED', message: '已取消注入，当前客户端保持原状。' });
      return;
    }

    stagedAsarPath = `${asarPath}.installing-${process.pid}-${Date.now()}`;
    progress('正在复制并校验汉化补丁', 55);
    fs.copyFileSync(effectiveSourceAsar, stagedAsarPath);
    const sourceHash = hashFile(effectiveSourceAsar);
    if (hashFile(stagedAsarPath) !== sourceHash) throw new Error('补丁临时副本 SHA-256 校验失败。');
    await yieldToMessages();
    if (cancelRequested) {
      backupManager.finishInstall(transaction, false);
      transaction = null;
      fs.rmSync(stagedAsarPath, { force: true });
      stagedAsarPath = '';
      send('cancelled', { code: 'PATCH_CANCELLED', message: '已取消注入，临时文件已清理。' });
      return;
    }

    send('commit-started');
    progress('正在写入汉化资源，请勿关闭程序', 72, false);
    if (unpackedMode === 'replace-from-package') replaceDirectory(sourceUnpackedDir, targetUnpackedDir);
    fs.copyFileSync(stagedAsarPath, asarPath);
    fs.rmSync(stagedAsarPath, { force: true });
    stagedAsarPath = '';

    progress('正在进行完整性校验', 86, false);
    if (hashFile(asarPath) !== sourceHash) throw new Error('注入后的 app.asar SHA-256 校验失败。');
    if (unpackedMode === 'replace-from-package') {
      const installedStats = getDirectoryStats(targetUnpackedDir);
      if (installedStats.files !== sourceStats.files || installedStats.bytes !== sourceStats.bytes) {
        throw new Error('注入后的 app.asar.unpacked 完整性校验失败。');
      }
    }

    progress('正在清理废弃备份并整理目录', 95, false);
    const currentWasPatched = Boolean(transaction.currentWasPatched);
    const finishResult = backupManager.finishInstall(transaction, true);
    transaction = null;
    send('success', {
      patchVersion: inspection.version,
      dynamicallyBuilt: Boolean(generatedSourceAsar),
      currentWasPatched,
      cleanupWarnings: [...generatedBuildWarnings, ...(finishResult.cleanupWarnings || [])]
    });
  } catch (error) {
    if (transaction) {
      try { createBackupManager(data).finishInstall(transaction, false); }
      catch (rollbackError) { error.message += `；自动回滚失败：${rollbackError.message}`; }
    }
    if (stagedAsarPath) {
      try { fs.rmSync(stagedAsarPath, { force: true }); } catch (_) {}
    }
    send('error', { code: error.code || 'PATCH_WORKER_FAILED', message: error.message });
  } finally {
    if (generatedSourceAsar) {
      try { fs.rmSync(generatedSourceAsar, { force: true }); } catch (_) {}
    }
    process.noAsar = false;
    parentPort.close();
  }
}

if (!isMainThread) runWorker(workerData);

module.exports = { hashFile, inspectPatchArchive, getDirectoryStats, replaceDirectory };
