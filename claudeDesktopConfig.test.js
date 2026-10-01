const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PROFILE_ID,
  pathsFor,
  parseJsonObject,
  advertisedClaudeRoute,
  managedModelNames,
  connectClaudeDesktop,
  getClaudeDesktopStatus,
  restoreClaudeDesktop
} = require('./claudeDesktopConfig.js');

function fakeRegistry(initial = {}) {
  const values = new Map();
  for (const [key, entry] of Object.entries(initial)) values.set(key, { ...entry, existed: true });
  const registry = {
    read(hive, name) {
      return values.has(`${hive}:${name}`) ? { ...values.get(`${hive}:${name}`) } : { existed: false };
    },
    write(hive, name, type, value) {
      values.set(`${hive}:${name}`, { existed: true, type, value: String(value) });
    },
    remove(hive, name) { values.delete(`${hive}:${name}`); },
    value(hive, name) { return values.get(`${hive}:${name}`)?.value; }
  };
  return registry;
}

function fixture(initialRegistry = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-claude-desktop-'));
  return {
    root,
    localAppData: path.join(root, 'Local'),
    stateDir: path.join(root, 'State'),
    registry: fakeRegistry(initialRegistry),
    platform: 'win32'
  };
}

function writeRuntimeCredentials(env, baseUrl = 'http://127.0.0.1:15721') {
  const paths = pathsFor(env);
  fs.mkdirSync(paths.threepDir, { recursive: true });
  fs.writeFileSync(path.join(paths.threepDir, 'host-creds-test.json'), JSON.stringify({
    env: { ANTHROPIC_BASE_URL: baseUrl },
    pid: 1234,
    expiresAt: Date.now() + 60_000
  }), 'utf8');
}

test('writes Claude local files and the real HKCU managed gateway configuration', () => {
  const env = fixture();
  const paths = pathsFor(env);
  fs.mkdirSync(path.dirname(paths.normalConfig), { recursive: true });
  fs.writeFileSync(paths.normalConfig, JSON.stringify({ keep: true }), 'utf8');
  const result = connectClaudeDesktop({
    ...env,
    baseUrl: 'http://127.0.0.1:8046',
    apiKey: 'sk-agy-test',
    model: 'claude-opus-4-6-thinking'
  });
  const normal = parseJsonObject(paths.normalConfig);
  const threep = parseJsonObject(paths.threepConfig);
  const profile = parseJsonObject(paths.profilePath);
  const meta = parseJsonObject(paths.metaPath);
  assert.equal(normal.keep, true);
  assert.equal(normal.deploymentMode, '3p');
  assert.equal(threep.deploymentMode, '3p');
  assert.equal(profile.inferenceGatewayBaseUrl, 'http://127.0.0.1:8046');
  assert.equal(profile.inferenceGatewayApiKey, 'sk-agy-test');
  assert.equal(profile.inferenceProvider, 'gateway');
  assert.equal(profile.inferenceGatewayAuthScheme, 'bearer');
  assert.equal(profile.inferenceCredentialKind, 'static');
  assert.equal(profile.inferenceGatewayUrl, undefined);
  assert.equal(profile.inferenceModels.length, 10);
  assert.deepEqual(profile.inferenceModels[0], {
    name: 'claude-opus-4-6',
    labelOverride: 'Claude Opus 4.6 Thinking',
    anthropicFamilyTier: 'opus',
    isFamilyDefault: true
  });
  assert.equal(meta.appliedId, PROFILE_ID);
  assert.equal(meta.activeProfileId, undefined);
  assert.ok(meta.entries.some(item => item.id === PROFILE_ID && item.name === 'AGY Hub'));
  assert.equal(env.registry.value('HKCU', 'inferenceGatewayBaseUrl'), 'http://127.0.0.1:8046');
  assert.equal(env.registry.value('HKCU', 'inferenceProvider'), 'gateway');
  const registryModels = JSON.parse(env.registry.value('HKCU', 'inferenceModels'));
  assert.equal(registryModels.length, 10);
  assert.equal(registryModels[0].name, 'claude-opus-4-6');
  assert.equal(registryModels[0].labelOverride, 'Claude Opus 4.6 Thinking');
  assert.equal(getClaudeDesktopStatus({ ...env, baseUrl: 'http://127.0.0.1:8046', tcpProbe: () => false }).modelCatalogReady, true);
  assert.match(result.registryPath, /HKCU\\SOFTWARE\\Policies\\Claude/);
  assert.ok(fs.existsSync(result.backupDir));
});

