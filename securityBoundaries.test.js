const test = require('node:test');
const assert = require('node:assert/strict');
const { safeExternalUrl, safeRemoteImageUrl } = require('./urlPolicy.js');
const safeDom = require('./safeDom.js');

test('remote usernames and errors are escaped before entering HTML templates', () => {
  assert.equal(safeDom.text('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(safeDom.errorMessage({ message: '<script>alert(1)</script>' }), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('external and image URL policies reject executable protocols', () => {
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(safeExternalUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(safeRemoteImageUrl('javascript:alert(1)'), '');
  assert.equal(safeRemoteImageUrl('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.equal(safeRemoteImageUrl('https://example.com/a.png'), 'https://example.com/a.png');
});
