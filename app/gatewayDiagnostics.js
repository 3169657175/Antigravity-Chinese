const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SECRET_PATTERN = /api.?key|authorization|bearer|refresh.?token|access.?token|client.?secret|password|credential/i;
const ACCOUNT_PATTERN = /account.?id/i;

function shortHash(value) {
  if (!value) return '';
  return `sha256:${crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12)}`;
}

function sanitizeUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(String(value));
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return String(value).slice(0, 180);
  }
}

function redact(value, key = '', depth = 0) {
  if (depth > 8) return '[depth-limited]';
  if (SECRET_PATTERN.test(key)) return value ? '[REDACTED]' : '';
  if (ACCOUNT_PATTERN.test(key)) return shortHash(value);
  if (Array.isArray(value)) return value.slice(0, 100).map(item => redact(item, key, depth + 1));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      if (/input|messages|content|prompt|text/i.test(childKey) && typeof childValue !== 'number') {
        output[childKey] = '[CONTENT OMITTED]';
      } else if (/url|baseUrl/i.test(childKey)) {
        output[childKey] = sanitizeUrl(childValue);
      } else {
        output[childKey] = redact(childValue, childKey, depth + 1);
      }
    }
    return output;
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

function fileInfo(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { exists: true, path: filePath, size: stat.size, modifiedAt: stat.mtime.toISOString() };
  } catch (_) {
    return { exists: false, path: filePath };
  }
}

function recentJsonLines(filePath, limit = 50) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    return text.trim().split(/\r?\n/).slice(-Math.max(1, Math.min(200, limit))).map(line => {
      try { return redact(JSON.parse(line)); } catch (_) { return { event: 'unparsed', message: line.slice(0, 300) }; }
    });
  } catch (_) {
    return [];
  }
}

function compactClaudeStatus(status = {}) {
  return redact({
    connected: Boolean(status.connected),
    configured: Boolean(status.configured),
    active: Boolean(status.active),
    actualBaseUrl: status.actualBaseUrl || '',
    runtimeBaseUrl: status.runtimeBaseUrl || '',
    modelCatalogReady: Boolean(status.modelCatalogReady),
    registryPath: status.registryPath || '',
    profilePath: status.profilePath || '',
    metaPath: status.metaPath || '',
    model: status.model || ''
  });
}

function buildDiagnosticReport(options = {}) {
  const gateway = options.gateway;
  const status = gateway.status();
  const userData = options.userData;
  const codexHome = options.codexHome;
  const snapshot = typeof gateway.diagnosticSnapshot === 'function'
    ? gateway.diagnosticSnapshot(options.logLimit || 50)
    : { status, recentLogs: recentJsonLines(gateway.logPath, options.logLimit || 50) };
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    application: {
      name: 'AGY Hub 桌面管家',
      version: options.appVersion || '',
      appPath: options.appPath || '',
      executablePath: options.executablePath || '',
      userData,
      platform: process.platform,
      arch: process.arch,
      node: process.versions.node,
      electron: process.versions.electron || ''
    },
    gateway: redact(snapshot),
    configurationFiles: {
      gateway: fileInfo(path.join(userData, 'codex-gateway.json')),
      gatewayLog: fileInfo(path.join(userData, 'codex-gateway.log')),
      providerProfiles: fileInfo(path.join(userData, 'codex-provider-profiles.json')),
      codexConnectionState: fileInfo(path.join(userData, 'codex-connection.json')),
      claudeConnectionState: fileInfo(path.join(userData, 'claude-desktop-connection.json')),
      tokenStats: fileInfo(path.join(userData, 'token_stats.json')),
      codexConfig: fileInfo(path.join(codexHome, 'config.toml')),
      codexAuth: { ...fileInfo(path.join(codexHome, 'auth.json')), sensitive: true }
    },
    claudeDesktop: compactClaudeStatus(options.claudeStatus),
    tokenMonitor: redact(options.tokenMonitorStatus || {})
  };
  return report;
}

function line(label, value) {
  return `${label}：${value === '' || value === undefined ? '无' : value}`;
}

function formatDiagnosticReport(report) {
  const gateway = report.gateway?.status || report.gateway || {};
  const profiles = gateway.profiles || {};
  const codexAgy = profiles.codexAntigravity || {};
  const custom = profiles.codexCustom || {};
  const claude = profiles.claudeAntigravity || {};
  const last = gateway.lastRequest || {};
  const tests = report.gateway?.lastTestReports || {};
  const lines = [
    'AGY Hub 脱敏诊断报告',
    line('生成时间', report.generatedAt),
    line('应用版本', report.application.version),
    line('应用目录', report.application.appPath),
    line('运行程序', report.application.executablePath),
    line('用户数据目录', report.application.userData),
    '',
    '[本地网关]',
    line('运行状态', gateway.running ? '运行中' : '已停止'),
    line('监听地址', `${gateway.host || '127.0.0.1'}:${gateway.port || '--'}`),
    line('Codex 当前路由', gateway.activeCodexProfile || gateway.mode || '--'),
    line('配置指纹', report.gateway?.configFingerprint || '--'),
    '',
    '[独立 Profile]',
    line('Codex Antigravity', `${codexAgy.model || '--'} / ${codexAgy.accountId || '未选账号'}`),
    line('Codex Custom', `${custom.providerName || '--'} / ${custom.model || '--'} / Key ${custom.hasApiKey ? '已保存' : '未保存'}`),
    line('Claude Antigravity', `${claude.model || '--'} / ${claude.accountId || '未选账号'}`),
    '',
    '[最近请求]',
    line('请求 ID', last.id || '--'),
    line('类型', last.kind || '--'),
    line('状态', last.status || '--'),
    line('模型', last.model || '--'),
    line('完成时间', last.completedAt || '--'),
    line('错误', last.error || '无'),
    '',
    '[最近三级测试]',
    line('Codex', tests['codex-antigravity']?.summary || '尚未执行'),
    line('自定义 Provider', tests['codex-custom']?.summary || '尚未执行'),
    line('Claude Code', tests['claude-antigravity']?.summary || '尚未执行'),
    '',
    '[配置落盘]',
    ...Object.entries(report.configurationFiles).map(([name, info]) => line(name, info.exists ? `${info.path}（${info.size} 字节）` : `不存在：${info.path}`)),
    '',
    '[Claude Desktop]',
    line('连接状态', report.claudeDesktop.connected ? '已连接' : '未连接'),
    line('实际地址', report.claudeDesktop.actualBaseUrl || '--'),
    line('内部中转', report.claudeDesktop.runtimeBaseUrl || '--'),
    line('模型列表', report.claudeDesktop.modelCatalogReady ? '已就绪' : '未就绪'),
    '',
    `最近脱敏日志：${Array.isArray(report.gateway?.recentLogs) ? report.gateway.recentLogs.length : 0} 条`,
    '说明：账号已哈希，API Key、Token、Authorization 和对话正文已移除。'
  ];
  return lines.join('\n');
}

module.exports = {
  shortHash,
  sanitizeUrl,
  redact,
  fileInfo,
  recentJsonLines,
  buildDiagnosticReport,
  formatDiagnosticReport
};
