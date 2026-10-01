(function exposeOperationFeedback(root) {
  const active = new Map();

  function host() {
    return document.getElementById('operation-toast-host');
  }

  function ensureCard(id, title) {
    if (active.has(id)) return active.get(id);
    const container = host();
    if (!container) return null;
    const card = document.createElement('section');
    card.className = 'operation-toast running';
    card.dataset.operationId = id;
    card.innerHTML = `
      <div class="operation-toast-head">
        <strong></strong><span class="operation-toast-percent">0%</span>
      </div>
      <div class="operation-toast-message"></div>
      <div class="operation-toast-track"><span></span></div>
    `;
    card.querySelector('strong').textContent = title || '正在处理';
    container.prepend(card);
    active.set(id, card);
    return card;
  }

  function update(payload = {}) {
    const id = String(payload.id || 'default');
    // MCP 验证拥有页面内的聚合进度区，避免全局提示遮挡所有页面。
    if (id.startsWith('mcp-')) return;
    const card = ensureCard(id, payload.title);
    if (!card) return;
    const previousPercent = Number(card.dataset.percent) || 0;
    const percent = Math.max(previousPercent, Math.max(0, Math.min(100, Number(payload.percent) || 0)));
    card.dataset.percent = String(percent);
    card.className = `operation-toast ${payload.state || 'running'}`;
    if (payload.title) card.querySelector('strong').textContent = payload.title;
    card.querySelector('.operation-toast-message').textContent = payload.message || '正在处理…';
    card.querySelector('.operation-toast-percent').textContent = `${Math.round(percent)}%`;
    card.querySelector('.operation-toast-track span').style.width = `${percent}%`;
    if (payload.state === 'success' || payload.state === 'error') {
      window.setTimeout(() => {
        card.classList.add('leaving');
        window.setTimeout(() => { card.remove(); active.delete(id); }, 260);
      }, payload.state === 'success' ? 3200 : 7000);
    }
  }

  function begin(id, title, message) { update({ id, title, message, percent: 4, state: 'running' }); }
  function succeed(id, message) { update({ id, message, percent: 100, state: 'success' }); }
  function fail(id, message) { update({ id, message, percent: 100, state: 'error' }); }

  if (root?.agyHubAPI?.onOperationProgress) root.agyHubAPI.onOperationProgress(update);
  root.AgyOperationFeedback = { begin, update, succeed, fail };
})(window);
