const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PatchBackupManager, backupPaths } = require('./patchBackupManager');

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function managerFor(root) {
  return new PatchBackupManager({
    statePath: path.join(root, 'user-data', 'patch-backup-state.json'),
    legacyHistoryPath: path.join(root, 'user-data', 'backups.json'),
    inspectArchive: filePath => {
      const value = fs.readFileSync(filePath, 'utf8');
      const version = value.includes('2.4.0') ? '2.4.0' : '2.3.1';
      return { valid: true, patched: value.startsWith('PATCH:'), version };
    }
  });
}

test('first injection preserves one official original and creates no previous patch', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-backup-first-'));
  const asarPath = path.join(root, 'resources', 'app.asar');
  write(asarPath, 'OFFICIAL');
  write(`${asarPath}.unpacked/native.txt`, 'native');
  const manager = managerFor(root);
  const transaction = manager.beginInstall(asarPath, '2.3.1');
  const paths = backupPaths(asarPath);
  assert.equal(fs.readFileSync(paths.originalAsar, 'utf8'), 'OFFICIAL');
  assert.equal(fs.readFileSync(path.join(paths.originalUnpacked, 'native.txt'), 'utf8'), 'native');
  assert.equal(fs.existsSync(paths.previousAsar), false);
  manager.finishInstall(transaction, true);
});

test('later injections overwrite the single previous patch without touching original', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-backup-rolling-'));
  const asarPath = path.join(root, 'resources', 'app.asar');
  const manager = managerFor(root);
  write(asarPath, 'OFFICIAL');
  manager.finishInstall(manager.beginInstall(asarPath, '2.3.1'), true);

  write(asarPath, 'PATCH:1');
  write(`${asarPath}.unpacked/version.txt`, 'one');
  manager.finishInstall(manager.beginInstall(asarPath, '2.3.1'), true);
  assert.equal(fs.readFileSync(`${asarPath}.previous`, 'utf8'), 'PATCH:1');

  write(asarPath, 'PATCH:2');
  write(`${asarPath}.unpacked/version.txt`, 'two');
  manager.finishInstall(manager.beginInstall(asarPath, '2.3.1'), true);
  assert.equal(fs.readFileSync(`${asarPath}.original`, 'utf8'), 'OFFICIAL');
  assert.equal(fs.readFileSync(`${asarPath}.previous`, 'utf8'), 'PATCH:2');
  assert.equal(fs.readFileSync(path.join(`${asarPath}.unpacked.previous`, 'version.txt'), 'utf8'), 'two');
});

test('previous and original restore use different fixed slots and paired unpacked state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-backup-restore-'));
  const asarPath = path.join(root, 'resources', 'app.asar');
  const manager = managerFor(root);
  write(asarPath, 'OFFICIAL');
  manager.finishInstall(manager.beginInstall(asarPath, '2.3.1'), true);
  write(asarPath, 'PATCH:1');
  write(`${asarPath}.unpacked/version.txt`, 'one');
  manager.finishInstall(manager.beginInstall(asarPath, '2.3.1'), true);
  write(asarPath, 'PATCH:2');
  write(`${asarPath}.unpacked/version.txt`, 'current');

  manager.restore('previous', asarPath, '2.3.1');
  assert.equal(fs.readFileSync(asarPath, 'utf8'), 'PATCH:1');
  assert.equal(fs.readFileSync(path.join(`${asarPath}.unpacked`, 'version.txt'), 'utf8'), 'one');

  manager.restore('original', asarPath, '2.3.1');
  assert.equal(fs.readFileSync(asarPath, 'utf8'), 'OFFICIAL');
  assert.equal(fs.existsSync(`${asarPath}.unpacked`), false);
});

