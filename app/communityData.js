(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyCommunityData = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function timestamp(value) {
    if (value === null || value === undefined || value === '') return 0;
    const number = typeof value === 'number' ? value : /^\d+$/.test(value) ? Number(value) : NaN;
    if (Number.isFinite(number)) return number < 1e11 ? number * 1000 : number;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const newest = (a, b) => timestamp(b.created_at) - timestamp(a.created_at) || Number(b.id || 0) - Number(a.id || 0);
  function date(value) { const t = timestamp(value); return t ? new Date(t).toLocaleString('zh-CN', { hour12: false }) : '未记录'; }
  function feedbacks(items, mode = 'newest', query = '') {
    const needle = query.trim().toLocaleLowerCase();
    return (Array.isArray(items) ? items : []).filter(item => (!needle || `${item.username} ${item.content}`.toLocaleLowerCase().includes(needle)) && (mode !== 'unanswered' || !(item.replies?.length || item.reply_count)))
      .sort(mode === 'popular' ? (a, b) => Number(b.likes_count || 0) - Number(a.likes_count || 0) || newest(a, b) : newest);
  }
  function announcements(items, mode = 'newest', query = '') {
    return (Array.isArray(items) ? items : []).filter(item => item?.content && item.content.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort(mode === 'oldest' ? (a, b) => -newest(a, b) : newest);
  }
  function users(items, { query = '', role = '', status = '', sort = 'newest' } = {}) {
    return items.filter(u => (!query || u.username.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && (!role || u.role === role) && (!status || (u.status || 'active') === status)).sort((a, b) => sort === 'name' ? a.username.localeCompare(b.username, 'zh-CN', { numeric: true }) : sort === 'activity' ? Number(b.feedback_count || 0) + Number(b.reply_count || 0) - Number(a.feedback_count || 0) - Number(a.reply_count || 0) || newest(a, b) : newest(a, b));
  }
  return { timestamp, date, newest, feedbacks, announcements, users };
});
