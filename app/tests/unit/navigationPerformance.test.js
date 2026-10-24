const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const renderer = [
  'renderer.js',
  'gatewayController.js',
  'appShellController.js',
  'themeController.js',
  'tokenMonitorController.js',
  'marketplaceController.js',
  'marketplace/marketplaceLayout.js'
].map(file => fs.readFileSync(file, 'utf8')).join('\n');
const styles = [
  'style.css',
  'styles/base.css',
  'styles/gateway.css',
  'styles/theme-modes.css',
  'styles/claude-access.css'
].map(file => fs.readFileSync(file, 'utf8')).join('\n');
const markup = fs.readFileSync('index.html', 'utf8');

test('重型页面先完成绘制再执行后台刷新', () => {
  assert.match(renderer, /scheduleAfterPaint\(\(\) => document\.dispatchEvent\(new CustomEvent\('agy-codex-tab-opened'\)\)\)/);
  assert.match(renderer, /scheduleAfterPaint\(\(\) => refreshCodexPage\(page\)\)/);
});

test('隐藏二级页不参与高度计算，避免 Token 列表撑高其他页面', () => {
  assert.match(styles, /\.codex-workspace-page\s*\{[\s\S]*?display:\s*none;/);
  assert.match(styles, /\.codex-workspace-page\.active\s*\{\s*display:\s*block;/);
  assert.match(styles, /\.codex-workspace-body\s*\{[\s\S]*?height:\s*auto;/);
});

test('皮肤预览会在空闲时间提前解码', () => {
  assert.match(renderer, /prewarmThemePreviews/);
  assert.match(renderer, /image\.decode\(\)/);
  assert.match(renderer, /warmedThemePreviews/);
});

test('反代入口使用短缓存并避免每次进入刷新实时额度', () => {
  assert.match(renderer, /refresh\(\{ maxAgeMs: 5000 \}\)/);
  assert.match(renderer, /refreshClaudeDesktopStatus\(\{ maxAgeMs: 5000 \}\)/);
  assert.match(renderer, /refresh\(\{ force: true, includeQuota: true, includeClaude: true \}\)/);
});

test('Token 调用记录按每页 20 条分页', () => {
  assert.match(renderer, /const USAGE_PAGE_SIZE = 20;/);
  assert.match(renderer, /pageLogs = logs\.slice\(pageStart, pageStart \+ USAGE_PAGE_SIZE\)/);
  assert.match(renderer, /usageLogPageBySource/);
  assert.match(renderer, /window\.pageSize = 20;/);
  assert.match(styles, /\.codex-usage-pagination/);
});

test('Skill 与 MCP 在窗口缩放稳定后会再次按最终尺寸重排', () => {
  assert.match(renderer, /function scheduleReflow/);
  assert.match(renderer, /new ResizeObserver\(redraw\)/);
  assert.match(renderer, /layoutSettleTimer = setTimeout/);
  assert.match(renderer, /viewportBottom - rect\.top/);
});

test('Claude Code 接入页与 Codex 共享账号、额度和服务控制结构', () => {
  assert.match(markup, /id="claude-desktop-account"/);
  assert.match(markup, /id="claude-gateway-quota-grid"/);
  assert.match(markup, /id="btn-claude-gateway-refresh-quota"/);
  assert.match(markup, /id="btn-claude-gateway-start"/);
  assert.match(markup, /id="btn-claude-gateway-stop"/);
  assert.match(renderer, /function claudeSettings\(\)[\s\S]*?accountId: claudeDesktopAccount\?\.value/);
  assert.match(renderer, /fetchAccountQuota\(selectedId\)/);
  assert.match(renderer, /testClaudeDesktopGateway\(claudeSettings\(\)\)/);
  assert.match(renderer, /connectClaudeDesktop\(claudeSettings\(\)\)/);
});
