const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('skill translation is explicit, incremental, cached, and does not run during silent sync', () => {
  const source = fs.readFileSync('src/marketplaceController.js', 'utf8');
  const silent = source.slice(source.indexOf('async function silentSyncGithubSkills'), source.indexOf('async function syncGithubSkillCatalog'));
  const explicit = source.slice(source.indexOf('async function syncGithubSkillCatalog'), source.indexOf('function showSkillDetail'));
  assert.doesNotMatch(silent, /translateMissingSkillDescriptions/);
  assert.match(explicit, /translateMissingSkillDescriptions\(12\)/);
  assert.match(source, /btnTranslateSkillDescriptions\?\.addEventListener/);
  assert.match(source, /readSkillTranslations/);
});

test('translation prompt treats remote catalog descriptions as untrusted input', () => {
  const source = fs.readFileSync('src/skillTranslationService.js', 'utf8');
  assert.match(source, /untrusted catalog data/);
  assert.match(source, /Math\.min\(24/);
  assert.match(source, /slice\(0, 1200\)/);
});
