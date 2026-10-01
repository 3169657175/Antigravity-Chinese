const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { CLAUDE_MODEL_ROUTES, routeForClaudeModel, claudePickerModels } = require('./claudeModelRoutes');

const PROFILE_ID = '00000000-0000-4000-8000-000000008046';
const PROFILE_NAME = 'AGY Hub';
const STATE_FILE = 'claude-desktop-connection.json';
const REGISTRY_KEY = 'SOFTWARE\\Policies\\Claude';
const MANAGED_VALUE_TYPES = {
  inferenceProvider: 'REG_SZ',
  inferenceGatewayBaseUrl: 'REG_SZ',
  inferenceGatewayApiKey: 'REG_SZ',
  inferenceGatewayAuthScheme: 'REG_SZ',
  inferenceCredentialKind: 'REG_SZ',
  inferenceModels: 'REG_SZ'
};

function pathsFor(options = {}) {
  const localAppData = options.localAppData || process.env.LOCALAPPDATA
    || path.join(options.homeDir || process.env.USERPROFILE || '', 'AppData', 'Local');
  const normalDir = path.join(localAppData, 'Claude');
  const threepDir = path.join(localAppData, 'Claude-3p');
  const libraryDir = path.join(threepDir, 'configLibrary');
  return {
    normalConfig: path.join(normalDir, 'claude_desktop_config.json'),
    threepConfig: path.join(threepDir, 'claude_desktop_config.json'),
    threepDir,
    libraryDir,
    profilePath: path.join(libraryDir, `${PROFILE_ID}.json`),
    metaPath: path.join(libraryDir, '_meta.json'),
    statePath: path.join(options.stateDir || localAppData, STATE_FILE)
  };
}

function parseJsonObject(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback === null ? null : { ...fallback };
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  if (!text.trim()) return fallback === null ? null : { ...fallback };
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`Claude Desktop 配置不是有效 JSON：${file}\n${error.message}`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback === null ? null : { ...fallback };
  }
  return value;
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.agy-tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, file);
}

function readState(statePath) {
  try { return parseJsonObject(statePath, null); } catch (_) { return null; }
}

function registryPath(hive) {
  return `${hive}\\${REGISTRY_KEY}`;
}

function parseRegistryQuery(stdout, valueName) {
  const escaped = valueName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(stdout || '').match(new RegExp(`^\\s*${escaped}\\s+(REG_[A-Z_]+)\\s+(.*)$`, 'mi'));
  return match ? { existed: true, type: match[1], value: match[2].trim() } : { existed: false };
}

