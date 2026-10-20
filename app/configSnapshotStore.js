const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { writeJsonAtomic, readJsonSafe } = require('./fsUtils.js');

const CONFIG_FILES = Object.freeze([
  'codex-gateway.json',
  'codex-provider-profiles.json',
  'codex-connection.json',
  'claude-desktop-connection.json',
  'network_config.json'
]);

class ConfigSnapshotStore {
  constructor(userDataDir) {
    this.userDataDir = userDataDir;
    this.directory = path.join(userDataDir, 'config-snapshots');
  }

  create(label = '') {
    fs.mkdirSync(this.directory, { recursive: true });
    const createdAt = new Date().toISOString();
    const id = `${createdAt.replace(/[:.]/g, '-')}-${crypto.randomBytes(3).toString('hex')}`;
    const files = {};
    for (const name of CONFIG_FILES) {
      const source = path.join(this.userDataDir, name);
      if (fs.existsSync(source)) files[name] = readJsonSafe(source, null, { preserveCorrupted: true });
    }
    const snapshot = { schemaVersion: 1, id, label: String(label || '').trim().slice(0, 80), createdAt, files };
    writeJsonAtomic(path.join(this.directory, `${id}.json`), snapshot);
    return { id, label: snapshot.label, createdAt, fileCount: Object.keys(files).length };
  }

  list() {
    try {
      return fs.readdirSync(this.directory).filter(name => name.endsWith('.json')).map(name => {
        const snapshot = readJsonSafe(path.join(this.directory, name), null, { preserveCorrupted: true });
        return snapshot ? { id: snapshot.id, label: snapshot.label, createdAt: snapshot.createdAt, fileCount: Object.keys(snapshot.files || {}).length } : null;
      }).filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 30);
    } catch (_) { return []; }
  }

  restore(id) {
    const safeId = String(id || '');
    if (!/^[\w.-]+$/.test(safeId)) throw new Error('快照 ID 不合法');
    const snapshot = readJsonSafe(path.join(this.directory, `${safeId}.json`), null, { preserveCorrupted: true });
    if (!snapshot) throw new Error('配置快照不存在或已损坏');
    for (const name of CONFIG_FILES) {
      if (Object.prototype.hasOwnProperty.call(snapshot.files || {}, name)) writeJsonAtomic(path.join(this.userDataDir, name), snapshot.files[name]);
    }
    return { id: snapshot.id, restoredAt: new Date().toISOString(), fileCount: Object.keys(snapshot.files || {}).length, requiresRestart: true };
  }
}

module.exports = { CONFIG_FILES, ConfigSnapshotStore };
