const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
const controller = fs.readFileSync(path.join(root, 'gatewayController.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload.js'), 'utf8');

test('Provider 2.0 stays inside the existing custom Provider secondary page', () => {
  for (const value of ['responses', 'chat-completions', 'anthropic-messages', 'gemini-native']) assert.match(html, new RegExp(`value="${value}"`));
  for (const id of ['codex-provider-auth-mode', 'btn-discover-provider-models', 'codex-provider-fallback-urls']) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(controller, /discoverCustomCodexProviderModels/);
  assert.match(preload, /codex-provider-discover-models/);
});

test('snapshot and timeline reuse existing overview header without embedding onboarding', () => {
  for (const id of ['btn-gateway-snapshot', 'btn-gateway-timeline', 'gateway-insight-panel']) assert.match(html, new RegExp(`id="${id}"`));
  assert.doesNotMatch(html, /id="gateway-onboarding"/);
  assert.match(html, /id="guide-overlay"/);
  assert.doesNotMatch(html, /data-target="tab-tool-center"/);
  assert.match(html, /class="gateway-header-tools"/);
  assert.match(css, /\.codex-workspace-header\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(css, /\.gateway-insight-panel\s*\{[^}]*position:\s*absolute/s);
  assert.match(css, /\.gateway-snapshot-row\s*\{/);
  assert.match(controller, /row\.className = 'gateway-snapshot-row'/);
});
