const test = require('node:test');
const assert = require('node:assert/strict');
const { verify, parseLatestYaml } = require('../scripts/releaseGuard.js');

test('release guard keeps package version and publish repository unified', () => {
  const result = verify({ expectedVersion: '1.3.0' });
  assert.equal(result.version, '1.3.0');
  assert.equal(result.repository, '3169657175/Antigravity-Chinese');
});

test('latest.yml parser reads release version and installer path', () => {
  assert.deepEqual(parseLatestYaml('version: 1.3.0\npath: agy-hub-setup-1.3.0.exe\n'), { version: '1.3.0', path: 'agy-hub-setup-1.3.0.exe' });
});
