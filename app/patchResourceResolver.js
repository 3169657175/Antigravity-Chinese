const fs = require('fs');
const path = require('path');

const PACKAGED_NAMES = Object.freeze({
  'accountQuota.js': 'accountQuota.js',
  'antigravityQuotaBridge.js': 'antigravityQuotaBridge.js',
  'locales/zh-CN.json': 'zh-CN.json',
  'injections/native-localization.js': 'native-localization.js',
  'injections/translation-enhancement.js': 'translation-enhancement.js'
});

function resolvePatchWorkbenchResource(relativePath, options = {}) {
  const key = String(relativePath).replace(/\\/g, '/');
  const packagedName = PACKAGED_NAMES[key];
  if (!packagedName) throw new Error(`Unsupported patch resource: ${key}`);
  const resourcesPath = options.resourcesPath === undefined ? process.resourcesPath : options.resourcesPath;
  const workbenchDir = options.workbenchDir || path.join(__dirname, 'patch-workbench');
  const fsModule = options.fsModule || fs;
  const candidates = [
    ...(resourcesPath ? [path.join(resourcesPath, 'patch', packagedName)] : []),
    path.join(workbenchDir, ...(['accountQuota.js', 'antigravityQuotaBridge.js'].includes(key) ? ['..', key] : key.split('/')))
  ];
  for (const filePath of candidates) {
    if (fsModule.existsSync(filePath)) return filePath;
  }
  throw new Error(`汉化运行资源缺失：${key}。已检查：${candidates.join('；')}。请重新安装完整的 AGY Hub，不会修改 Antigravity。`);
}

function readPatchWorkbenchResource(relativePath, options = {}) {
  return (options.fsModule || fs).readFileSync(resolvePatchWorkbenchResource(relativePath, options), 'utf8');
}

module.exports = { resolvePatchWorkbenchResource, readPatchWorkbenchResource, PACKAGED_NAMES };
