const test = require('node:test');
const assert = require('node:assert/strict');
const { safeExternalUrl, safeRemoteImageUrl } = require('../src/urlPolicy.js');
const safeDom = require('../src/safeDom.js');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

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


test('feedback detail actions remain compatible with the strict CSP', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(root, 'renderer.js'), 'utf8');
  assert.match(html, /script-src 'self'/);
  assert.doesNotMatch(renderer, /onclick="(?:submitModalReplyDesktop|deleteReplyDesktop|focusCommentInputDesktop|toggleLikeReplyDesktop|toggleLikePostDesktop)/);
  for (const action of ['submit-reply', 'delete-reply', 'focus-reply', 'like-reply', 'like-post']) {
    assert.match(renderer, new RegExp(`data-feedback-detail-action=["']${action}["']`));
  }
  assert.match(renderer, /modalBody\.onclick = async/);
  assert.match(renderer, /(发布中…|发送中…)/);
});
