const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  isSafeRuntimeTempDir,
  removeRuntimeTempDir,
  cleanupStaleRuntimeTempDirs
} = require('../src/patchRuntimeBuilder');

test('runtime patch cleanup only accepts its own direct children in the system temp directory', () => {
  const tempRoot = path.resolve('C:/Temp');
  assert.equal(isSafeRuntimeTempDir(path.join(tempRoot, 'agy-runtime-patch-123'), tempRoot), true);
  assert.equal(isSafeRuntimeTempDir(path.join(tempRoot, 'unrelated'), tempRoot), false);
  assert.equal(isSafeRuntimeTempDir(path.join(tempRoot, 'nested', 'agy-runtime-patch-123'), tempRoot), false);
});

test('runtime patch cleanup retries transient Windows ENOTEMPTY errors', () => {
  const tempRoot = path.resolve('C:/Temp');
  const tempDir = path.join(tempRoot, 'agy-runtime-patch-retry');
  let attempts = 0;
  const result = removeRuntimeTempDir(tempDir, {
    tempRoot,
    retryDelay: 1,
    wait: () => {},
    fsModule: {
      rmSync() {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error('directory not empty');
          error.code = 'ENOTEMPTY';
          throw error;
        }
      }
    }
  });
  assert.equal(result.removed, true);
  assert.equal(result.attempts, 3);
});

test('cleanup failure is returned as a warning instead of throwing over a completed build', () => {
  const tempRoot = path.resolve('C:/Temp');
  const tempDir = path.join(tempRoot, 'agy-runtime-patch-busy');
  const result = removeRuntimeTempDir(tempDir, {
    tempRoot,
    maxAttempts: 2,
    retryDelay: 1,
    wait: () => {},
    fsModule: {
      rmSync() {
        const error = new Error('directory not empty');
        error.code = 'ENOTEMPTY';
        throw error;
      }
    }
  });
  assert.equal(result.removed, false);
  assert.equal(result.attempts, 2);
  assert.match(result.warning, /ENOTEMPTY/);
});

test('stale cleanup ignores recent and unrelated directories', () => {
  const tempRoot = path.resolve('C:/Temp');
  const removed = [];
  const entries = [
    { name: 'agy-runtime-patch-old', isDirectory: () => true },
    { name: 'agy-runtime-patch-new', isDirectory: () => true },
    { name: 'other-old', isDirectory: () => true }
  ];
  const fsModule = {
    readdirSync: () => entries,
    statSync: candidate => ({ mtimeMs: candidate.endsWith('-old') ? 0 : 9_500 }),
    rmSync: candidate => removed.push(path.basename(candidate))
  };
  const warnings = cleanupStaleRuntimeTempDirs({
    fsModule,
    tempRoot,
    now: 10_000,
    minimumAgeMs: 1_000,
    wait: () => {}
  });
  assert.deepEqual(warnings, []);
  assert.deepEqual(removed, ['agy-runtime-patch-old']);
});
