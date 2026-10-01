(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyAdminCommunity = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  let state = { users: [], page: 1, selected: null, feedbacks: [], replies: [], sequence: 0, loading: false };
  let context;
  const el = id => document.getElementById(id);
  const text = v => window.AgySafeDom.text(v);
  const data = () => window.AgyCommunityData;
  const allowed = () => context.getUser()?.role === 'admin';
  const request = (url, options) => window.AgyCommunityController.request(url, options);
  function message(value, error = false) { const node = el('admin-user-message'); node.textContent = value; node.classList.toggle('error', error); }
  function filters() { return { query: el('admin-user-search').value, role: el('admin-user-role-filter').value, status: el('admin-user-status-filter').value, sort: el('admin-user-sort').value }; }
  function renderUsers() {
    const rows = data().users(state.users, filters());
    const pages = Math.max(1, Math.ceil(rows.length / 15));
    state.page = Math.min(state.page, pages);
    el('text-admin-users-count').textContent = state.users.length;
    el('admin-user-summary').textContent = `管理员 ${state.users.filter(u => u.role === 'admin').length} · 已禁用 ${state.users.filter(u => u.status === 'disabled').length} · 有反馈 ${state.users.filter(u => Number(u.feedback_count) > 0).length}`;
    el('admin-user-pagination').textContent = `筛选到 ${rows.length} 人 · 第 ${state.page} / ${pages} 页`;
    el('admin-user-prev').disabled = state.page <= 1;
    el('admin-user-next').disabled = state.page >= pages;
    el('admin-users-list-container').innerHTML = rows.length ? `<div class="community-table-scroll"><table class="community-table"><thead><tr><th>用户</th><th>角色 / 状态</th><th>注册时间</th><th>反馈 / 回复</th><th>最近登录</th><th>操作</th></tr></thead><tbody>${rows.slice((state.page - 1) * 15, state.page * 15).map(u => `<tr><td><strong>@${text(u.username)}</strong>${u.username === context.getUser().username ? '<span class="community-tag">当前账号</span>' : ''}</td><td>${u.role === 'admin' ? '管理员' : '普通用户'}<br><span class="community-tag ${u.status === 'disabled' ? 'danger' : ''}">${u.status === 'disabled' ? '已禁用' : '正常'}</span></td><td>${text(data().date(u.created_at))}</td><td class="numeric">${Number(u.feedback_count) || 0} / ${u.reply_count == null ? '未提供' : Number(u.reply_count) || 0}</td><td>${text(data().date(u.last_login_at))}</td><td><button type="button" class="btn btn-secondary" data-manage="${text(u.username)}">查看与管理</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="no-data-tip">没有匹配的用户，请调整筛选条件。</div>';
  }
  async function loadUsers() {
    if (!allowed()) return;
    const sequence = ++state.sequence;
    el('admin-users-list-container').textContent = '正在读取用户…';
    try {
      const res = await request('/api/auth/users'); const payload = await res.json();
      if (sequence !== state.sequence || !allowed()) return;
      if (!res.ok || !Array.isArray(payload)) throw new Error(payload.error || res.error || '读取用户失败');
      state.users = payload; renderUsers();
    } catch (e) { if (sequence === state.sequence) el('admin-users-list-container').textContent = e.message; }
  }
  function renderActivity() {
    const entries = [...state.feedbacks.map(f => ({ ...f, kind: 'feedback', label: '反馈' })), ...state.replies.map(r => ({ ...r, kind: 'reply', label: '回复' }))].sort(data().newest);
    const query = el('admin-activity-search').value.trim().toLocaleLowerCase();
    const type = el('admin-activity-type').value;
    const matching = entries.filter(item => (!type || item.kind === type) && (!query || String(item.content).toLocaleLowerCase().includes(query)));
    el('text-detail-user-stats').textContent = `反馈 ${state.feedbacks.length} · 回复 ${state.replies.length}`;
    el('admin-detail-user-feedbacks').innerHTML = matching.length ? matching.map(item => {
      const image = window.AgySafeDom.imageUrl(item.image_url);
      return `<article class="community-activity"><div class="community-row"><span class="community-tag">${item.label}${item.feedback_id ? ` · 反馈 #${Number(item.feedback_id)}` : ''}</span><time>${text(data().date(item.created_at))}</time><button type="button" class="btn btn-secondary" data-delete-content="${Number(item.id)}" data-kind="${item.kind}">删除${item.label}</button></div><p>${text(item.content)}</p>${image ? `<img src="${text(image)}" alt="反馈截图，点击查看原图" loading="lazy" class="community-thumbnail">` : ''}</article>`;
    }).join('') : '<div class="no-data-tip">没有匹配的反馈或回复。</div>';
  }
  async function showDetail(username) {
    if (!allowed()) return;
    const sequence = ++state.sequence;
    state.selected = state.users.find(u => u.username === username) || { username };
    el('admin-users-list-panel').style.display = 'none'; el('admin-user-detail-panel').style.display = 'block';
    el('text-detail-username').textContent = `@${username}`;
    el('input-detail-new-pass').value = ''; el('admin-user-note').value = '';
    el('admin-user-properties').textContent = '正在读取资料…';
    el('admin-detail-user-feedbacks').textContent = '正在读取反馈与回复…';
    el('admin-user-actions').hidden = true; message('');
    try {
      const res = await request(`/api/auth/users?username=${encodeURIComponent(username)}&detail=true`);
      const result = await res.json();
      if (sequence !== state.sequence || !allowed()) return;
      if (!res.ok) throw new Error(result.error || res.error || '读取用户详情失败');
      const legacy = Array.isArray(result);
      state.selected = legacy ? state.selected : result.user;
      if (!state.selected) throw new Error('用户不存在');
      state.feedbacks = legacy ? result : result.feedbacks || [];
      state.replies = legacy ? [] : result.replies || [];
      const u = state.selected;
      el('admin-user-properties').innerHTML = `<dt>用户名</dt><dd>${text(u.username)}</dd><dt>角色</dt><dd>${u.role === 'admin' ? '管理员' : '普通用户'}</dd><dt>账号状态</dt><dd>${u.status === 'disabled' ? '已禁用' : '正常'}</dd><dt>注册时间</dt><dd>${text(data().date(u.created_at))}</dd><dt>最近登录</dt><dd>${text(data().date(u.last_login_at))}</dd><dt>管理备注</dt><dd>${text(u.admin_note || '无')}</dd>`;
      el('admin-user-actions').hidden = legacy;
      el('admin-clear-content').hidden = legacy;
      el('admin-delete-user').hidden = legacy;
      el('admin-user-note').value = u.admin_note || '';
      el('admin-detail-role').value = u.role || 'user';
      el('admin-toggle-status').textContent = u.status === 'disabled' ? '恢复账号' : '禁用账号';
      el('admin-toggle-status').disabled = u.username === context.getUser().username;
      el('admin-save-role').disabled = u.username === context.getUser().username;
      el('admin-delete-user').disabled = u.username === context.getUser().username;
      if (legacy) message('当前云端仍为旧接口，仅支持密码重置与反馈管理。完整管理需部署配套服务端。');
      renderActivity();
      if (!legacy && result.events?.length) {
        const actions = { disable: '禁用账号', enable: '恢复账号', role: '修改角色', note: '更新备注', delete: '删除账号', 'clear-content': '清理发言', 'reset-password': '重置密码' };
        el('admin-detail-user-feedbacks').insertAdjacentHTML('beforeend', `<details class="community-activity"><summary>最近管理记录（${result.events.length}）</summary>${result.events.map(event => `<p>${text(data().date(event.created_at))} · @${text(event.actor)} · ${text(actions[event.action] || event.action)}</p>`).join('')}</details>`);
      }
    } catch (e) { if (sequence === state.sequence) { message(e.message, true); el('admin-detail-user-feedbacks').textContent = '详情未加载，请返回列表重试。'; } }
  }
  async function mutate(action, extra = {}) {
    if (!allowed() || !state.selected || state.loading) return;
    const username = state.selected.username;
    const labels = { disable: '禁用账号（现有会话将立即失效）', enable: '恢复账号', role: '修改用户角色', delete: '永久删除账号及其反馈、回复和点赞', 'clear-content': '删除该用户的全部反馈、回复和点赞' };
    if (labels[action] && !window.confirm(`确认对 @${username} 执行：${labels[action]}？${['delete', 'clear-content'].includes(action) ? '\n此操作不可撤销。' : ''}`)) return;
    state.loading = true; message('正在保存…');
    document.querySelectorAll('#admin-user-detail-panel button').forEach(b => b.disabled = true);
    try {
      const res = await request('/api/auth/users', { method: 'POST', body: { username, action, ...extra } });
      const result = await res.json(); if (!res.ok || !result.success) throw new Error(result.error || res.error || '操作失败');
      if (action === 'delete') { back(); await loadUsers(); } else { await showDetail(username); message('已保存。'); }
    } catch (e) { message(e.message, true); }
    finally { state.loading = false; document.querySelectorAll('#admin-user-detail-panel button').forEach(b => b.disabled = false); if (state.selected?.username === context.getUser()?.username) ['admin-toggle-status', 'admin-save-role', 'admin-delete-user'].forEach(id => el(id).disabled = true); }
  }
  function back() { ++state.sequence; state.selected = null; el('admin-user-detail-panel').style.display = 'none'; el('admin-users-list-panel').style.display = 'block'; renderUsers(); }
  function init(options) {
    context = options;
    ['admin-user-search', 'admin-user-role-filter', 'admin-user-status-filter', 'admin-user-sort'].forEach(id => el(id).addEventListener('input', () => { state.page = 1; renderUsers(); }));
    el('admin-users-refresh').onclick = loadUsers;
    el('admin-user-prev').onclick = () => { state.page--; renderUsers(); };
    el('admin-user-next').onclick = () => { state.page++; renderUsers(); };
    el('admin-users-list-container').onclick = e => { const button = e.target.closest('[data-manage]'); if (button) showDetail(button.dataset.manage); };
    el('btn-back-to-users').onclick = async () => { back(); await loadUsers(); };
    el('admin-toggle-status').onclick = () => mutate(state.selected.status === 'disabled' ? 'enable' : 'disable');
    el('admin-save-role').onclick = () => mutate('role', { role: el('admin-detail-role').value });
    el('admin-save-note').onclick = () => mutate('note', { note: el('admin-user-note').value });
    el('admin-clear-content').onclick = () => mutate('clear-content');
    el('admin-delete-user').onclick = () => mutate('delete');
    el('admin-activity-search').oninput = renderActivity; el('admin-activity-type').onchange = renderActivity;
    el('btn-submit-detail-reset-pass').onclick = async () => {
      const password = el('input-detail-new-pass').value;
      if (!allowed() || !state.selected || state.loading) return;
      if (password.length < 6) return message('密码至少需要 6 位。', true);
      if (!confirm(`确认重置 @${state.selected.username} 的密码？该用户的现有会话将失效。`)) return;
      state.loading = true; const button = el('btn-submit-detail-reset-pass'); button.disabled = true;
      try { const res = await request('/api/auth/reset-password', { method: 'POST', body: { username: state.selected.username, new_password: password } }); const result = await res.json(); if (!res.ok || !result.success) throw new Error(result.error || res.error || '重置失败'); el('input-detail-new-pass').value = ''; message('密码已重置，请通过安全渠道告知用户新密码。'); } catch (e) { message(e.message, true); } finally { state.loading = false; button.disabled = false; }
    };
    el('admin-detail-user-feedbacks').onclick = async e => {
      const image = e.target.closest('img'); if (image) { el('lightbox-large-img').src = image.src; el('lightbox-modal').style.display = 'flex'; return; }
      const button = e.target.closest('[data-delete-content]');
      if (!button || !allowed() || state.loading || !confirm('确认删除这条内容？删除反馈时会同时删除它的回复和点赞，此操作不可撤销。')) return;
      const username = state.selected.username; state.loading = true; button.disabled = true;
      try { const res = button.dataset.kind === 'feedback' ? await window.agyHubAPI.deleteFeedback(button.dataset.deleteContent) : await request(`/api/reply?id=${encodeURIComponent(button.dataset.deleteContent)}`, { method: 'DELETE' }); const result = res.json ? await res.json() : res; if (!result.success) throw new Error(result.error || res.error || '删除失败'); await showDetail(username); context.refreshFeedbacks(); } catch (e) { message(e.message, true); button.disabled = false; } finally { state.loading = false; }
    };
  }
  return { init, loadUsers, showDetail };
});
