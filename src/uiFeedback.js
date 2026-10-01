(function exposeUiFeedback(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyUiFeedback = api;
})(typeof window !== 'undefined' ? window : globalThis, function createUiFeedback(root) {
  function toast(message, type = 'info', options = {}) {
    if (typeof document === 'undefined') return null;
    const host = document.getElementById('operation-toast-host');
    if (!host) return null;
    const card = document.createElement('section');
    card.className = `operation-toast ${type === 'error' ? 'error' : type === 'success' ? 'success' : 'running'} ui-toast`;
    card.innerHTML = '<div class="operation-toast-head"><strong></strong><span class="operation-toast-percent"></span></div><div class="operation-toast-message"></div>';
    card.querySelector('strong').textContent = options.title || (type === 'error' ? '操作失败' : type === 'success' ? '操作完成' : '提示');
    card.querySelector('.operation-toast-message').textContent = String(message || '');
    host.prepend(card);
    const lifetime = Number(options.durationMs) || (type === 'error' ? 6500 : 2800);
    root?.setTimeout?.(() => { card.classList.add('leaving'); root?.setTimeout?.(() => card.remove(), 260); }, lifetime);
    return card;
  }
  function begin(id, title, message) { root?.AgyOperationFeedback?.begin?.(id, title, message); }
  function succeed(id, message) { root?.AgyOperationFeedback?.succeed?.(id, message); }
  function fail(id, message) { root?.AgyOperationFeedback?.fail?.(id, message); }
  function confirm(message, options = {}) {
    if (typeof document === 'undefined' || !document.body) return Promise.resolve(root?.confirm ? root.confirm(message) : false);
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'agy-confirm-overlay';
      overlay.innerHTML = '<section class="agy-confirm-dialog" role="dialog" aria-modal="true"><strong class="agy-confirm-title"></strong><p class="agy-confirm-message"></p><div class="agy-confirm-actions"><button type="button" class="btn btn-secondary" data-confirm="cancel">取消</button><button type="button" class="btn btn-primary" data-confirm="ok"></button></div></section>';
      overlay.querySelector('.agy-confirm-title').textContent = options.title || '请确认操作';
      overlay.querySelector('.agy-confirm-message').textContent = String(message || '');
      const ok = overlay.querySelector('[data-confirm="ok"]');
      ok.textContent = options.okText || '确认';
      if (options.danger) ok.classList.add('danger');
      const finish = value => { overlay.remove(); resolve(value); };
      overlay.addEventListener('click', event => {
        if (event.target === overlay || event.target.closest('[data-confirm="cancel"]')) finish(false);
        if (event.target.closest('[data-confirm="ok"]')) finish(true);
      });
      document.body.appendChild(overlay);
      ok.focus();
    });
  }
  return { toast, notify: toast, begin, succeed, fail, confirm };
});
