const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SkillTranslationStore } = require('./skillTranslationStore');
const { SkillTranslationService } = require('./skillTranslationService');

test('translations are cached by skill id and source description hash', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-skill-translation-'));
  let calls = 0;
  const store = new SkillTranslationStore(path.join(dir, 'cache.json'));
  const service = new SkillTranslationService({
    store,
    generate: async () => {
      calls += 1;
      return { model: 'test-model', text: '{"translations":[{"id":"api-design","chineseDescription":"用于设计和审查可靠的应用程序接口，并生成清晰的接口文档。","category":"后端与API"}]}' };
    }
  });
  const items = [{ id: 'api-design', name: 'API Design', description: 'Design reliable APIs and documentation.' }];
  const first = await service.translate(items);
  const second = await service.translate(items);
  assert.equal(first.translated.length, 1);
  assert.equal(second.missing.length, 0);
  assert.equal(calls, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('changed English descriptions become pending again', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-skill-translation-change-'));
  const store = new SkillTranslationStore(path.join(dir, 'cache.json'));
  store.save([{ id: 'skill-a', originalDescription: 'Old description', chineseDescription: '旧版中文简介。' }], 'test');
  assert.equal(store.matching([{ id: 'skill-a', description: 'New description' }]).missing.length, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});


test('AI translation failure falls back to local Chinese summaries and remains pending for later upgrade', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agy-skill-translation-fallback-'));
  const store = new SkillTranslationStore(path.join(dir, 'cache.json'));
  const service = new SkillTranslationService({
    store,
    generate: async () => { throw new Error('User location is not supported for the API use.'); }
  });
  const items = [{ id: 'frontend-helper', name: 'Frontend Helper', description: 'Build polished React interfaces and UI components.' }];
  const result = await service.translate(items);
  assert.equal(result.success, true);
  assert.equal(result.degraded, true);
  assert.equal(result.source, 'local-fallback');
  assert.match(result.translated[0].chineseDescription, /前端/);
  const status = store.matching(items);
  assert.equal(status.translations['frontend-helper'].translationSource, 'local-fallback');
  assert.equal(status.missing.length, 1, 'fallback summary must remain eligible for a later AI upgrade');
  fs.rmSync(dir, { recursive: true, force: true });
});
