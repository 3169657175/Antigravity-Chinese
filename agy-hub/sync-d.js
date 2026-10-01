const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function log(message, type = 'info') {
  const colors = { info: '\x1b[36m', success: '\x1b[32m', warning: '\x1b[33m', error: '\x1b[31m', reset: '\x1b[0m' };
  console.log(`${colors[type] || ''}${message}${colors.reset}`);
}

function copyFolderContents(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const item of fs.readdirSync(source)) {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    if (fs.lstatSync(sourcePath).isDirectory()) {
      copyFolderContents(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function syncExecutable(sourceExe, targetExe) {
  if (fs.existsSync(targetExe)) {
    const sourceStat = fs.statSync(sourceExe);
    const targetStat = fs.statSync(targetExe);
    if (sourceStat.size === targetStat.size && fileHash(sourceExe) === fileHash(targetExe)) {
      return { replaced: false, unchanged: true, stagedExe: '' };
    }
  }

  const stagedExe = `${targetExe}.next`;
  const previousExe = `${targetExe}.previous-${Date.now()}`;
  fs.copyFileSync(sourceExe, stagedExe);

  try {
    if (fs.existsSync(targetExe)) fs.renameSync(targetExe, previousExe);
    fs.renameSync(stagedExe, targetExe);
    try { fs.unlinkSync(previousExe); } catch (_) {}
    return { replaced: true, stagedExe: '' };
  } catch (error) {
    if (!fs.existsSync(targetExe) && fs.existsSync(previousExe)) {
      try { fs.renameSync(previousExe, targetExe); } catch (_) {}
    }
    return { replaced: false, stagedExe, error: error.message };
  }
}

try {
  const sourceRoot = path.join(__dirname, 'dist', 'win-unpacked');
  const sourceResources = path.join(sourceRoot, 'resources');
  const sourceExe = path.join(sourceRoot, 'AGY Hub 桌面管家.exe');
  const sourceIcon = path.join(__dirname, 'assets', 'icon.ico');
  const targetRoot = 'D:/ang/agy-hub';
  const targetResources = path.join(targetRoot, 'resources');
  const targetExe = path.join(targetRoot, 'AGY Hub 桌面管家.exe');
  const targetIcon = path.join(targetRoot, 'AGY Hub.ico');

  for (const requiredPath of [sourceResources, sourceExe, sourceIcon]) {
    if (!fs.existsSync(requiredPath)) throw new Error(`缺少构建产物: ${requiredPath}`);
  }

  log(`[*] 正在同步运行资源: ${sourceResources} ➔ ${targetResources}...`);
  copyFolderContents(sourceResources, targetResources);
  fs.copyFileSync(sourceIcon, targetIcon);

  const executable = syncExecutable(sourceExe, targetExe);
  if (executable.unchanged) {
    log('[SUCCESS] 资源与品牌图标已同步，主程序 EXE 已是最新版本。', 'success');
  } else if (executable.replaced) {
    log('[SUCCESS] 资源、主程序 EXE 与品牌图标已全部同步。', 'success');
  } else {
    log(`[!] 当前主程序正在运行，资源与图标已同步；新版 EXE 已安全暂存到 ${executable.stagedExe}`, 'warning');
    log(`[!] 下次退出小助手后可完成主程序替换：${executable.error}`, 'warning');
  }
} catch (error) {
  log(`[ERROR] 同步失败: ${error.message}`, 'error');
  process.exit(1);
}
