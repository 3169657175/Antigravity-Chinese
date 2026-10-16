const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
// Detached snapshots avoid long-lived Electron ASAR file locks on official installs.
function withDetachedArchive(filePath, inspect, options = {}) {
  const io = options.fsModule || fs;
  const snapshot = path.join(options.tempRoot || os.tmpdir(), 'agy-snapshot-' + process.pid + '-' + crypto.randomBytes(8).toString('hex') + '.asar');
  io.copyFileSync(filePath, snapshot);
  try { return inspect(snapshot); } finally {
    try { require('@electron/asar').uncache(snapshot); } catch (_) {}
    try { io.rmSync(snapshot, { force: true }); } catch (_) {}
  }
}
module.exports = { withDetachedArchive };
