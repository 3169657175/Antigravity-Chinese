const test = require('node:test');
const assert = require('node:assert/strict');
const { compareVersions, isVersionNewer } = require('../src/updateUtils.js');

test('compares release versions numerically', () => {
  assert.equal(compareVersions('1.2.3', '1.2.3'), 0);
  assert.equal(compareVersions('v1.2.4', '1.2.3'), 1);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.2.2', '1.2.3'), -1);
});

test('only treats a strictly newer release as an update', () => {
  assert.equal(isVersionNewer('1.2.3', '1.2.3'), false);
  assert.equal(isVersionNewer('v1.2.3', '1.2.3'), false);
  assert.equal(isVersionNewer('1.2.4', '1.2.3'), true);
  assert.equal(isVersionNewer('1.2.2', '1.2.3'), false);
});
