const { spawn } = require('node:child_process');
const { validateMcpLaunchConfig } = require('./mcpLaunchConfig.js');

// Keep the newest protocol first, but retain compatibility with the versions used
// by older npm servers. MCP servers negotiate the version during initialize.
const MCP_PROTOCOL_VERSIONS = Object.freeze(['2026-07-28', '2025-11-25', '2024-11-05']);
const MCP_PROTOCOL_VERSION = MCP_PROTOCOL_VERSIONS[0];

function validateMcpConfig(config) {
  try {
    const launch = validateMcpLaunchConfig(config);
    return {
      success: true,
      stage: 'config',
      packageName: launch.packageName,
      versionPinned: launch.versionPinned
    };
  } catch (error) {
    return { success: false, stage: 'config', error: error.message };
  }
}

function stopChildTree(child) {
  if (!child || !child.pid) return;
  if (process.platform === 'win32') {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      windowsHide: true,
      stdio: 'ignore'
    });
    killer.unref();
  } else {
    child.kill('SIGTERM');
  }
}

function looksLikeVersionNegotiationError(result) {
  if (!result || result.stage !== 'handshake') return false;
  const text = `${result.error || ''} ${result.details || ''}`.toLowerCase();
  return /protocol|version|unsupported|not supported|initialize/.test(text);
}

function runMcpHandshake(launch, timeoutMs, protocolVersion, onProgress) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(launch.command, launch.args, {
      env: { ...process.env, ...launch.env },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;
    let timer;
    const progressTimer = setInterval(() => {
      const elapsed = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      onProgress({
        stage: 'waiting',
        message: `正在等待 MCP initialize（${protocolVersion}，${elapsed}s / ${Math.round(timeoutMs / 1000)}s）`,
        percent: Math.min(90, 68 + Math.floor(elapsed / 3))
      });
    }, 3000);
    progressTimer.unref?.();

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(progressTimer);
      stopChildTree(child);
      resolve({
        ...result,
        durationMs: Date.now() - startedAt,
        protocolVersionRequested: protocolVersion,
        packageName: launch.packageName,
        versionPinned: launch.versionPinned
      });
    };

    timer = setTimeout(() => {
      finish({
        success: false,
        stage: 'timeout',
        error: `启动超过 ${Math.round(timeoutMs / 1000)} 秒，可能是下载缓慢、缺少依赖或服务未响应`,
        details: stderrBuffer.slice(-600)
      });
    }, timeoutMs);

    child.on('error', (error) => {
      finish({ success: false, stage: 'spawn', error: `无法启动 MCP 进程：${error.message}` });
    });

    child.stderr.on('data', chunk => {
      stderrBuffer += chunk.toString('utf8');
      if (stderrBuffer.length > 4000) stderrBuffer = stderrBuffer.slice(-4000);
      onProgress({ stage: 'download', message: '正在下载或加载 MCP 依赖', percent: 42, details: stderrBuffer.slice(-240) });
    });

    child.stdout.on('data', chunk => {
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;
        try {
          const message = JSON.parse(trimmed);
          if (message.id !== 1) continue;
          if (message.error) {
            finish({
              success: false,
              stage: 'handshake',
              error: message.error.message || 'MCP 初始化被拒绝',
              details: JSON.stringify(message.error).slice(0, 600)
            });
            return;
          }
          if (message.result && message.result.serverInfo) {
            onProgress({ stage: 'ready', message: `MCP initialize 握手通过（${message.result.protocolVersion || protocolVersion}）`, percent: 100 });
            try {
              child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} })}\n`);
            } catch (_) {}
            finish({
              success: true,
              stage: 'ready',
              serverName: message.result.serverInfo.name || 'MCP Server',
              serverVersion: message.result.serverInfo.version || '',
              protocolVersion: message.result.protocolVersion || protocolVersion,
              capabilities: message.result.capabilities || {},
              instructions: typeof message.result.instructions === 'string' ? message.result.instructions.slice(0, 500) : ''
            });
            return;
          }
        } catch (_) {}
      }
    });

    child.on('exit', (code) => {
      if (!settled) {
        finish({
          success: false,
          stage: 'exit',
          error: `MCP 进程在完成握手前退出（代码 ${code ?? 'unknown'}）`,
          details: stderrBuffer.slice(-600)
        });
      }
    });

    onProgress({ stage: 'handshake', message: `进程已启动，正在协商 MCP ${protocolVersion}`, percent: 68 });
    child.stdin.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion,
        capabilities: {},
        clientInfo: { name: 'agy-hub-validator', version: '1.3.2' }
      }
    })}\n`);
  });
}

async function probeMcpServer(config, timeoutMs = 60000, onProgress = () => {}, options = {}) {
  let launch;
  try {
    launch = validateMcpLaunchConfig(config);
  } catch (error) {
    return { success: false, stage: 'config', error: error.message };
  }

  const versions = Array.isArray(options.protocolVersions) && options.protocolVersions.length
    ? options.protocolVersions.map(String)
    : MCP_PROTOCOL_VERSIONS;
  let lastResult = null;
  for (let index = 0; index < versions.length; index += 1) {
    const protocolVersion = versions[index];
    const result = await runMcpHandshake(launch, timeoutMs, protocolVersion, onProgress);
    lastResult = result;
    if (result.success || !looksLikeVersionNegotiationError(result) || index === versions.length - 1) return result;
    onProgress({
      stage: 'negotiation',
      message: `MCP 不支持 ${protocolVersion}，正在回退到兼容协议`,
      percent: 58
    });
  }
  return lastResult || { success: false, stage: 'internal', error: 'MCP 握手没有返回结果' };
}

module.exports = { MCP_PROTOCOL_VERSION, MCP_PROTOCOL_VERSIONS, probeMcpServer, validateMcpConfig };
