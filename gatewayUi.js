(function exposeGatewayUi(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyGatewayUI = api;
})(typeof window !== 'undefined' ? window : globalThis, function createGatewayUi() {
  function formatTestReport(report) {
    if (!report || !Array.isArray(report.steps)) return '没有可用的测试报告';
    const lines = [`${report.success ? '三级测试全部通过' : '三级测试未完全通过'} · ${report.target || 'gateway'}`];
    report.steps.forEach((step, index) => {
      const icon = step.status === 'passed' ? '✓' : step.status === 'failed' ? '✕' : '–';
      const number = step.id === 'isolation' ? '隔离' : String(index + 1);
      lines.push(`${icon} ${number}. ${step.label}：${step.message}${Number.isFinite(step.durationMs) ? `（${step.durationMs}ms）` : ''}`);
    });
    if (report.id) lines.push(`诊断编号：${report.id}`);
    return lines.join('\n');
  }

  function reportType(report) {
    return report?.success ? 'success' : 'error';
  }

  function normalizeApiBaseUrl(status = {}) {
    const explicit = String(status.baseUrl || '').trim().replace(/\/+$/, '');
    if (explicit) return explicit;
    const host = String(status.host || '127.0.0.1').trim() || '127.0.0.1';
    const port = Number(status.port) || 8046;
    return `http://${host}:${port}/v1`;
  }

  function buildApiAccessView(status = {}, accountLabel = '') {
    const baseUrl = normalizeApiBaseUrl(status);
    const capabilities = status.apiCapabilities && typeof status.apiCapabilities === 'object'
      ? status.apiCapabilities : { protocols: [], routes: [] };
    const protocols = Array.isArray(capabilities.protocols) ? capabilities.protocols.filter(Boolean) : [];
    const routes = Array.isArray(capabilities.routes) ? capabilities.routes.filter(Boolean) : [];
    const entries = Array.isArray(status.antigravityModelEntries) && status.antigravityModelEntries.length
      ? status.antigravityModelEntries
      : (Array.isArray(status.models) ? status.models.map(id => ({ id, label: id, group: '' })) : []);
    const profile = status.profiles?.codexAntigravity || {};
    const defaultModel = String(profile.model || status.codexAntigravityModel || status.model || entries[0]?.id || '').trim();
    const originUrl = baseUrl.replace(/\/v1$/i, '');
    return {
      running: Boolean(status.running),
      host: String(status.host || '127.0.0.1'),
      port: Number(status.port) || 8046,
      baseUrl,
      openaiBaseUrl: baseUrl,
      anthropicBaseUrl: originUrl,
      geminiBaseUrl: `${originUrl}/v1beta`,
      apiKey: String(status.apiKey || ''),
      account: String(accountLabel || profile.accountId || status.codexAntigravityAccountId || status.accountId || '未选择账号'),
      defaultModel,
      protocols: protocols.map(item => ({ id: String(item.id || ''), label: String(item.label || item.id || ''), basePath: String(item.basePath || '') })),
      routes: routes.map(item => ({ method: String(item.method || 'GET').toUpperCase(), path: String(item.path || ''), protocol: String(item.protocol || ''), label: String(item.label || '') })),
      unsupported: Array.isArray(capabilities.unsupported) ? capabilities.unsupported.map(String) : [],
      models: entries.filter(item => item && item.id).map(item => ({ id: String(item.id), label: String(item.label || item.id), group: String(item.group || '') }))
    };
  }

  function formatApiConnectionText(view = {}) {
    const protocols = Array.isArray(view.protocols) ? view.protocols.map(item => item.label).filter(Boolean).join(' / ') : '';
    return [
      `OpenAI Base URL: ${view.openaiBaseUrl || view.baseUrl || ''}`,
      `Anthropic Base URL: ${view.anthropicBaseUrl || ''}`,
      `Gemini Base URL: ${view.geminiBaseUrl || ''}`,
      `API Key: ${view.apiKey || ''}`,
      `协议: ${protocols || '以页面显示为准'}`,
      `模型: ${view.defaultModel || ''}`
    ].join('\n');
  }

  return { formatTestReport, reportType, normalizeApiBaseUrl, buildApiAccessView, formatApiConnectionText };
});