test('detects the legacy single-model registry catalog and keeps the update action available', () => {
  assert.deepEqual(managedModelNames('["claude-sonnet-4-5"]'), ['claude-sonnet-4-5']);
  const env = fixture({
    'HKCU:inferenceProvider': { type: 'REG_SZ', value: 'gateway' },
    'HKCU:inferenceGatewayBaseUrl': { type: 'REG_SZ', value: 'http://127.0.0.1:8046' },
    'HKCU:inferenceModels': { type: 'REG_SZ', value: '["claude-sonnet-4-5"]' }
  });
  writeRuntimeCredentials(env, 'http://127.0.0.1:8046');
  const status = getClaudeDesktopStatus({
    ...env,
    baseUrl: 'http://127.0.0.1:8046',
    tcpProbe: () => true
  });
  assert.equal(status.connected, true);
  assert.equal(status.modelCatalogReady, false);
});

test('advertises only Anthropic-compatible routes while preserving the selected upstream separately', () => {
  assert.equal(advertisedClaudeRoute('gemini-3.1-pro-high'), 'claude-sonnet-4-5-agy-31ph');
  assert.equal(advertisedClaudeRoute('gpt-5.6'), 'claude-sonnet-4-5-agy-auto');
  assert.equal(advertisedClaudeRoute('claude-sonnet-4-6'), 'claude-sonnet-4-6');
  assert.equal(advertisedClaudeRoute('claude-opus-4-6-thinking'), 'claude-opus-4-6');
});

test('15721 remains the effective managed upstream so status must be false', () => {
  const env = fixture({
    'HKCU:inferenceProvider': { type: 'REG_SZ', value: 'gateway' },
    'HKCU:inferenceGatewayBaseUrl': { type: 'REG_SZ', value: 'http://127.0.0.1:15721' }
  });
  writeRuntimeCredentials(env);
  const status = getClaudeDesktopStatus({
    ...env,
    baseUrl: 'http://127.0.0.1:8046',
    tcpProbe: () => true
  });
  assert.equal(status.actualBaseUrl, 'http://127.0.0.1:15721');
  assert.equal(status.active, false);
  assert.equal(status.connected, false);
});

test('8046 is connected only when the post-config Claude internal gateway is reachable', () => {
  const env = fixture();
  connectClaudeDesktop({ ...env, baseUrl: 'http://127.0.0.1:8046', apiKey: 'key' });
  writeRuntimeCredentials(env);
  const waiting = getClaudeDesktopStatus({
    ...env,
    baseUrl: 'http://127.0.0.1:8046',
    tcpProbe: () => false
  });
  assert.equal(waiting.active, true);
  assert.equal(waiting.connected, false);
  assert.equal(waiting.runtimeBaseUrl, 'http://127.0.0.1:15721');
  const connected = getClaudeDesktopStatus({
    ...env,
    baseUrl: 'http://127.0.0.1:8046',
    tcpProbe: url => url === 'http://127.0.0.1:15721'
  });
  assert.equal(connected.connected, true);
  assert.equal(connected.actualBaseUrl, 'http://127.0.0.1:8046');
  assert.equal(connected.runtimeReady, true);
});

