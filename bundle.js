/**
 * bundle.js
 * Antigravity-Chinese v2 - 零依赖沙盒折叠打包器
 * 
 * 职责：
 * 将本地开发的多个相对路径 JS 子模块折叠打包进单个 preload.js 中，
 * 绕过 Electron 渲染沙盒不支持动态相对 require 的底层安全限制。
 */

const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const preloadTplFile = path.join(projectDir, 'patch', 'preload.js');

if (!fs.existsSync(preloadTplFile)) {
  console.error('[ERROR] Source preload.js not found!');
  process.exit(1);
}

const preloadTpl = fs.readFileSync(preloadTplFile, 'utf8');

// 定义折叠加载的模块列表
const modulesToBundle = [
  { name: './core/dom', file: 'patch/core/dom.js' },
  { name: '../modules/theme-adapter', file: 'patch/modules/theme-adapter.js' },
  { name: './theme-adapter', file: 'patch/modules/theme-adapter.js' },
  { name: '../modules/dictionary', file: 'patch/modules/dictionary.js' },
  { name: './dictionary', file: 'patch/modules/dictionary.js' },
  { name: '../modules/translator', file: 'patch/modules/translator.js' },
  { name: './translator', file: 'patch/modules/translator.js' },
  { name: '../modules/telemetry-spy', file: 'patch/modules/telemetry-spy.js' },
  { name: './telemetry-spy', file: 'patch/modules/telemetry-spy.js' },
  { name: '../modules/quota-widget', file: 'patch/modules/quota-widget.js' },
  { name: './quota-widget', file: 'patch/modules/quota-widget.js' },
  { name: '../modules/account-switcher', file: 'patch/modules/account-switcher.js' },
  { name: './account-switcher', file: 'patch/modules/account-switcher.js' },
  { name: '../modules/update-checker', file: 'patch/modules/update-checker.js' },
  { name: './update-checker', file: 'patch/modules/update-checker.js' },
  { name: '../modules/theme-engine', file: 'patch/modules/theme-engine.js' },
  { name: './theme-engine', file: 'patch/modules/theme-engine.js' },
  { name: './core/loader', file: 'patch/core/loader.js' }
];

let modulesCode = 'const __agy_modules__ = {\n';

for (const mod of modulesToBundle) {
  const fullPath = path.join(projectDir, mod.file);
  if (fs.existsSync(fullPath)) {
    const code = fs.readFileSync(fullPath, 'utf8');
    // 将代码包裹为 CommonJS 闭包容器
    modulesCode += `  ${JSON.stringify(mod.name)}: function(module, exports, require, __dirname, __filename) {\n${code}\n  },\n`;
  } else {
    console.warn(`[WARNING] Module file not found: ${mod.file}`);
  }
}

modulesCode += '};\n\n';

// 注入沙盒本地 CommonJS 路由容器
const localRequireCode = `
const __agy_cache__ = {};
function __agy_require__(name) {
  if (__agy_cache__[name]) return __agy_cache__[name].exports;
  const module = { exports: {} };
  __agy_cache__[name] = module;
  if (!__agy_modules__[name]) {
    // 降级使用沙箱原生的顶级 require (例如加载 'electron')
    return require(name);
  }
  __agy_modules__[name](module, module.exports, __agy_require__, '', '');
  return module.exports;
}
`;

// 替换入口加载器的 require 为我们模拟的 __agy_require__
let cleanPreloadTpl = preloadTpl.replace(/require\(['"]\.\/core\/loader['"]\)/g, "__agy_require__('./core/loader')");

const finalPreload = `// ==========================================================
// Antigravity 2.0 Chinese Patch v2 Embedded Sandbox Bundle
// ==========================================================
${modulesCode}
${localRequireCode}
${cleanPreloadTpl}
`;

// 输出合成后的独立部署 preload.js 到同级 dist_preload.js
const destFile = path.join(projectDir, 'dist_preload.js');
fs.writeFileSync(destFile, finalPreload, 'utf8');
console.log('[OK] Folded sandbox bundle generated at: ' + destFile);
