(function exposeCommunityState(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyCommunityState = api;
})(typeof window !== 'undefined' ? window : globalThis, function createCommunityState() {
  let feedbacks = [];
  let pendingSequence = 0;
  function clone(items) { return (Array.isArray(items) ? items : []).map(item => ({ ...item, replies: Array.isArray(item.replies) ? item.replies.map(reply => ({ ...reply })) : [] })); }
  function setAll(items) { feedbacks = clone(items); return all(); }
  function all() { return feedbacks; }
  function snapshot() { return clone(feedbacks); }
  function restore(items) { return setAll(items); }
  function pendingId(prefix = 'pending') { pendingSequence += 1; return `${prefix}-${Date.now()}-${pendingSequence}`; }
  function upsert(item, options = {}) { const key = String(options.matchId ?? item?.id ?? ''); const index = feedbacks.findIndex(entry => String(entry.id) === key); if (index >= 0) feedbacks[index] = { ...feedbacks[index], ...item }; else feedbacks.unshift(item); return item; }
  function remove(id) { const key = String(id); const before = feedbacks.length; feedbacks = feedbacks.filter(item => String(item.id) !== key); return feedbacks.length !== before; }
  function update(id, patch) { const item = feedbacks.find(entry => String(entry.id) === String(id)); if (!item) return null; Object.assign(item, typeof patch === 'function' ? patch(item) : patch); return item; }
  function addReply(feedbackId, reply) { const item = feedbacks.find(entry => String(entry.id) === String(feedbackId)); if (!item) return null; if (!Array.isArray(item.replies)) item.replies = []; item.replies.push(reply); return reply; }
  function removeReply(feedbackId, replyId) { const item = feedbacks.find(entry => String(entry.id) === String(feedbackId)); if (!item || !Array.isArray(item.replies)) return false; const before = item.replies.length; item.replies = item.replies.filter(reply => String(reply.id) !== String(replyId)); return before !== item.replies.length; }
  function updateReply(feedbackId, replyId, patch) { const item = feedbacks.find(entry => String(entry.id) === String(feedbackId)); const reply = item?.replies?.find(entry => String(entry.id) === String(replyId)); if (!reply) return null; Object.assign(reply, typeof patch === 'function' ? patch(reply) : patch); return reply; }
  return { setAll, all, snapshot, restore, pendingId, upsert, remove, update, addReply, removeReply, updateReply };
});
