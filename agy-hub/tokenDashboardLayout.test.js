const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('packaged runtime stylesheet loads the four-column Token dashboard rule directly', () => {
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  const gridRule = css.match(/\.cyber-dashboard-grid\s*\{([^}]*)\}/);

  assert.doesNotMatch(css, /^\s*@import/m, 'Electron runtime CSS must not depend on nested local @import files');
  assert.ok(gridRule, 'missing Token dashboard grid rule');
  assert.match(gridRule[1], /display:\s*grid/);
  assert.match(gridRule[1], /grid-template-columns:\s*repeat\(4,\s*1fr\)/);
});
