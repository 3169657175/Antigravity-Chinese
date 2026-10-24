const fs = require('fs');
const path = require('path');

function replaceOne(source, anchor, replacement) {
  if (source.split(anchor).length !== 2) throw new Error(`Localization anchor changed: ${anchor.slice(0, 80)}`);
  return source.replace(anchor, replacement);
}
function replaceSection(source, start, end, replacement) {
  const from = source.indexOf(start), to = source.indexOf(end, from);
  if (from < 0 || to <= from || source.indexOf(start, from + 1) !== -1) throw new Error(`Localization section changed: ${start}`);
  return source.slice(0, from) + replacement + source.slice(to);
}
function buildLocalizationOverlay(payload) {
  let source = payload.replace(/\r\n/g, '\n');
  const catalog = JSON.parse(require('../patchResourceResolver').readPatchWorkbenchResource('locales/zh-CN.json'));
  if (catalog.schemaVersion !== 1 || !catalog.messages) throw new Error('Invalid built-in localization catalog');
  const engine = require('../patchResourceResolver').readPatchWorkbenchResource('injections/translation-enhancement.js');
  // Preserve legacy dynamic templates, removing blind substring/word replacements.
  source = replaceSection(source, '    let replacedText = text;', '    const trimmed = text.trim();', '');
  const declaration = '    let dynamicMatch = trimmed;\n    let isDynamic = false;';
  source = replaceOne(source, declaration, '');
  source = replaceOne(source, '    // --- Dynamic Agent Logs Regex Rules ---', declaration + '\n    // --- Dynamic Agent Logs Regex Rules ---');
  source = replaceSection(source, '    // 1. Direct Literal Match', '  const codeClassPattern', '    return text;\n  }\n\n  const translateString = text => globalThis.__agyI18n.translate(text);\n\n');
  source = replaceOne(source, '  function translateString(text) {', '  function translateLegacyDynamic(text) {');
  // One DOM observer; retain audit/widget integration APIs.
  source = replaceSection(source, '  function translateNode(node) {', '  // Hook document title updates', [
    '  function translateNode(node) { globalThis.__agyI18n.schedule(node); }',
    '  function startObserver() { globalThis.__agyI18n.start(); }',
    '  globalThis.__agyI18n.configure({ dictionary, phrases: substringReplacements, dynamic: translateLegacyDynamic, audit: recordTranslationAudit });', ''
  ].join('\n'));
  source = replaceOne(source, '      const data = JSON.parse(cachedDict);\n      Object.assign(dictionary, data);', '      const data = JSON.parse(cachedDict);\n      globalThis.__agyI18n.mergeDictionary(data);');
  source = replaceOne(source, '        const response = await fetch(url);', '        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });');
  source = replaceOne(source, "          if (data && typeof data === 'object') {", "          const validated = globalThis.__agyI18n.validateMessages(data);\n          if (Object.keys(validated).length) {");
  source = replaceOne(source, "            localStorage.setItem('antigravity_chinese_patch_dict', JSON.stringify(data));\n            Object.assign(dictionary, data);", "            globalThis.__agyI18n.mergeDictionary(validated);\n            try { localStorage.setItem('antigravity_chinese_patch_dict', JSON.stringify(validated)); } catch (_) {}");
  // Supplemental dictionary still feeds the audit helpers, without another
  // observer or its former 700ms shadow-root poll.
  source = replaceSection(source, '  function translateTextNode(node) {', '(function AGYTranslationAuditQualityLayer()', '  globalThis.__agyI18n.configure({ supplemental: Object.fromEntries(exact), supplementalDynamic: translateDynamic });\n})();\n\n');
  return `globalThis.__agyI18nCatalog = ${JSON.stringify(catalog)};\n${engine}\n${source}`;
}
module.exports = { buildLocalizationOverlay };
