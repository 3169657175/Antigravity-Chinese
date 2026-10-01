const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { validateMcpLaunchConfig } = require('../src/mcpLaunchConfig.js');

const configPath = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
const hasLiveConfig = fs.existsSync(configPath);
const liveTest = process.env.AGY_MCP_LIVE_TEST === '1' && hasLiveConfig ? test : test.skip;

function probe(config, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const launch = validateMcpLaunchConfig(config);
    const child = spawn(launch.command, launch.args, {
      env: { ...process.env, ...launch.env },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => finish(new Error(`握手超时: ${stderr.slice(-500)}`)), timeoutMs);

    function finish(error, result) {
      clearTimeout(timer);
      if (child.pid) spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
      if (error) reject(error);
      else resolve(result);
    }

    child.on('error', finish);
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
      const lines = stdout.split(/\r?\n/);
      stdout = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim().startsWith('{')) continue;
        try {
          const message = JSON.parse(line);
          if (message.id !== 1) continue;
          if (message.error) return finish(new Error(message.error.message || '握手被拒绝'));
          if (message.result?.serverInfo) return finish(null, message.result.serverInfo);
        } catch (_) {}
      }
    });
    child.on('exit', code => finish(new Error(`进程提前退出: ${code}; ${stderr.slice(-500)}`)));
    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'agy-hub-live-test', version: '1.0.0' }
      }
    })}\n`);
  });
}

const config = hasLiveConfig ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : { mcpServers: {} };
for (const id of ['chrome-devtools-mcp', 'cloudrun', 'sequential-thinking']) {
  liveTest(`${id} 完成真实 MCP initialize 握手`, { timeout: 70000 }, async () => {
    const serverInfo = await probe(config.mcpServers[id]);
    assert.ok(serverInfo.name);
  });
}
