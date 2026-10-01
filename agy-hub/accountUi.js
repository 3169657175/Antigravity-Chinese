(function exposeAccountUi(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyAccountUI = api;
})(typeof window !== 'undefined' ? window : globalThis, function createAccountUi() {
  function failureCopy(result = {}) {
    return {
      title: result.title || '账号状态检查失败',
      message: result.message || '暂时无法确认该账号的实时额度。',
      advice: result.advice || '请稍后重新查询。',
      action: result.action || 'retry',
      actionLabel: result.actionLabel || '重新查询',
      requiresReauth: result.action === 'reauthorize'
    };
  }

  function renderQuotaFailure(options = {}) {
    const { container, row, statusBadgeArea, result, onReauthorize, onRetry } = options;
    if (!container) return;
    const copy = failureCopy(result);
    container.replaceChildren();
    const alert = document.createElement('div');
    alert.className = `account-quota-alert${copy.requiresReauth ? ' reauth' : ''}`;
    const body = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = copy.title;
    const message = document.createElement('p');
    message.textContent = copy.message;
    const advice = document.createElement('small');
    advice.textContent = copy.advice;
    body.append(title, message, advice);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-account-recovery';
    button.textContent = copy.actionLabel;
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (copy.requiresReauth) onReauthorize?.();
      else onRetry?.();
    });
    alert.append(body, button);
    container.appendChild(alert);
    row?.classList.toggle('account-needs-reauth', copy.requiresReauth);
    if (copy.requiresReauth && statusBadgeArea) {
      statusBadgeArea.replaceChildren();
      const badge = document.createElement('span');
      badge.className = 'local-account-badge auth-expired';
      badge.textContent = '需要重新授权';
      statusBadgeArea.appendChild(badge);
    }
  }

  return { failureCopy, renderQuotaFailure };
});
