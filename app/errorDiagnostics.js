(function exposeErrorDiagnostics(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyErrorDiagnostics = api;
})(typeof window !== 'undefined' ? window : globalThis, function createErrorDiagnostics() {
  function classify(input) {
    const code = String(input?.code || '').toUpperCase();
    const message = String(input?.message || input?.error || input || '').trim();
    if (['AUTH_REQUIRED', 'AUTH_EXPIRED'].includes(code) || /登录|token|授权.*失效|401/i.test(message)) {
      return { category: 'auth', title: '登录状态异常', message: message || '请重新登录后再试', retryable: false, action: '重新登录后重试' };
    }
    if (code === 'RATE_LIMITED' || /429|频繁|rate.?limit/i.test(message)) {
      return { category: 'rate-limit', title: '请求过于频繁', message: message || '请稍后再试', retryable: true, action: '稍后重试' };
    }
    if (['TIMEOUT', 'NETWORK_ERROR'].includes(code) || /timeout|timed out|网络|无法连接|ENOTFOUND|ECONN/i.test(message)) {
      return { category: 'network', title: '网络连接异常', message: message || '请检查网络后重试', retryable: true, action: '检查网络并重试' };
    }
    if (code === 'PERMISSION_DENIED' || /403|权限|forbidden/i.test(message)) {
      return { category: 'permission', title: '权限不足', message: message || '当前账号无权执行此操作', retryable: false, action: '检查账号权限' };
    }
    if (code === 'SERVER_UNAVAILABLE' || /50\d|server|服务.*不可用/i.test(message)) {
      return { category: 'server', title: '服务暂时不可用', message: message || '服务端暂时不可用', retryable: true, action: '稍后重试' };
    }
    return { category: 'unknown', title: '操作失败', message: message || '发生未知错误', retryable: true, action: '重试；如仍失败请复制诊断信息' };
  }
  function format(input) {
    const result = classify(input);
    return `${result.message}${result.action ? ` · ${result.action}` : ''}`;
  }
  return { classify, format };
});
