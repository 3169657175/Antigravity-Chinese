const fs = require('fs');
const path = require('path');

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function replaceFileAtomic(tempPath, filePath) {
  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
    const backup = `${filePath}.replace-backup-${process.pid}`;
    try { if (fs.existsSync(filePath)) fs.renameSync(filePath, backup); } catch (_) {}
    try {
      fs.renameSync(tempPath, filePath);
      fs.rmSync(backup, { force: true });
    } catch (replaceError) {
      if (!fs.existsSync(filePath) && fs.existsSync(backup)) fs.renameSync(backup, filePath);
      throw replaceError;
    }
  }
}

function writeTextAtomic(filePath, value) {
  ensureParent(filePath);
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, String(value), 'utf8');
  replaceFileAtomic(tempPath, filePath);
}

function writeJsonAtomic(filePath, value) {
  writeTextAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function preserveCorruptedFile(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const preserved = `${filePath}.corrupted-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  fs.copyFileSync(filePath, preserved);
  return preserved;
}

function readJsonSafe(filePath, fallback, options = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    const corruptedPath = options.preserveCorrupted === false ? '' : preserveCorruptedFile(filePath);
    if (typeof options.onCorrupted === 'function') options.onCorrupted({ filePath, corruptedPath, error });
    return fallback;
  }
}

module.exports = { writeTextAtomic, writeJsonAtomic, readJsonSafe, preserveCorruptedFile };
