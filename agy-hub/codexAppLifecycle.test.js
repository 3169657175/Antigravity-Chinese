const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildWindowsLifecycleScript,
  parseLifecycleOutput,
  restartOrLaunchCodex
} = require('./codexAppLifecycle.js');

test('Windows 脚本通过运行时包信息识别 Codex，不包含用户绝对路径', () => {
  const script = buildWindowsLifecycleScript();
  assert.match(script, /Get-AppxPackage -Name 'OpenAI\.Codex'/);
  assert.match(script, /PackageFamilyName/);
  assert.match(script, /shell:AppsFolder/);
  assert.doesNotMatch(script, /C:\\Users\\niu/i);
});

test('解析生命周期命令最后一行 JSON', () => {
  assert.deepEqual(
    parseLifecycleOutput('提示信息\r\n{"success":true,"wasRunning":true,"action":"restarted"}\r\n'),
    { success: true, wasRunning: true, action: 'restarted' }
  );
});

test('模拟正在运行时返回 restarted，不执行真实 PowerShell', async () => {
  let invocation;
  const result = await restartOrLaunchCodex({
    platform: 'win32',
    execFileImpl(command, args, options, callback) {
      invocation = { command, args, options };
      callback(null, '{"success":true,"wasRunning":true,"action":"restarted","appId":"OpenAI.Codex_test!App"}', '');
    }
  });
  assert.equal(invocation.command, 'powershell.exe');
  assert.equal(invocation.options.windowsHide, true);
  assert.equal(result.action, 'restarted');
  assert.equal(result.wasRunning, true);
});

test('模拟未运行时返回 launched，不执行真实启动命令', async () => {
  const result = await restartOrLaunchCodex({
    platform: 'win32',
    execFileImpl(_command, _args, _options, callback) {
      callback(null, '{"success":true,"wasRunning":false,"action":"launched"}', '');
    }
  });
  assert.equal(result.action, 'launched');
  assert.equal(result.wasRunning, false);
});

test('生命周期失败作为结构化结果返回', async () => {
  const result = await restartOrLaunchCodex({
    platform: 'win32',
    execFileImpl(_command, _args, _options, callback) {
      callback(new Error('exit 1'), '{"success":false,"error":"未找到已安装的 Codex 应用"}', '');
    }
  });
  assert.deepEqual(result, { success: false, error: '未找到已安装的 Codex 应用' });
});

test('非 Windows 平台不会调用进程命令', async () => {
  let called = false;
  const result = await restartOrLaunchCodex({
    platform: 'linux',
    execFileImpl() { called = true; }
  });
  assert.equal(called, false);
  assert.equal(result.success, false);
});
