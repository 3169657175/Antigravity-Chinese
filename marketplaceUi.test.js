const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const controller = require('./marketplaceController.js');

const source = fs.readFileSync('marketplaceController.js', 'utf8');
const presenterSource = fs.readFileSync('marketplace/marketplacePresenter.js', 'utf8');
const layoutSource = fs.readFileSync('marketplace/marketplaceLayout.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('style.css', 'utf8');

test('skill marketplace provides Chinese categories, sequence numbers and responsive page sizing', () => {
  const presented = controller.presentSkill({ id: 'python-debug-helper', description: 'Debug Python applications safely.' }, 41);
  assert.equal(presented.displayCategory, '编程开发');
  assert.match(presented.chineseDescription, /用于代码编写|技能标识/);
  assert.equal(presented.sequence, 42);
  assert.match(layoutSource, /market-category-rail/);
  assert.match(source, /padStart\(4/);
  assert.match(source, /calculatePageSize\(container, 260, 210, 5\)/);
  assert.doesNotMatch(layoutSource, /const pageSize = 6/);
  assert.match(presenterSource, /translationSource/);
  assert.match(css, /--market-columns/);
});

test('MCP catalog pins audited npm versions and reports bounded handshake progress', () => {
  assert.match(source, /chrome-devtools-mcp@1\.6\.0/);
  assert.match(source, /server-sequential-thinking@2026\.7\.4/);
  assert.match(source, /timeoutMs: persist \? 90_000 : 35_000/);
  assert.match(source, /Promise\.all\(Array\.from/);
});

test('marketplace and operation controllers load before renderer', () => {
  assert.ok(html.indexOf('operationFeedback.js') < html.indexOf('renderer.js'));
  assert.ok(html.indexOf('marketplaceController.js') < html.indexOf('renderer.js'));
});
