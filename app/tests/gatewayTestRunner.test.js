const test = require('node:test');
const assert = require('node:assert/strict');
const { executeStep, finishReport } = require('../src/gatewayTestRunner');

test('three-level report keeps ordered pass/fail details', async () => {
  const report = { startedAt: new Date().toISOString(), steps: [] };
  await executeStep(report, 'network', '网络', async () => ({ message: '端口正常', details: { status: 200 } }));
  await executeStep(report, 'model', '模型', async () => { throw new Error('QUOTA_EXHAUSTED'); });
  assert.equal(report.steps.length, 2);
  assert.equal(report.steps[0].status, 'passed');
  assert.equal(report.steps[1].status, 'failed');
  assert.equal(report.steps[1].details.code, 'quota_exhausted');
});

test('finishReport rejects a test that mutates gateway configuration', () => {
  const gateway = { config: { mode: 'custom' } };
  const report = { startedAt: new Date().toISOString(), steps: [
    { id: 'network', label: '网络', status: 'passed', durationMs: 1, message: 'ok', details: {} }
  ] };
  const final = finishReport(report, JSON.stringify({ mode: 'antigravity' }), gateway);
  assert.equal(final.success, false);
  assert.equal(final.configPreserved, false);
  assert.equal(final.steps.at(-1).id, 'isolation');
});
