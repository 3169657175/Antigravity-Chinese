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

  return { formatTestReport, reportType };
});
