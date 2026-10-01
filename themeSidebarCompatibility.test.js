const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { applyLiteralRules } = require('./patch-workbench/compatibility');

const runtimeRules = JSON.parse(fs.readFileSync(path.join(__dirname, 'patch-workbench', 'runtime-rules.json'), 'utf8'));
const legacyPreload = require('@electron/asar')
  .extractFile(path.join(__dirname, 'patch-workbench', 'legacy-payload.asar'), 'dist/preload.js')
  .toString('utf8');

test('2.4.3 sidebar compatibility preserves the original glass design without global transparency', () => {
  const result = applyLiteralRules(legacyPreload, runtimeRules, 'dist/preload.js');
  assert.match(result.source, /data-agy-sidebar-layer/);
  assert.match(result.source, /rect\.width <= Math\.min\(420, innerWidth \* \.42\)/);
  assert.match(result.source, /background-image: none !important/);
  assert.match(result.source, /\[data-agy-surface="sidebar"\] \[class~="bg-background"\]/);
  assert.match(result.source, /\[data-agy-surface="sidebar"\] \[class~="bg-sidebar"\]/);
  assert.match(result.source, /linear-gradient\(90deg,[\s\S]*var\(--agy-accent\) 22%, transparent\)/);
  assert.doesNotMatch(result.source, /html\.agy-theme-active-v2\s+aside\s*\{\s*background:\s*transparent/);
});