function createRegistry(options = {}) {
  if (options.registry) return options.registry;
  const run = options.spawnSyncImpl || spawnSync;
  const platform = options.platform || process.platform;
  return {
    read(hive, name) {
      if (platform !== 'win32') return { existed: false };
      const result = run('reg.exe', ['query', registryPath(hive), '/v', name], {
        encoding: 'utf8', windowsHide: true, timeout: 5000
      });
      if (result.status !== 0) return { existed: false };
      return parseRegistryQuery(result.stdout, name);
    },
    write(hive, name, type, value) {
      if (platform !== 'win32') throw new Error('Claude Desktop 托管配置目前仅支持 Windows');
      const result = run('reg.exe', [
        'add', registryPath(hive), '/v', name, '/t', type, '/d', String(value), '/f'
      ], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
      if (result.status !== 0) throw new Error(`写入 Claude 托管配置失败：${name}`);
    },
    remove(hive, name) {
      if (platform !== 'win32') return;
      const result = run('reg.exe', ['delete', registryPath(hive), '/v', name, '/f'], {
        encoding: 'utf8', windowsHide: true, timeout: 5000
      });
      if (result.status !== 0 && this.read(hive, name).existed) {
        throw new Error(`恢复 Claude 托管配置失败：${name}`);
      }
    }
  };
}

function readManagedValues(registry, hive) {
  const result = {};
  for (const name of Object.keys(MANAGED_VALUE_TYPES)) result[name] = registry.read(hive, name);
  return result;
}

function existingValueCount(values) {
  return Object.values(values).filter(entry => entry && entry.existed).length;
}

function effectiveManagedConfig(registry) {
  const hklm = readManagedValues(registry, 'HKLM');
  if (existingValueCount(hklm)) return { hive: 'HKLM', values: hklm };
  const hkcu = readManagedValues(registry, 'HKCU');
  if (existingValueCount(hkcu)) return { hive: 'HKCU', values: hkcu };
  return { hive: '', values: {} };
}

function snapshotFiles(paths, backupDir) {
  const entries = [
    ['normalConfig', paths.normalConfig, 'claude-normal.json'],
    ['threepConfig', paths.threepConfig, 'claude-3p.json'],
    ['profile', paths.profilePath, 'profile.json'],
    ['meta', paths.metaPath, 'meta.json']
  ];
  fs.mkdirSync(backupDir, { recursive: true });
  const snapshots = {};
  for (const [key, source, backupName] of entries) {
    const existed = fs.existsSync(source);
    const backupPath = path.join(backupDir, backupName);
    if (existed) fs.copyFileSync(source, backupPath);
    snapshots[key] = { path: source, existed, backupPath };
  }
  return snapshots;
}

function snapshotRegistry(registry) {
  return {
    key: registryPath('HKCU'),
    hive: 'HKCU',
    values: readManagedValues(registry, 'HKCU')
  };
}

function ensureBackup(paths, stateDir, registry) {
  const existing = readState(paths.statePath);
  if (existing && existing.snapshots && existing.backupDir && fs.existsSync(existing.backupDir)) {
    if (!existing.registrySnapshot) existing.registrySnapshot = snapshotRegistry(registry);
    return existing;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(stateDir, 'claude-desktop-backups', stamp);
  return {
    version: 2,
    profileId: PROFILE_ID,
    backupDir,
    snapshots: snapshotFiles(paths, backupDir),
    registrySnapshot: snapshotRegistry(registry),
    createdAt: new Date().toISOString()
  };
}

function writeDeploymentMode(file, mode) {
  const config = parseJsonObject(file);
  config.deploymentMode = mode;
  atomicWriteJson(file, config);
}

function profileFor(baseUrl, apiKey, model = 'claude-sonnet-4-6', models) {
  return {
    coworkEgressAllowedHosts: ['*'],
    disableDeploymentModeChooser: true,
    inferenceGatewayApiKey: apiKey,
    inferenceGatewayAuthScheme: 'bearer',
    inferenceCredentialKind: 'static',
    inferenceGatewayBaseUrl: baseUrl,
    inferenceProvider: 'gateway',
    inferenceModels: claudePickerModels(model, models)
  };
}

function advertisedClaudeRoute(model) {
  return routeForClaudeModel(model);
}

function activateProfile(metaPath) {
  const meta = parseJsonObject(metaPath);
  const entries = Array.isArray(meta.entries) ? meta.entries.filter(item => item && item.id !== PROFILE_ID) : [];
  entries.push({ id: PROFILE_ID, name: PROFILE_NAME });
  meta.appliedId = PROFILE_ID;
  meta.entries = entries;
  delete meta.activeProfileId;
  atomicWriteJson(metaPath, meta);
}

function normalizeBaseUrl(value) {
  const url = new URL(String(value || ''));
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('Claude Desktop 本地接入地址必须是 http://127.0.0.1 或 localhost');
  }
  return url.toString().replace(/\/$/, '');
}

function writeManagedConfig(registry, baseUrl, apiKey, model, models) {
  const values = {
    inferenceProvider: 'gateway',
    inferenceGatewayBaseUrl: baseUrl,
    inferenceGatewayApiKey: apiKey,
    inferenceGatewayAuthScheme: 'bearer',
    inferenceCredentialKind: 'static',
    inferenceModels: JSON.stringify(claudePickerModels(model, models))
  };
  for (const [name, value] of Object.entries(values)) {
    registry.write('HKCU', name, MANAGED_VALUE_TYPES[name], value);
  }
}

function connectClaudeDesktop(options = {}) {
  const stateDir = options.stateDir;
  if (!stateDir) throw new Error('缺少 Claude Desktop 备份目录');
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const apiKey = String(options.apiKey || '').trim();
  if (!apiKey) throw new Error('缺少本地网关 API Key');
  const paths = pathsFor(options);
  const registry = createRegistry(options);
  const effectiveBefore = effectiveManagedConfig(registry);
  if (effectiveBefore.hive === 'HKLM') {
    throw new Error(`Claude 正由 ${registryPath('HKLM')} 管理，当前用户配置无法覆盖，请先移除或修改系统级策略`);
  }
  const state = ensureBackup(paths, stateDir, registry);

  writeDeploymentMode(paths.normalConfig, '3p');
  writeDeploymentMode(paths.threepConfig, '3p');
  const model = String(options.model || 'claude-sonnet-4-6');
  const models = Array.isArray(options.models) ? options.models : undefined;
  atomicWriteJson(paths.profilePath, profileFor(baseUrl, apiKey, model, models));
  activateProfile(paths.metaPath);
  writeManagedConfig(registry, baseUrl, apiKey, model, models);

  state.version = 2;
  state.baseUrl = baseUrl;
  state.model = model;
  state.profilePath = paths.profilePath;
  state.metaPath = paths.metaPath;
  state.registryPath = registryPath('HKCU');
  state.updatedAt = new Date().toISOString();
  atomicWriteJson(paths.statePath, state);
  return {
    baseUrl,
    profileId: PROFILE_ID,
    profilePath: paths.profilePath,
    metaPath: paths.metaPath,
    registryPath: state.registryPath,
    backupDir: state.backupDir,
    requiresRestart: true
  };
}

function latestHostCredentials(paths) {
  if (!fs.existsSync(paths.threepDir)) return null;
  const candidates = fs.readdirSync(paths.threepDir)
    .filter(name => /^host-creds(?:-[\w-]+)?\.json$/.test(name))
    .map(name => {
      const file = path.join(paths.threepDir, name);
      return { file, mtimeMs: fs.statSync(file).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (!candidates.length) return null;
  try {
    const value = parseJsonObject(candidates[0].file, null);
    return value ? { ...candidates[0], ...value } : null;
  } catch (_) {
    return null;
  }
}

function managedModelNames(rawValue) {
  try {
    const parsed = JSON.parse(String(rawValue || ''));
    if (!Array.isArray(parsed)) return [];
    return parsed.map(entry => typeof entry === 'string' ? entry : entry && entry.name).filter(Boolean);
  } catch (_) {
    return [];
  }
}

function defaultTcpProbe(baseUrl, options = {}) {
  if ((options.platform || process.platform) !== 'win32' || !baseUrl) return false;
  let url;
  try { url = new URL(baseUrl); } catch (_) { return false; }
  if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname) || !url.port) return false;
  const run = options.spawnSyncImpl || spawnSync;
  const script = `$c=New-Object Net.Sockets.TcpClient;try{$a=$c.BeginConnect('${url.hostname}',${Number(url.port)},$null,$null);if($a.AsyncWaitHandle.WaitOne(500)){$c.EndConnect($a);'1'}else{'0'}}catch{'0'}finally{$c.Dispose()}`;
  const result = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8', windowsHide: true, timeout: 2000
  });
  return result.status === 0 && String(result.stdout || '').trim().endsWith('1');
}

