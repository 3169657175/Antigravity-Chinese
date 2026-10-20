const fs = 'electron' in process.versions ? require('original-fs') : require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
// Detached snapshots avoid long-lived Electron ASAR file locks on official installs.
function withDetachedArchive(filePath, inspect, options = {}) {
  const io = options.fsModule || fs;
  const snapshot = path.join(options.tempRoot || os.tmpdir(), 'agy-snapshot-' + process.pid + '-' + crypto.randomBytes(8).toString('hex') + '.asar');
  try {
    io.copyFileSync(filePath, snapshot);
    return inspect(snapshot);
  } finally {
    try { require('@electron/asar').uncache(snapshot); } catch (_) {}
    try { io.rmSync(snapshot, { force: true }); } catch (_) {}
  }
}
module.exports = { withDetachedArchive };
