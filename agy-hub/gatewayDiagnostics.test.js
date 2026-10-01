const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { redact, buildDiagnosticReport, formatDiagnosticReport } = require('./gatewayDiagnostics');

test('diagnostic redaction removes keys, tokens, account ids and prompt content', () => {
  const safe = redact({
    apiKey: 'secret',
    refresh_token: 'refresh',
    accountId: 'account-1',
    baseUrl: 'https://user:pass@example.com/v1?key=secret',
    messages: [{ role: 'user', content: 'private prompt' }]
  });
  assert.equal(safe.apiKey, '[REDACTED]');
  assert.equal(safe.refresh_token, '[REDACTED]');
  assert.match(safe.accountId, /^sha256:/);
  assert.equal(safe.baseUrl, 'https://example.com/v1');
  assert.equal(safe.messages, '[CONTENT OMITTED]');
});

test('builds a readable diagnostic report without exposing local API key', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-diagnostic-'));
  const gateway = {
    logPath: path.join(root, 'codex-gateway.log'),
    status: () => ({
      running: true, host: '127.0.0.1', port: 8046, apiKey: 'secret',
      activeCodexProfile: 'antigravity', profiles: {
        codexAntigravity: { accountId: 'account-1', model: 'gemini-3.1-pro-high' },
        codexCustom: { providerName: 'Sub2API', model: 'gpt-5.6', hasApiKey: true },
        claudeAntigravity: { accountId: 'account-2', model: 'claude-sonnet-4-6' }
      }
    }),
    diagnosticSnapshot: () => ({
      configFingerprint: 'abc123',
      status: gateway.status(),
      lastTestReports: {},
      recentLogs: []
    })
  };
  const report = buildDiagnosticReport({
    gateway, userData: root, codexHome: root, appVersion: '1.1.9', appPath: root,
    executablePath: 'AGY Hub.exe', claudeStatus: {}, tokenMonitorStatus: {}
  });
  const text = formatDiagnosticReport(report);
  assert.doesNotMatch(JSON.stringify(report), /"secret"/);
  assert.match(text, /AGY Hub 脱敏诊断报告/);
  assert.match(text, /1\.1\.9/);
  assert.match(text, /sha256:/);
});
