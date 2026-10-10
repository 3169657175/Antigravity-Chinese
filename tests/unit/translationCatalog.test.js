const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), os = require('os');
const { configureTranslationCatalog } = require('../../translationCatalog');
test('catalog registration preserves integration preferences and follows the installed resource path', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-catalog-test-'));
  try {
    const resource = path.join(temp, 'resources');
    fs.mkdirSync(path.join(resource, 'patch'), { recursive: true });
    fs.writeFileSync(path.join(resource, 'patch', 'zh-CN.json'), '{"messages":{}}');
    const configFile = path.join(temp, 'Antigravity', 'agy-hub-integration.json');
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify({ developerMode: true, futureOption: 'keep' }));
    const app = { isPackaged: true, getPath: () => temp };
    assert.equal(configureTranslationCatalog(app, resource), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(configFile, 'utf8')), { developerMode: true, futureOption: 'keep', translationCatalogPath: path.join(resource, 'patch', 'zh-CN.json') });
    const before = fs.statSync(configFile).mtimeMs;
    configureTranslationCatalog(app, resource);
    assert.equal(fs.statSync(configFile).mtimeMs, before);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
