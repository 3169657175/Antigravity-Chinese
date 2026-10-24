const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', '..', 'renderer.js'), 'utf8');
const start = source.indexOf('function renderDetailModalContentDesktop(fb) {');
const end = source.indexOf('\n// 聚焦输入框', start);
if (start < 0 || end < 0) throw new Error('Feedback detail render implementation missing');
const renderer = source.slice(start, end);
function renderWithReplies(replies) {
  const detailDialog = { onclick: null, contains: () => false };
  const modalBody = { innerHTML: '', querySelectorAll: () => [], closest: () => detailDialog };
  const composer = { innerHTML: '' };
  const ctx = {
    document: { getElementById: id => id === 'detail-modal-body' ? modalBody : id === 'detail-modal-composer' ? composer : null },
    currentUser: { username: 'owner', role: 'user' },
    escapeHTML: input => String(input ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
    safeDom: { imageUrl: value => String(value || '') },
    replyImageDrafts: new Map(),
    window: { AgyCommunityMedia: { avatarInitial: value => String(value || '?')[0].toUpperCase() } },
    console
  };
  const fb = { id: 21, username: 'owner', content: 'Details can open', created_at: '2026-10-10T00:00:00Z', replies };
  vm.runInNewContext(renderer + '\nrenderDetailModalContentDesktop(sample)', { ...ctx, sample: fb }, { timeout: 3000 });
  return { discussion: modalBody.innerHTML, composer: composer.innerHTML, delegated: typeof detailDialog.onclick === 'function' };
}
test('comment dialog renders a post without replies', () => {
  const result = renderWithReplies([]);
  assert.match(result.discussion, /还没有回复/);
  assert.match(result.composer, /reply-composer-row/);
  assert.doesNotMatch(result.discussion, /reply-composer-row/);
  assert.equal(result.delegated, true);
});
test('comment dialog renders existing replies without ReferenceError', () => {
  const {discussion} = renderWithReplies([{ id: 77, username: 'commenter', content: 'existing reply visible', likes_count: 1, created_at: '2026-10-10T00:00:00Z' }]);
  assert.match(discussion, /existing reply visible/);
  assert.match(discussion, /commenter/);
  assert.match(discussion, /reply-like-btn-77/);
});
test('comment dialog can render pending replies and many comments', () => {
  const {discussion} = renderWithReplies([{ id: 'pending-1', pending: true, username: 'owner', content: 'sending', created_at: '2026-10-10T00:00:00Z' },{ id: 78, username: 'other', content: 'second reply', created_at: '2026-10-10T00:00:00Z' }]);
  assert.match(discussion, /sending/);
  assert.match(discussion, /second reply/);
});
test('confirmed optimistic reply leaves sending state while waiting for reconciliation', () => {
  const {discussion} = renderWithReplies([{ id: 'pending-2', pending: false, syncing: true, username: 'owner', content: 'sent reply', created_at: '2026-10-10T00:00:00Z' }]);
  assert.match(discussion, /已发送/);
  assert.doesNotMatch(discussion, /发送中/);
  assert.doesNotMatch(discussion, /reply-like-btn-pending-2/);
});
