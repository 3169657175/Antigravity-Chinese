const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const { CodexGateway } = require('../src/codexGateway');
const { PROFILE_IDS } = require('../src/gatewayProfiles');

test('probeUpstream restores the exact active custom route if probe code mutates it', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-route-isolation-'));
  const gateway = new CodexGateway({
    fetch: async () => new Response('{}', { status: 200 }),
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'test',
    clientSecret: 'test'
  });
  gateway.configure({
    mode: 'custom',
    model: 'gpt-5.6-sol',
    customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'secret',
    customProviderName: 'Sub2API',
    customModels: ['gpt-5.6-sol']
  });
  gateway.callUpstream = async () => {
    gateway.configure({ mode: 'antigravity', model: 'gemini-3.6-flash-high' });
    return { text: '{}', model: 'gemini-3.6-flash-high' };
  };
  await gateway.probeUpstream({ model: 'gemini-3.6-flash-high' });
  assert.equal(gateway.status().mode, 'custom');
  assert.equal(gateway.status().model, 'gpt-5.6-sol');
  const persisted = JSON.parse(fs.readFileSync(path.join(root, 'codex-gateway.json'), 'utf8'));
  assert.equal(persisted.mode, 'custom');
  assert.equal(persisted.customProviderName, 'Sub2API');
  assert.equal(persisted.version, 2);
  assert.equal(persisted.profiles[PROFILE_IDS.CODEX_CUSTOM].providerName, 'Sub2API');
});

test('Codex Antigravity, Codex Custom and Claude keep independent accounts and models', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-three-profile-isolation-'));
  const gateway = new CodexGateway({
    fetch: async () => new Response('{}', { status: 200 }),
    accountRoot: root,
    stateDir: root,
    decryptToken: value => value,
    clientId: 'test',
    clientSecret: 'test'
  });
  gateway.configure({
    profileId: PROFILE_IDS.CODEX_ANTIGRAVITY,
    activateCodexProfile: 'antigravity',
    accountId: 'codex-account',
    model: 'gemini-3.6-flash-high',
    autoResolvedModel: 'gemini-3.1-pro-high'
  });
  gateway.configure({
    profileId: PROFILE_IDS.CLAUDE_ANTIGRAVITY,
    accountId: 'claude-account',
    claudeModel: 'claude-opus-4-6-thinking',
    autoResolvedModel: 'gemini-3.6-flash-medium'
  });
  gateway.configure({
    profileId: PROFILE_IDS.CODEX_CUSTOM,
    activateCodexProfile: 'custom',
    providerId: 'provider-1',
    customBaseUrl: 'https://provider.example/v1',
    customApiKey: 'secret',
    customProviderName: 'Provider',
    customModels: ['gpt-5.6-sol'],
    model: 'gpt-5.6-sol'
  });
  const status = gateway.status();
  assert.equal(status.mode, 'custom');
  assert.deepEqual(status.profiles.codexAntigravity, {
    accountId: 'codex-account',
    model: 'gemini-3.6-flash-high',
    autoResolvedModel: 'gemini-3.1-pro-high',
    modelControl: 'gateway'
  });
  assert.equal(status.profiles.codexCustom.providerId, 'provider-1');
  assert.equal(status.profiles.codexCustom.model, 'gpt-5.6-sol');
  assert.equal(status.profiles.claudeAntigravity.accountId, 'claude-account');
  assert.equal(status.profiles.claudeAntigravity.model, 'claude-opus-4-6-thinking');
  assert.equal(status.codexAntigravityAccountId, 'codex-account');
  assert.equal(status.claudeAccountId, 'claude-account');
});

test('Antigravity draft selectors do not call the route-mutating start API', () => {
  const renderer = ['renderer.js', 'src/gatewayController.js']
    .map(file => fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8'))
    .join('\n');
  const handlers = [
    /model\.addEventListener\('change',[\s\S]*?\n\s*}\);/,
    /modelControl\?\.addEventListener\('change',[\s\S]*?\n\s*}\);/,
    /account\.addEventListener\('change',[\s\S]*?\n\s*}\);/
  ];
  for (const pattern of handlers) {
    const block = renderer.match(pattern)?.[0] || '';
    assert.ok(block, `missing handler ${pattern}`);
    assert.doesNotMatch(block, /startCodexGateway/);
  }
});

test('Claude account and model draft selectors stay read-only until an explicit action', () => {
  const renderer = ['renderer.js', 'src/gatewayController.js']
    .map(file => fs.readFileSync(path.join(PROJECT_ROOT, file), 'utf8'))
    .join('\n');
  for (const pattern of [
    /claudeDesktopAccount\?\.addEventListener\('change',[\s\S]*?\n\s*}\);/,
    /claudeDesktopModel\?\.addEventListener\('change',[\s\S]*?\n\s*}\);/
  ]) {
    const block = renderer.match(pattern)?.[0] || '';
    assert.ok(block, `missing Claude draft handler ${pattern}`);
    assert.doesNotMatch(block, /startCodexGateway|connectClaudeDesktop/);
  }
});
