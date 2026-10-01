const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMcpLaunchConfig } = require('../src/mcpLaunchConfig.js');

const comSpec = 'C:\\Windows\\System32\\cmd.exe';

test('兼容 Antigravity 旧版的直接 npx 配置并转换为 cmd.exe 启动', () => {
  const result = validateMcpLaunchConfig({
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest', '--browserUrl=http://127.0.0.1:9222']
  }, { comSpec });

  assert.equal(result.command, comSpec);
  assert.deepEqual(result.args, [
    '/d', '/s', '/c', 'npx', '-y',
    'chrome-devtools-mcp@latest',
    '--browserUrl=http://127.0.0.1:9222'
  ]);
});

test('兼容 npx.cmd 和带作用域的软件包', () => {
  const result = validateMcpLaunchConfig({
    command: 'npx.cmd',
    args: ['-y', '@google-cloud/cloud-run-mcp']
  }, { comSpec });

  assert.equal(result.command, comSpec);
  assert.equal(result.args[4], '-y');
  assert.equal(result.args[5], '@google-cloud/cloud-run-mcp');
});

test('识别固定版本并标记 latest 为不可审计版本', () => {
  assert.equal(validateMcpLaunchConfig({ command: 'npx', args: ['-y', 'chrome-devtools-mcp@1.6.0'] }).versionPinned, true);
  assert.equal(validateMcpLaunchConfig({ command: 'npx', args: ['-y', 'chrome-devtools-mcp@latest'] }).versionPinned, false);
});

test('保留小助手生成的 cmd.exe /c npx 配置', () => {
  const args = ['/d', '/s', '/c', 'npx', '-y', '@modelcontextprotocol/server-sequential-thinking'];
  const result = validateMcpLaunchConfig({ command: 'cmd.exe', args, env: { TEST_VALUE: '1' } }, { comSpec });

  assert.equal(result.command, comSpec);
  assert.deepEqual(result.args, args);
  assert.deepEqual(result.env, { TEST_VALUE: '1' });
});

test('拒绝非 npx 可执行程序和伪造的 cmd.exe 命令', () => {
  assert.throws(
    () => validateMcpLaunchConfig({ command: 'powershell.exe', args: ['calc.exe'] }, { comSpec }),
    /只允许验证通过 npx/
  );
  assert.throws(
    () => validateMcpLaunchConfig({ command: 'cmd.exe', args: ['/c', 'echo', 'hello'] }, { comSpec }),
    /仅允许验证通过 npx/
  );
});

test('拒绝无效包名和命令控制字符', () => {
  assert.throws(
    () => validateMcpLaunchConfig({ command: 'npx', args: ['-y', '--inspect'] }, { comSpec }),
    /缺少有效的 npm 软件包名称/
  );
  assert.throws(
    () => validateMcpLaunchConfig({ command: 'npx', args: ['-y', 'safe-package', '--value=a&calc'] }, { comSpec }),
    /不安全的命令控制字符/
  );
});