test('successful injection removes timestamped legacy backups and keeps only fixed slots', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-backup-cleanup-'));
  const asarPath = path.join(root, 'resources', 'app.asar');
  const manager = managerFor(root);
  write(asarPath, 'OFFICIAL');
  write(`${asarPath}.backup_2.3.1_1`, 'OLD');
  write(path.join(`${asarPath}.unpacked.backup_2.3.1_1`, 'old.txt'), 'OLD');
  write(`${asarPath}.broken-legacy`, 'BROKEN');
  write(`${asarPath}.broken_wallpaper_task_legacy`, 'BROKEN');
  write(`${asarPath}.white_screen_legacy`, 'BROKEN');
  write(path.join(`${asarPath}.unpacked.broken_before_fix`, 'old.txt'), 'BROKEN');
  write(`${asarPath}.backup`, 'OFFICIAL');
  write(manager.legacyHistoryPath, '[]');
  manager.finishInstall(manager.beginInstall(asarPath, '2.3.1'), true);
  const names = fs.readdirSync(path.dirname(asarPath));
  assert.deepEqual(names.sort(), ['app.asar', 'app.asar.original'].sort());
  assert.equal(fs.existsSync(manager.legacyHistoryPath), false);
});

test('a new official client version replaces the single original slot and clears stale previous patch', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-backup-version-'));
  const asarPath = path.join(root, 'resources', 'app.asar');
  const manager = managerFor(root);
  write(asarPath, 'OFFICIAL:2.3.1');
  manager.finishInstall(manager.beginInstall(asarPath, '2.3.1'), true);
  write(asarPath, 'PATCH:2.3.1');
  manager.finishInstall(manager.beginInstall(asarPath, '2.3.1'), true);
  assert.equal(fs.existsSync(`${asarPath}.previous`), true);

  write(asarPath, 'OFFICIAL:2.4.0');
  manager.finishInstall(manager.beginInstall(asarPath, '2.4.0'), true);
  assert.equal(fs.readFileSync(`${asarPath}.original`, 'utf8'), 'OFFICIAL:2.4.0');
  assert.equal(fs.existsSync(`${asarPath}.previous`), false);
  const state = JSON.parse(fs.readFileSync(manager.statePath, 'utf8'));
  assert.equal(state.currentClientVersion, '2.4.0');
  assert.deepEqual(Object.keys(state.clients), ['2.4.0']);
});

test('legacy multi-version state is pruned to the current client version', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-backup-state-migration-'));
  const asarPath = path.join(root, 'resources', 'app.asar');
  const manager = managerFor(root);
  write(asarPath, 'OFFICIAL:2.4.0');
  write(manager.statePath, JSON.stringify({
    version: 1,
    clients: {
      '2.3.1': { original: { sha256: 'stale' }, previous: null },
      '2.4.0': { original: null, previous: null }
    }
  }));

  manager.finishInstall(manager.beginInstall(asarPath, '2.4.0'), true);

  const state = JSON.parse(fs.readFileSync(manager.statePath, 'utf8'));
  assert.equal(state.currentClientVersion, '2.4.0');
  assert.deepEqual(Object.keys(state.clients), ['2.4.0']);
});

test('existing current original still persists pruning of stale state entries', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-patch-backup-existing-original-migration-'));
  const asarPath = path.join(root, 'resources', 'app.asar');
  const manager = managerFor(root);
  write(asarPath, 'PATCH:2.4.0');
  write(`${asarPath}.original`, 'OFFICIAL:2.4.0');
  write(manager.statePath, JSON.stringify({
    version: 2,
    currentClientVersion: '2.4.0',
    clients: {
      '2.3.1': { original: { sha256: 'stale' }, previous: null },
      '2.4.0': {
        original: {
          asarPath: `${asarPath}.original`,
          unpackedPath: `${asarPath}.unpacked.original`,
          hadUnpacked: false,
          sha256: manager.inspectArchive(`${asarPath}.original`) && require('crypto').createHash('sha256').update(fs.readFileSync(`${asarPath}.original`)).digest('hex'),
          savedAt: new Date().toISOString(),
          source: 'existing-original'
        },
        previous: null
      }
    }
  }));

  manager.ensureOriginal(asarPath, '2.4.0');

  const state = JSON.parse(fs.readFileSync(manager.statePath, 'utf8'));
  assert.deepEqual(Object.keys(state.clients), ['2.4.0']);
});
