const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeJsonAtomic, readJsonSafe } = require('../src/fsUtils');

test('atomic JSON writes replace a complete document', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-fs-utils-'));
  const file = path.join(dir, 'config.json');
  writeJsonAtomic(file, { version: 1 });
  writeJsonAtomic(file, { version: 2, ready: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { version: 2, ready: true });
  assert.deepEqual(fs.readdirSync(dir), ['config.json']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('damaged JSON is preserved instead of silently overwritten', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-fs-corrupt-'));
  const file = path.join(dir, 'config.json');
  fs.writeFileSync(file, '{bad json');
  const value = readJsonSafe(file, { safe: true });
  assert.deepEqual(value, { safe: true });
  assert.equal(fs.readdirSync(dir).some(name => name.includes('.corrupted-')), true);
  assert.equal(fs.readFileSync(file, 'utf8'), '{bad json');
  fs.rmSync(dir, { recursive: true, force: true });
});
