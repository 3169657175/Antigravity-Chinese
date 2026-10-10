const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const main = fs.readFileSync('main.js', 'utf8');
const probe = fs.readFileSync('mcpProbe.js', 'utf8');
const controller = fs.readFileSync('marketplaceController.js', 'utf8');
const layout = fs.readFileSync('marketplace/marketplaceLayout.js', 'utf8');
const feedback = fs.readFileSync('operationFeedback.js', 'utf8');
const renderer = fs.readFileSync('renderer.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');

test('MCP protocol version is defined where the validator uses it', () => {
  assert.match(probe, /const MCP_PROTOCOL_VERSIONS = Object\.freeze\(\['2026-07-28', '2025-11-25', '2024-11-05'\]\);/);
  assert.match(probe, /const MCP_PROTOCOL_VERSION = MCP_PROTOCOL_VERSIONS\[0\];/);
  assert.match(main, /require\('\.\/mcpProbe\.js'\)/);
  assert.match(main, /options\.mode === 'config'/);
  assert.match(main, /MCP validator|MCP 验证器/);
});

test('MCP startup performs config-only checks and deep verification is explicit', () => {
  assert.match(controller, /refreshInstalledMcpStatuses\(\{ deep: false \}\)/);
  assert.match(controller, /btnRefreshMcpStatus\.onclick = \(\) => refreshInstalledMcpStatuses\(\{ deep: true \}\)/);
  assert.match(controller, /validateMcpConfigOnly/);
  assert.doesNotMatch(controller, /feedback\?\.begin\(operationId/);
  assert.match(feedback, /id\.startsWith\('mcp-'\)/);
  assert.match(html, /id="mcp-validation-progress"/);
});

test('marketplace reflows immediately when opened or resized', () => {
  assert.match(renderer, /agy-marketplace-tab-opened/);
  assert.match(renderer, /AgyMarketplaceController\?\.reflow/);
  assert.match(controller, /document\.addEventListener\('agy-marketplace-tab-opened'/);
  assert.match(controller, /window\.addEventListener\('resize', redraw/);
  assert.match(controller, /function scheduleReflow/);
  assert.match(controller, /requestAnimationFrame\(\(\) => \{[\s\S]*?requestAnimationFrame/);
  assert.match(controller, /setTimeout\(\(\) => \{[\s\S]*?reflow\(targetId\)[\s\S]*?140\)/);
  assert.match(controller, /new ResizeObserver\(redraw\)/);
  assert.match(layout, /container\.closest\('\.main-content'\)/);
  assert.match(layout, /container\.dataset\.rows/);
  assert.doesNotMatch(css, /^\+\s*$/m);
});

test('prepared skill records are reused instead of rebuilding the full catalog', () => {
  assert.match(controller, /__agyPresented/);
  assert.match(controller, /lastSkillList\.every\(skill => skill\?\.__agyPresented\)/);
  assert.match(controller, /installedSkillsLoadedAt/);
});
