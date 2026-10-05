const fs = require('fs');
const path = require('path');
const { readJsonSafe, writeJsonAtomic } = require('./fsUtils');

function configureTranslationCatalog(app, resourcesPath = process.resourcesPath) {
  const catalogPath = app.isPackaged
    ? path.join(resourcesPath, 'patch', 'zh-CN.json')
    : path.join(__dirname, 'patch-workbench', 'locales', 'zh-CN.json');
  if (!fs.existsSync(catalogPath)) return false;
  const configPath = path.join(app.getPath('appData'), 'Antigravity', 'agy-hub-integration.json');
  const data = readJsonSafe(configPath, {}, { preserveCorrupted: true });
  const current = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  if (current.translationCatalogPath === catalogPath) return true;
  writeJsonAtomic(configPath, { ...current, translationCatalogPath: catalogPath });
  return true;
}
module.exports = { configureTranslationCatalog };
