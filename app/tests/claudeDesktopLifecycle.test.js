const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const {
  buildWindowsLifecycleScript,
  parseLifecycleOutput,
  restartOrLaunchClaudeDesktop
} = require('../src/claudeDesktopLifecycle.js');

test('Claude Desktop 生命周期脚本支持应用注册、可执行文件和快捷方式发现', () => {
  const script = buildWindowsLifecycleScript();
  assert.match(script, /Get-AppxPackage/);
  assert.match(script, /Get-StartApps/);
  assert.match(script, /Programs\\Claude\\Claude\.exe/);
  assert.match(script, /Filter '\*\.lnk'/);
  assert.match(script, /shell:AppsFolder/);
  assert.doesNotMatch(script, /C:\\Users\\niu/i);
});

test('脚本只识别 Claude Desktop，并明确排除 AGY Hub、Codex 和 Antigravity', () => {
  const script = buildWindowsLifecycleScript();
  assert.match(script, /agy-hub\|Codex\|ChatGPT\|Antigravity/);
  assert.match(script, /Test-ClaudeDesktopProcess/);
  assert.match(script, /CloseMainWindow/);
  assert.match(script, /Stop-Process -Force/);
});

test('生成的 Windows PowerShell 生命周期脚本可被解析', async () => {
  if (process.platform !== 'win32') return;
  await new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', '[void][scriptblock]::Create($env:AGY_CLAUDE_LIFECYCLE_SCRIPT)'],
      {
        windowsHide: true,
        timeout: 10000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, AGY_CLAUDE_LIFECYCLE_SCRIPT: buildWindowsLifecycleScript() }
      },
      (error, stdout, stderr) => error
        ? reject(new Error(String(stderr || stdout || error.message)))
        : resolve()
    );
  });
});

test('解析生命周期命令最后一行 JSON', () => {
  assert.deepEqual(
    parseLifecycleOutput('提示\r\n{"success":true,"wasRunning":true,"action":"restarted"}\r\n'),
    { success: true, wasRunning: true, action: 'restarted' }
  );
});

test('模拟 Claude 正在运行时返回 restarted，不执行真实 PowerShell', async () => {
  let invocation;
  const result = await restartOrLaunchClaudeDesktop({
    platform: 'win32',
    execFileImpl(command, args, options, callback) {
      invocation = { command, args, options };
      callback(null, '{"success":true,"wasRunning":true,"action":"restarted","launchMethod":"shortcut"}', '');
    }
  });
  assert.equal(invocation.command, 'powershell.exe');
  assert.equal(invocation.options.windowsHide, true);
  assert.equal(result.action, 'restarted');
  assert.equal(result.wasRunning, true);
});

test('模拟 Claude 未运行时返回 launched', async () => {
  const result = await restartOrLaunchClaudeDesktop({
    platform: 'win32',
    execFileImpl(_command, _args, _options, callback) {
      callback(null, '{"success":true,"wasRunning":false,"action":"launched","launchMethod":"app-id"}', '');
    }
  });
  assert.equal(result.action, 'launched');
  assert.equal(result.wasRunning, false);
});

test('未找到 Claude Desktop 时返回结构化 not-found 结果', async () => {
  const result = await restartOrLaunchClaudeDesktop({
    platform: 'win32',
    execFileImpl(_command, _args, _options, callback) {
      callback(new Error('exit 2'), '{"success":false,"action":"not-found","error":"未找到 Claude Desktop"}', '');
    }
  });
  assert.deepEqual(result, { success: false, action: 'not-found', error: '未找到 Claude Desktop' });
});

test('非 Windows 平台不会调用进程命令', async () => {
  let called = false;
  const result = await restartOrLaunchClaudeDesktop({
    platform: 'linux',
    execFileImpl() { called = true; }
  });
  assert.equal(called, false);
  assert.equal(result.success, false);
  assert.equal(result.action, 'failed');
});
