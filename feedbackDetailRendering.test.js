const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'renderer.js'), 'utf8');
const start = source.indexOf('function renderDetailModalContentDesktop(fb) {');
const end = source.indexOf('\n// 聚焦输入框', start);
if (start < 0 || end < 0) throw new Error('Feedback detail render implementation missing');
const renderer = source.slice(start, end);
function renderWithReplies(replies) {
  const modalBody = { innerHTML: '', onclick: null, querySelectorAll: () => [], contains: () => false };
  const ctx = {
    document: { getElementById: id => id === 'detail-modal-body' ? modalBody : null },
    currentUser: { username: 'owner', role: 'user' },
    escapeHTML: input => String(input ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    console
  };
  const fb = { id: 21, username: 'owner', content: 'Details can open', created_at: '2026-10-10T00:00:00Z', replies };
  vm.runInNewContext(renderer + '\nrenderDetailModalContentDesktop(sample)', { ...ctx, sample: fb }, { timeout: 3000 });
  return modalBody.innerHTML;
}
test('comment dialog renders a post without replies', () => {
  assert.match(renderWithReplies([]), /暂无回复/);
});
test('comment dialog renders existing replies without ReferenceError', () => {
  const html = renderWithReplies([{ id: 77, username: 'commenter', content: 'existing reply visible', likes_count: 1, created_at: '2026-10-10T00:00:00Z' }]);
  assert.match(html, /existing reply visible/);
  assert.match(html, /commenter/);
  assert.match(html, /reply-like-btn-77/);
});
test('comment dialog can render pending replies and many comments', () => {
  const html = renderWithReplies([{ id: 'pending-1', pending: true, username: 'owner', content: 'sending', created_at: '2026-10-10T00:00:00Z' },{ id: 78, username: 'other', content: 'second reply', created_at: '2026-10-10T00:00:00Z' }]);
  assert.match(html, /sending/);
  assert.match(html, /second reply/);
});