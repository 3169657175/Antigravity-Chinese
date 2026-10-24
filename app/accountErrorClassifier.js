function parsePayload(value) {
  const text = String(value?.message || value || '');
  const jsonStart = text.indexOf('{');
  if (jsonStart >= 0) {
    try { return { text, payload: JSON.parse(text.slice(jsonStart)) }; } catch (_) {}
  }
  return { text, payload: null };
}

function classifyAccountError(error) {
  const { text, payload } = parsePayload(error);
  const upstreamCode = String(payload?.error || payload?.code || '').toLowerCase();
  const upstreamDescription = String(payload?.error_description || payload?.message || '');
  const combined = `${upstreamCode} ${upstreamDescription} ${text}`.toLowerCase();

  if (/invalid_grant|invalid_rapt|token.*(?:expired|revoked)|reauth|login required/.test(combined)) {
    return {
      code: 'ACCOUNT_REAUTH_REQUIRED',
      title: '账号授权已失效',
      message: 'Google 已拒绝当前账号的登录凭据，无法继续查询额度或调用模型。',
      advice: '请点击“重新登录授权”，在浏览器中使用这个 Google 账号完成授权。重新授权不会自动删除其他账号。',
      action: 'reauthorize',
      actionLabel: '重新登录授权',
      retryable: false,
      diagnosticCode: upstreamCode || 'invalid_grant'
    };
  }

  if (/无有效刷新令牌|凭证文件缺失|decrypt|凭据不可用/.test(combined)) {
    return {
      code: 'ACCOUNT_CREDENTIAL_MISSING',
      title: '账号凭据不可用',
      message: '本地没有找到可使用的账号授权信息。',
      advice: '请重新登录授权，或从有效的账号配置文件重新导入。',
      action: 'reauthorize',
      actionLabel: '重新登录授权',
      retryable: false,
      diagnosticCode: 'credential_missing'
    };
  }

  if (/network|fetch failed|econn|socket|timeout|timed out|连接/.test(combined)) {
    return {
      code: 'ACCOUNT_NETWORK_ERROR',
      title: '账号服务暂时无法连接',
      message: '当前没有成功连接到 Google 账号或额度服务。',
      advice: '请检查网络后重试。如果只有这个账号持续失败，再尝试重新登录授权。',
      action: 'retry',
      actionLabel: '重新查询',
      retryable: true,
      diagnosticCode: 'network_error'
    };
  }

  if (/quota response is incomplete|quota|额度/.test(combined)) {
    return {
      code: 'ACCOUNT_QUOTA_UNAVAILABLE',
      title: '额度信息暂不可用',
      message: '账号登录状态正常，但上游没有返回完整额度数据。',
      advice: '这通常是上游接口短暂波动，可以稍后重新查询。',
      action: 'retry',
      actionLabel: '重新查询',
      retryable: true,
      diagnosticCode: 'quota_unavailable'
    };
  }

  return {
    code: 'ACCOUNT_UNKNOWN_ERROR',
    title: '账号状态检查失败',
    message: '暂时无法确认该账号的实时额度。',
    advice: '请先重新查询；如果持续失败，可复制一键诊断报告后再重新登录授权。',
    action: 'retry',
    actionLabel: '重新查询',
    retryable: true,
    diagnosticCode: 'unknown'
  };
}

module.exports = { parsePayload, classifyAccountError };
