'use strict';

// Read-only audit of the installed desktop shell, embedded web UI, and public
// customization metadata. Never reads conversation databases or account secrets.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');
const asar = require('@electron/asar');
const normalize = value => value.replace(/\s+/g, ' ').trim();
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const MAX_ASSET = 24 * 1024 * 1024;

function readEmbeddedArchives(binary) {
  const archives = [], signature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  let end = binary.length;
  while ((end = binary.lastIndexOf(signature, end - 1)) >= 0) {
    if (end + 22 > binary.length) continue;
    const disk = binary.readUInt16LE(end + 4), centralDisk = binary.readUInt16LE(end + 6);
    const count = binary.readUInt16LE(end + 10), diskCount = binary.readUInt16LE(end + 8);
    const size = binary.readUInt32LE(end + 12), offset = binary.readUInt32LE(end + 16);
    const start = end - size - offset;
    if (disk || centralDisk || count !== diskCount || !count || count > 5000 || start < 0 || start >= end) continue;
    if (binary.readUInt32LE(start) !== 0x04034b50) continue;
    const entries = [];
    let cursor = start + offset, total = 0;
    try {
      for (let i = 0; i < count; i++) {
        if (cursor + 46 > end || binary.readUInt32LE(cursor) !== 0x02014b50) throw Error('Invalid ZIP directory');
        const flags = binary.readUInt16LE(cursor + 8), method = binary.readUInt16LE(cursor + 10);
        const compressed = binary.readUInt32LE(cursor + 20), bytes = binary.readUInt32LE(cursor + 24);
        const nameLength = binary.readUInt16LE(cursor + 28), extra = binary.readUInt16LE(cursor + 30), comment = binary.readUInt16LE(cursor + 32);
        const next = cursor + 46 + nameLength + extra + comment;
        if (next > end) throw Error('ZIP directory exceeds bounds');
        const name = binary.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
        const relative = name.replace(/^\//, '');
        if (!relative || /[\u0000\\]/.test(relative) || relative.split('/').includes('..') || /^[a-z]:/i.test(relative)) throw Error('Unsafe asset path');
        const local = start + binary.readUInt32LE(cursor + 42);
        const entry = {name, bytes, compressed};
        // Images/fonts are inventoried; only UI code and HTML need inspection.
        if (/(?:^|\/)main\.js$|\.html$/i.test(name)) {
          if (flags & 1 || bytes > MAX_ASSET || local < start || local + 30 > start + offset || binary.readUInt32LE(local) !== 0x04034b50) throw Error('Invalid UI asset');
          const begin = local + 30 + binary.readUInt16LE(local + 26) + binary.readUInt16LE(local + 28);
          if (begin + compressed > start + offset) throw Error('UI asset exceeds bounds');
          const compressedData = binary.subarray(begin, begin + compressed);
          const data = method === 8 ? zlib.inflateRawSync(compressedData, {maxOutputLength:MAX_ASSET}) : method === 0 ? compressedData : null;
          if (!data || data.length !== bytes || (total += bytes) > 40 * 1024 * 1024) throw Error('Invalid UI asset size');
          if (typeof zlib.crc32 === 'function' && zlib.crc32(data) !== binary.readUInt32LE(cursor + 16)) throw Error('UI asset checksum mismatch');
          entry.data = data; entry.sha256 = hash(data);
        }
        entries.push(entry); cursor = next;
      }
      if (cursor !== end) throw Error('Incomplete ZIP directory');
      archives.push({start, end, entries});
    } catch (_) { /* A random PE signature or unsupported archive is not UI. */ }
  }
  return archives;
}

function frontMatterDescriptions(text) {
  const descriptions = [];
  for (const match of text.matchAll(/(?:^|\n)---\r?\nname:[^]*?\r?\n---(?:\r?\n|$)/g)) {
    if (match[0].length > 8000 || /[\u0000\ufffd]/.test(match[0])) continue;
    const name = match[0].match(/\nname:\s*([^\r\n]+)/)?.[1]?.trim();
    let description = match[0].match(/\ndescription:\s*([^]*?)(?=\r?\n[a-zA-Z_-]+:|\r?\n---)/)?.[1];
    if (!name || !description || name === 'my-specialized-skill') continue;
    description = normalize(description.replace(/^[>|][-+]?\s*/, ''));
    if (/^(["']).*\1$/.test(description)) description = description.slice(1, -1);
    descriptions.push({name, text:description});
  }
  return descriptions;
}

function extractEmbeddedSkills(binary) {
  const marker = Buffer.from('---\nname:'), result = new Map();
  let offset = 0;
  while ((offset = binary.indexOf(marker, offset)) >= 0) {
    const end = binary.indexOf(Buffer.from('\n---'), offset + marker.length);
    if (end > offset && end - offset < 8000) {
      for (const skill of frontMatterDescriptions(binary.subarray(offset, end + 5).toString('utf8'))) result.set(skill.name, skill);
    }
    offset += marker.length;
  }
  return [...result.values()];
}

function loadParser(parserPath) {
  if (parserPath) {
    const parser = require(path.resolve(parserPath));
    if (typeof parser.babelParse === 'function') return source => parser.babelParse(source, 'installed-ui.js', false);
    if (typeof parser.parse === 'function') return source => parser.parse(source, {sourceType:'unambiguous'});
    throw Error('Parser must export parse or babelParse');
  }
  try { const parser = require('@babel/parser'); return source => parser.parse(source, {sourceType:'unambiguous'}); } catch (_) { return null; }
}

function eligible(text) {
  return text.length >= 2 && text.length <= 2000 && /[A-Za-z]/.test(text) && !/[\u3400-\u9fff\u0000-\u001f]/.test(text.replace(/[\r\n\t]/g, ''))
    && !/[{}=<>]|\b(?:var|function|return)\b/.test(text)
    && !/^(?:https?:|mailto:|[\w.-]+\/(?:[\w./*-]+)|\[\w+\]|schema\.|--|M\d.*[a-z]\d)/i.test(text)
    && !/(?:^|\s)(?:flex|grid|inline-flex|items-|justify-|text-(?:xs|sm|base|lg|muted|foreground|secondary)|bg-|border-|rounded-|gap-\d|p[xy]?-\d|w-\d|h-\d)/.test(text)
    && !/^(?:linear-gradient|rgba?|matrix|rotate|calc|max|min)\(/.test(text);
}

function collectStrings(source, sourceName, parser) {
  const records = new Map();
  function add(text, at, line, confidence, reason) {
    if (!eligible(text)) return;
    if (confidence === 'candidate' && /^[-.\w:/@]+$/.test(text)) return;
    const id = normalize(text).toLowerCase();
    const record = records.get(id) || {text, confidence, reason, sources:[], occurrences:0};
    record.occurrences++;
    if (confidence === 'ui') {record.confidence = confidence; record.reason = reason;}
    if (record.sources.length < 2) record.sources.push({file:sourceName, line, before:source.slice(Math.max(0, at - 140), at), after:source.slice(at + text.length + 2, at + text.length + 142)});
    records.set(id, record);
  }
  if (parser) {
    const tree = parser(source), ancestors = [];
    function walk(node, parent) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'StringLiteral' || (node.type === 'TemplateLiteral' && !node.expressions.length)) {
        const text = node.type === 'StringLiteral' ? node.value : node.quasis[0].value.cooked;
        const property = parent?.type === 'ObjectProperty' ? parent : ancestors.findLast(n=>n.type==='ObjectProperty');
        const prop = property?.key?.name || property?.key?.value;
        const call = ancestors.findLast(n=>n.type==='CallExpression');
        const element = call?.callee?.property?.name === 'createElement';
        const excluded = ['className','style','id','href','src','role','type','settingKey','configurationKey','key','icon','data-testid','data-screen'].includes(prop)
          || (parent?.type==='ObjectProperty' && parent.key===node) || (element && call.arguments[0]===node);
        if (!excluded && typeof text === 'string') {
          const propertyUi = ['label','title','description','placeholder','tooltip','tooltipText','infoTooltip','aria-label','message','detail','buttonLabel','text','header','summary','helperText','emptyMessage','body'].includes(prop);
          // Ternaries and return-value labels remain candidates for human review.
          const childUi = element && call.arguments.slice(2).includes(node);
          add(text, node.start, node.loc?.start?.line, propertyUi || childUi ? 'ui' : 'candidate', propertyUi ? `property:${prop}` : childUi ? 'React child' : 'English literal');
        }
      }
      ancestors.push(node);
      for (const [name, value] of Object.entries(node)) {
        if (['loc','start','end','extra','leadingComments','trailingComments','innerComments'].includes(name)) continue;
        if (Array.isArray(value)) {for (const child of value) if (child?.type) walk(child, node);}
        else if (value?.type) walk(value, node);
      }
      ancestors.pop();
    }
    walk(tree, null);
  } else {
    // Conservative fallback for shell labels. It does not execute JS and all
    // results are explicitly marked candidates, never automatic replacements.
    for (const match of source.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g)) {
      let text;
      try {
        text = match[0][0] === '"' ? JSON.parse(match[0]) : match[0].slice(1,-1).replace(/\\(['"\\])/g,'$1').replace(/\\n/g,'\n');
      } catch (_) {continue;}
      add(text, match.index, null, 'candidate', 'Literal heuristic; review required');
    }
  }
  return [...records.values()];
}

function makeTranslator(catalogPath, legacyPath) {
  const context = {console, queueMicrotask, globalThis:{__agyI18nCatalog:JSON.parse(fs.readFileSync(catalogPath,'utf8'))}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'injections/translation-enhancement.js'),'utf8'), context, {timeout:2000});
  if (legacyPath && fs.existsSync(legacyPath)) {
    const preload = asar.extractFile(legacyPath, path.normalize('dist/preload.js')).toString('utf8');
    const compiled = require('./compatibility').buildPreload("electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);",preload);
    const begin = compiled.indexOf('  const dictionary = {'), end = compiled.indexOf('  const codeClassPattern',begin);
    if (begin >= 0 && end > begin) {
      // This is our trusted legacy patch, not JS extracted from the installation.
      // Evaluate only its catalog and rewritten pure translation functions.
      vm.runInNewContext(compiled.slice(begin,end)+'\nglobalThis.__agyI18n.configure({dictionary,phrases:substringReplacements,dynamic:translateLegacyDynamic});',context,{timeout:2000});
    }
  }
  return context.globalThis.__agyI18n.translate;
}

function audit(options) {
  const root = path.resolve(options.root), dataRoot = options.dataRoot && path.resolve(options.dataRoot);
  const parser = loadParser(options.parser), translate = makeTranslator(options.catalog || path.join(__dirname,'locales/zh-CN.json'), options.legacy);
  const inventory = [], entries = new Map(), warnings = [];
  function add(record) {
    const id = normalize(record.text).toLowerCase(), existing = entries.get(id);
    if (existing) {existing.occurrences += record.occurrences || 1; existing.sources.push(...(record.sources || []).slice(0, 4 - existing.sources.length)); if (record.confidence === 'ui') existing.confidence = 'ui';}
    else entries.set(id, {...record, occurrences:record.occurrences || 1, sources:record.sources || []});
  }
  function source(name, data) {
    inventory.push({file:name, bytes:data.length, sha256:hash(data)});
    const text = data.toString('utf8');
    if (/\.js$/i.test(name)) {for (const record of collectStrings(text,name,parser)) add(record);}
    if (/\.html$/i.test(name)) for (const match of text.matchAll(/>([^<>]{2,2000})</g)) {
      const label = normalize(match[1]); if (eligible(label)) add({text:label,confidence:'ui',reason:'HTML text',sources:[{file:name}]});
    }
  }
  const shell = path.join(root,'resources/app.asar.original');
  const archive = fs.existsSync(shell) ? shell : path.join(root,'resources/app.asar');
  for (const name of asar.listPackage(archive)) {
    if (!/^[/\\]dist[/\\]/.test(name) || !/\.(?:js|html)$/.test(name)) continue;
    if (/\.test\.js$|[/\\]__mocks__[/\\]/.test(name)) continue;
    const relative = path.normalize(name.replace(/^[/\\]/,''));
    if (asar.statFile(archive,relative).size > MAX_ASSET) continue;
    source(`desktop:${relative}`,asar.extractFile(archive,relative));
  }
  const serverFile = path.join(root,'resources/bin/language_server.exe'), binary = fs.readFileSync(serverFile);
  inventory.push({file:'resources/bin/language_server.exe',bytes:binary.length,sha256:hash(binary)});
  const archives = readEmbeddedArchives(binary);
  for (const embedded of archives) for (const entry of embedded.entries) {
    inventory.push({file:`embedded:${entry.name}`,bytes:entry.bytes,sha256:entry.sha256});
    if (entry.data) source(`web:${entry.name}`,entry.data);
  }
  if (!archives.some(a=>a.entries.some(e=>/(?:^|\/)main\.js$/.test(e.name)))) warnings.push('Embedded main.js not found; this version may use another format.');
  const skills = extractEmbeddedSkills(binary);
  for (const skill of skills) add({text:skill.text,confidence:'ui',reason:'Built-in skill description',sources:[{file:`builtin:${skill.name}`}]});
  if (dataRoot) {
    const builtins = path.join(dataRoot,'builtin/skills');
    if (fs.existsSync(builtins)) for (const name of fs.readdirSync(builtins)) {
      const file = path.join(builtins,name,'SKILL.md');
      if (fs.existsSync(file)) for (const skill of frontMatterDescriptions(fs.readFileSync(file,'utf8'))) add({text:skill.text,confidence:'ui',reason:'Built-in skill description',sources:[{file:`builtin/skills/${name}/SKILL.md`}]});
    }
    const cache = path.join(dataRoot,'cache/marketplaces');
    if (fs.existsSync(cache)) for (const name of fs.readdirSync(cache)) {
      const file = path.join(cache,name,'marketplace.json');
      if (!fs.existsSync(file) || fs.statSync(file).size > 2 * 1024 * 1024) continue;
      const marketplace = JSON.parse(fs.readFileSync(file,'utf8'));
      for (const plugin of marketplace.plugins || []) for (const field of ['displayName','description']) {
        if (typeof plugin[field] === 'string' && eligible(plugin[field])) add({text:plugin[field],confidence:'ui',reason:`Marketplace ${field}`,sources:[{file:`marketplace:${name}/${plugin.name}`} ]});
      }
    }
    const plugins = path.join(path.dirname(dataRoot),'config/plugins');
    if (fs.existsSync(plugins)) for (const name of fs.readdirSync(plugins)) {
      const file = path.join(plugins,name,'plugin.json');
      if (!fs.existsSync(file) || fs.statSync(file).size > 2 * 1024 * 1024) continue;
      const plugin = JSON.parse(fs.readFileSync(file,'utf8'));
      for (const field of ['displayName','description']) {
        if (typeof plugin[field] === 'string' && eligible(plugin[field])) add({text:plugin[field],confidence:'ui',reason:`Installed plugin ${field}`,sources:[{file:`installed-plugin:${name}`} ]});
      }
    }
  }
  const results = [...entries.values()].map(entry=>({...entry,translation:translate(entry.text)}));
  const pending = results.filter(e=>e.translation===e.text);
  const report = {schemaVersion:1,root,dataRoot,parser:parser?'AST':'literal heuristic',warnings,inventory,
    counts:{embeddedAssets:archives.reduce((n,a)=>n+a.entries.length,0),builtinSkills:skills.length,candidates:results.length,
      translated:results.length-pending.length,untranslatedCandidates:pending.length,untranslatedUiCandidates:pending.filter(e=>e.confidence==='ui').length},
    notice:'Candidates include product names, technical identifiers, developer screens and library strings. Untranslated does not mean a confirmed UI defect.',results};
  const output = path.resolve(options.out);
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'audit.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(output,'review-pending.json'),JSON.stringify(pending,null,2)+'\n');
  return report;
}

module.exports = {readEmbeddedArchives,extractEmbeddedSkills,frontMatterDescriptions,collectStrings,audit};
if (require.main === module) {
  const options = {root:path.join(process.env.LOCALAPPDATA || '', 'Programs/antigravity'),dataRoot:path.join(require('os').homedir(),'.gemini/antigravity'),out:path.join(__dirname,'audit-report'),legacy:path.join(__dirname,'legacy-payload.asar'),parser:process.env.BABEL_BUNDLE_PATH};
  for (let i=2;i<process.argv.length;i+=2) {
    const name = process.argv[i].replace(/^--/,'');
    if (!['root','dataRoot','out','catalog','legacy','parser'].includes(name) || !process.argv[i+1]) throw Error('Usage: node audit-localization.js --root PATH --out PATH [--dataRoot PATH] [--parser PATH]');
    options[name] = process.argv[i+1];
  }
  const report = audit(options);
  console.log(JSON.stringify({counts:report.counts,parser:report.parser,warnings:report.warnings,out:path.resolve(options.out)}));
}