function getClaudeDesktopStatus(options = {}) {
  const paths = pathsFor(options);
  const registry = createRegistry(options);
  const effective = effectiveManagedConfig(registry);
  const value = name => effective.values[name] && effective.values[name].existed
    ? String(effective.values[name].value || '') : '';
  const actualBaseUrl = value('inferenceGatewayBaseUrl');
  const expectedBaseUrl = options.baseUrl ? normalizeBaseUrl(options.baseUrl) : '';
  const provider = value('inferenceProvider');
  const configuredModels = managedModelNames(value('inferenceModels'));
  const modelCatalogReady = CLAUDE_MODEL_ROUTES.every(entry => configuredModels.includes(entry.route));
  const configured = Boolean(actualBaseUrl || fs.existsSync(paths.profilePath));
  const active = effective.hive === 'HKCU'
    && provider === 'gateway'
    && Boolean(actualBaseUrl)
    && (!expectedBaseUrl || actualBaseUrl === expectedBaseUrl);
  const hostCredentials = latestHostCredentials(paths);
  const runtimeBaseUrl = String(hostCredentials?.env?.ANTHROPIC_BASE_URL || '');
  const runtimeProbe = options.tcpProbe || (url => defaultTcpProbe(url, options));
  const runtimeReady = active && Boolean(runtimeBaseUrl) && runtimeProbe(runtimeBaseUrl);
  return {
    supported: (options.platform || process.platform) === 'win32',
    configured,
    active,
    connected: runtimeReady,
    configSource: effective.hive ? 'managed-registry' : 'local-library',
    registryHive: effective.hive,
    registryPath: effective.hive ? registryPath(effective.hive) : registryPath('HKCU'),
    actualBaseUrl,
    expectedBaseUrl,
    runtimeBaseUrl,
    runtimeReady,
    runtimePid: hostCredentials?.pid || null,
    configuredModels,
    modelCatalogReady,
    profilePath: paths.profilePath,
    metaPath: paths.metaPath,
    backupAvailable: Boolean(readState(paths.statePath)),
    error: active && !runtimeReady
      ? '8046 已写入真实托管配置，但 Claude 内部网关尚未就绪'
      : ''
  };
}

