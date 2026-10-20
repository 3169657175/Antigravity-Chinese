const path = require('path');

const SAFE_NPX_PREFIX_FLAGS = new Set(['-y', '--yes', '--quiet']);
const SHELL_CONTROL_PATTERN = /[&|<>^\r\n]/;

function commandName(command) {
  return path.win32.basename(String(command || '').trim()).toLowerCase();
}

function isCmdCommand(command, comSpec = process.env.ComSpec) {
  const normalized = String(command || '').trim().toLowerCase();
  const allowed = new Set(['cmd', 'cmd.exe']);
  if (comSpec) allowed.add(String(comSpec).trim().toLowerCase());
  return allowed.has(normalized) || commandName(normalized) === 'cmd.exe';
}

function isNpxCommand(command) {
  return ['npx', 'npx.cmd'].includes(commandName(command));
}

function isSafePackageName(value) {
  const packageName = String(value || '');
  const unscoped = /^[a-z0-9][a-z0-9._-]*(?:@[a-z0-9][a-z0-9._-]*)?$/i;
  const scoped = /^@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(?:@[a-z0-9][a-z0-9._-]*)?$/i;
  return unscoped.test(packageName) || scoped.test(packageName);
}

function validateNpxArguments(args) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error('MCP 启动参数中缺少 npm 软件包名称');
  }

  let packageIndex = 0;
  while (packageIndex < args.length && SAFE_NPX_PREFIX_FLAGS.has(args[packageIndex].toLowerCase())) {
    packageIndex += 1;
  }

  const packageName = args[packageIndex];
  if (!isSafePackageName(packageName)) {
    throw new Error('MCP 启动参数中缺少有效的 npm 软件包名称');
  }

  for (const value of args) {
    if (SHELL_CONTROL_PATTERN.test(value)) {
      throw new Error('MCP 启动参数包含不安全的命令控制字符');
    }
  }

  return packageName;
}

function packageVersionPinned(packageName) {
  const value = String(packageName || '');
  const at = value.lastIndexOf('@');
  const version = at > value.indexOf('/') ? value.slice(at + 1) : (!value.startsWith('@') && at > 0 ? value.slice(at + 1) : '');
  return Boolean(version && version.toLowerCase() !== 'latest' && version !== '*');
}

function validateMcpLaunchConfig(config, options = {}) {
  if (!config || typeof config !== 'object') throw new Error('MCP 配置为空');

  const command = String(config.command || '').trim();
  const args = Array.isArray(config.args) ? config.args.map(value => String(value)) : [];
  const comSpec = options.comSpec || process.env.ComSpec || 'cmd.exe';
  let normalizedArgs;
  let packageName;

  if (isNpxCommand(command)) {
    packageName = validateNpxArguments(args);
    normalizedArgs = ['/d', '/s', '/c', 'npx', ...args];
  } else if (isCmdCommand(command, comSpec)) {
    const commandSwitchIndex = args.findIndex(value => value.toLowerCase() === '/c');
    const npxIndex = commandSwitchIndex + 1;
    if (commandSwitchIndex < 0 || !isNpxCommand(args[npxIndex])) {
      throw new Error('为安全起见，cmd.exe 仅允许验证通过 npx 启动的 npm MCP 服务');
    }
    packageName = validateNpxArguments(args.slice(npxIndex + 1));
    normalizedArgs = args;
  } else {
    throw new Error('为安全起见，只允许验证通过 npx 或 cmd.exe 启动的 npm MCP 服务');
  }

  return {
    command: comSpec,
    args: normalizedArgs,
    env: config.env && typeof config.env === 'object' ? config.env : {},
    packageName,
    versionPinned: packageVersionPinned(packageName)
  };
}

module.exports = {
  isSafePackageName,
  packageVersionPinned,
  validateMcpLaunchConfig
};
