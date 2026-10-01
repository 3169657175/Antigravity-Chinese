const path = require('path');
const crypto = require('crypto');
const { readJsonSafe, writeJsonAtomic } = require('./fsUtils');

const CACHE_VERSION = 1;

function hasChinese(value) {
  return /[\u3400-\u9fff]/.test(String(value || ''));
}

function sourceHash(value) {
  return crypto.createHash('sha256').update(String(value || '').trim(), 'utf8').digest('hex');
}

class SkillTranslationStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  read() {
    const data = readJsonSafe(this.filePath, { version: CACHE_VERSION, entries: {} });
    return data && typeof data === 'object' && data.entries && typeof data.entries === 'object'
      ? data : { version: CACHE_VERSION, entries: {} };
  }

  matching(items) {
    const cache = this.read();
    const translations = {};
    const missing = [];
    for (const item of items || []) {
      const id = String(item.id || '').trim();
      const originalDescription = String(item.originalDescription || item.description || '').trim();
      if (!id || !originalDescription || hasChinese(originalDescription)) continue;
      const hash = sourceHash(originalDescription);
      const entry = cache.entries[id];
      if (entry && entry.sourceHash === hash && entry.chineseDescription) translations[id] = entry;
      else missing.push({ id, name: String(item.name || id), originalDescription, sourceHash: hash });
    }
    return { translations, missing, totalCached: Object.keys(cache.entries).length };
  }

  save(items, model = '') {
    const cache = this.read();
    const translatedAt = new Date().toISOString();
    for (const item of items || []) {
      const id = String(item.id || '').trim();
      const originalDescription = String(item.originalDescription || '').trim();
      const chineseDescription = String(item.chineseDescription || '').trim();
      if (!id || !originalDescription || !hasChinese(chineseDescription)) continue;
      cache.entries[id] = {
        sourceHash: sourceHash(originalDescription),
        originalDescription,
        chineseDescription: chineseDescription.slice(0, 500),
        category: String(item.category || ''),
        translationSource: 'ai',
        model: String(model || ''),
        translatedAt
      };
    }
    cache.version = CACHE_VERSION;
    writeJsonAtomic(this.filePath, cache);
    return cache;
  }
}

function defaultSkillTranslationPath(homeDir) {
  return path.join(homeDir, '.gemini', 'config', 'skill_translation_cache.json');
}

module.exports = { SkillTranslationStore, sourceHash, hasChinese, defaultSkillTranslationPath };
