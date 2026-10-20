const test = require('node:test');
const assert = require('node:assert/strict');
const { formatTestReport, reportType } = require('../src/gatewayUi');

test('formats three-level results into readable Chinese text', () => {
  const text = formatTestReport({
    success: false,
    target: 'codex-antigravity',
    id: 'diag_1',
    steps: [
      { id: 'network', label: '第 1 级：端口与鉴权', status: 'passed', message: '正常', durationMs: 5 },
      { id: 'model', label: '第 2 级：模型响应', status: 'failed', message: '额度不足', durationMs: 10 }
    ]
  });
  assert.match(text, /三级测试未完全通过/);
  assert.match(text, /✓ 1\./);
  assert.match(text, /✕ 2\./);
  assert.match(text, /diag_1/);
  assert.equal(reportType({ success: false }), 'error');
});