test('HKLM managed policy blocks a misleading HKCU connection', () => {
  const env = fixture({
    'HKLM:inferenceProvider': { type: 'REG_SZ', value: 'gateway' },
    'HKLM:inferenceGatewayBaseUrl': { type: 'REG_SZ', value: 'http://example.invalid' }
  });
  assert.throws(
    () => connectClaudeDesktop({ ...env, baseUrl: 'http://127.0.0.1:8046', apiKey: 'key' }),
    /HKLM\\SOFTWARE\\Policies\\Claude/
  );
});

test('restores exact pre-connect files and registry values', () => {
  const env = fixture({
    'HKCU:inferenceProvider': { type: 'REG_SZ', value: 'gateway' },
    'HKCU:inferenceGatewayBaseUrl': { type: 'REG_SZ', value: 'http://127.0.0.1:15721' },
    'HKCU:inferenceGatewayApiKey': { type: 'REG_SZ', value: 'PROXY_MANAGED' },
    'HKCU:inferenceModels': { type: 'REG_SZ', value: '["haiku","sonnet","opus"]' }
  });
  const paths = pathsFor(env);
  fs.mkdirSync(path.dirname(paths.threepConfig), { recursive: true });
  fs.mkdirSync(paths.libraryDir, { recursive: true });
  fs.writeFileSync(paths.threepConfig, JSON.stringify({ deploymentMode: '1p', keep: 'threep' }), 'utf8');
  fs.writeFileSync(paths.metaPath, JSON.stringify({ appliedId: 'old', entries: [{ id: 'old', name: 'Old' }] }), 'utf8');
  connectClaudeDesktop({ ...env, baseUrl: 'http://127.0.0.1:8046', apiKey: 'key' });
  restoreClaudeDesktop(env);
  assert.deepEqual(parseJsonObject(paths.threepConfig), { deploymentMode: '1p', keep: 'threep' });
  assert.deepEqual(parseJsonObject(paths.metaPath), { appliedId: 'old', entries: [{ id: 'old', name: 'Old' }] });
  assert.equal(fs.existsSync(paths.profilePath), false);
  assert.equal(env.registry.value('HKCU', 'inferenceGatewayBaseUrl'), 'http://127.0.0.1:15721');
  assert.equal(env.registry.value('HKCU', 'inferenceGatewayApiKey'), 'PROXY_MANAGED');
  assert.equal(env.registry.value('HKCU', 'inferenceGatewayAuthScheme'), undefined);
  assert.equal(env.registry.value('HKCU', 'inferenceCredentialKind'), undefined);
});

test('accepts UTF-8 BOM but rejects malformed JSON with the real file path', () => {
  const env = fixture();
  const paths = pathsFor(env);
  fs.mkdirSync(path.dirname(paths.normalConfig), { recursive: true });
  fs.writeFileSync(paths.normalConfig, `\uFEFF${JSON.stringify({ deploymentMode: '1p' })}`, 'utf8');
  assert.equal(parseJsonObject(paths.normalConfig).deploymentMode, '1p');
  fs.writeFileSync(paths.normalConfig, '{broken', 'utf8');
  assert.throws(() => parseJsonObject(paths.normalConfig), error => {
    assert.match(error.message, /不是有效 JSON/);
    assert.match(error.message, /claude_desktop_config\.json/);
    return true;
  });
});


test('writes only live Antigravity models into the Claude managed catalog', () => {
  const env = fixture();
  const paths = pathsFor(env);
  connectClaudeDesktop({
    ...env,
    baseUrl: 'http://127.0.0.1:8046',
    apiKey: 'sk-agy-test',
    model: 'gemini-3.6-flash-high',
    models: ['agy-auto', 'gemini-3.6-flash-high', 'gemini-4-new-agent']
  });
  const profile = parseJsonObject(paths.profilePath);
  assert.equal(profile.inferenceModels.some(item => item.labelOverride === 'Claude Opus 4.6 Thinking'), false);
  assert.ok(profile.inferenceModels.some(item => item.labelOverride === 'gemini-4-new-agent'));
});