function restoreSnapshot(snapshot) {
  if (!snapshot || !snapshot.path) return;
  if (snapshot.existed && snapshot.backupPath && fs.existsSync(snapshot.backupPath)) {
    fs.mkdirSync(path.dirname(snapshot.path), { recursive: true });
    fs.copyFileSync(snapshot.backupPath, snapshot.path);
  } else if (fs.existsSync(snapshot.path)) {
    fs.unlinkSync(snapshot.path);
  }
}

function restoreRegistry(registry, snapshot) {
  if (!snapshot || !snapshot.values) return;
  for (const [name, original] of Object.entries(snapshot.values)) {
    if (original && original.existed) {
      registry.write(snapshot.hive || 'HKCU', name, original.type || MANAGED_VALUE_TYPES[name] || 'REG_SZ', original.value);
    } else {
      registry.remove(snapshot.hive || 'HKCU', name);
    }
  }
}

function restoreClaudeDesktop(options = {}) {
  const paths = pathsFor(options);
  const state = readState(paths.statePath);
  if (!state || !state.snapshots) throw new Error('没有可恢复的 Claude Desktop 配置备份');
  for (const key of ['normalConfig', 'threepConfig', 'profile', 'meta']) restoreSnapshot(state.snapshots[key]);
  restoreRegistry(createRegistry(options), state.registrySnapshot);
  return {
    restoredFrom: state.backupDir,
    registryRestored: Boolean(state.registrySnapshot),
    requiresRestart: true
  };
}

module.exports = {
  PROFILE_ID,
  REGISTRY_KEY,
  pathsFor,
  parseJsonObject,
  parseRegistryQuery,
  managedModelNames,
  advertisedClaudeRoute,
  connectClaudeDesktop,
  getClaudeDesktopStatus,
  restoreClaudeDesktop
};
