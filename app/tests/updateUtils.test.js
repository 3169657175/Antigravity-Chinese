const test = require('node:test');
const assert = require('node:assert/strict');
const { htmlToPlainText, normalizeReleaseNotes } = require('../src/updateUtils');

test('converts HTML release notes to readable plain text', () => {
  const source = '<p>新增了 Antigravity 反代功能，同时修复了 token 监控问题</p>';
  assert.equal(htmlToPlainText(source), '新增了 Antigravity 反代功能，同时修复了 token 监控问题');
});

test('preserves release note structure and decodes entities', () => {
  assert.equal(
    normalizeReleaseNotes('<p>第一项 &amp; 改进</p><ul><li>修复 A</li><li>修复 B</li></ul>'),
    '第一项 & 改进\n• 修复 A\n• 修复 B'
  );
});

test('normalizes array-shaped electron-updater notes', () => {
  assert.equal(normalizeReleaseNotes([{ note: '<p>版本一</p>' }, { note: '<p>版本二</p>' }]), '版本一\n\n版本二');
});
