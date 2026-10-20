(function AGYTranslationEnhancement() {
  'use strict';
  if (globalThis.__agyI18n) return;
  const normalize = value => String(value ?? '').replace(/[\s\u00a0]+/g, ' ').trim();
  const key = value => normalize(value).toLowerCase();
  const builtin = globalThis.__agyI18nCatalog || { messages: {}, templates: [], fragments: {} };
  const messages = new Map(), overrides = new Map(), cache = new Map();
  const contextual = new Map(Object.entries(builtin.fragments || {}).map(([a, b]) => [key(a), b]));
  let legacyDynamic, supplementalDynamic, audit;
  let revision = 0;
  const templates = (builtin.templates || []).map(rule => [new RegExp(rule.pattern, 'i'), rule.translation]);
  const stats = { visited: 0, translated: 0, batches: 0, fullScans: 0, catalogUpdates: 0 };
  function validateMessages(data) {
    const result = Object.create(null);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return result;
    for (const [a, b] of Object.entries(data).slice(0, 10000)) {
      if (typeof b !== 'string' || !normalize(a) || a.length > 2000 || b.length > 4000) continue;
      if (/^(?:__proto__|constructor|prototype)$/i.test(a) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(a + b)) continue;
      if (!/[\u3400-\u9fff]/.test(b) || /<\/?(?:script|iframe)\b/i.test(b)) continue;
      result[a] = b;
    }
    return result;
  }
  function mergeInto(target, data) {
    let changed = false;
    for (const [a, b] of Object.entries(validateMessages(data))) {
      if (target.get(key(a)) !== b) { target.set(key(a), b); changed = true; }
    }
    if (changed) { cache.clear(); revision++; }
    return changed;
  }
  mergeInto(overrides, builtin.messages);
  function configure(options) {
    if (options.dictionary) mergeInto(messages, options.dictionary);
    if (options.supplemental) mergeInto(messages, options.supplemental);
    if (options.phrases) {
      // Exact fragments only. A word like "of" must never rewrite other words.
      for (const rule of options.phrases) {
        if (normalize(rule.search).split(' ').length >= 3 && !messages.has(key(rule.search))) mergeInto(messages, { [rule.search]: rule.replace });
      }
    }
    if (options.dynamic) legacyDynamic = options.dynamic;
    if (options.supplementalDynamic) supplementalDynamic = options.supplementalDynamic;
    if (options.audit) audit = options.audit;
    cache.clear();
  }
  function mergeDictionary(data) {
    if (mergeInto(messages, data)) { stats.catalogUpdates++; refresh(); }
  }
  const lookup = text => overrides.get(key(text)) || messages.get(key(text));
  function modelNotice(text) {
    // Backend announcements are versioned data, not literals in main.js.
    // Keep model identifiers intact and match complete, known announcement formats.
    const model = '(?:Claude |Gemini )?(?:Sonnet|Opus|Haiku|Gemini)?[A-Za-z0-9][A-Za-z0-9 .&+-]{0,70}';
    const available = text.match(new RegExp(`^(${model}) is now available on paid (Pro(?: and Ultra)?|Ultra) plans\\.$`, 'i'));
    if (available) return `${available[1]} 现已面向付费 ${available[2].replace(/ and /i, ' 和 ')} 套餐开放。`;
    const retired = text.match(/^Third-party model access will no longer be available on your current plan starting on (January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})\.$/i);
    if (retired) {
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const month = months.indexOf(retired[1].toLowerCase()) + 1, day = Number(retired[2]), year = Number(retired[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) return `自 ${year} 年 ${month} 月 ${day} 日起，当前套餐将不再提供第三方模型访问。`;
    }
    const flash = text.match(/^Make sure you are using (Gemini [\d.]+ Flash)! We will be turning down (Gemini [\d.]+ Flash) and (Gemini [\d.]+ Flash) shortly\.$/i);
    if (flash) return `请确保正在使用 ${flash[1]}！${flash[2]} 和 ${flash[3]} 将于近期停止服务。`;
    return null;
  }
  function translateKnownMcpDescription(text) {
    let match = text.match(/^The Cloud Audit Manager remote MCP server allows you to enroll projects, generate audit and scope reports, and check resource enrollment statuses in the ([A-Za-z0-9-]+) region\.?$/i);
    if (match) return `Cloud Audit Manager 远程 MCP 服务可用于登记项目、生成审计与范围报告，并检查 ${match[1]} 区域中的资源登记状态。`;
    if (/^Query and act on your marketing, analytics, CRM, e-commerce, and warehouse data across 325\+ connectors/i.test(text)) return '通过 Windsor.ai 查询并操作营销、分析、CRM、电商和数据仓库数据，支持 Meta Ads、Google Ads、TikTok Ads、GA4、HubSpot、Salesforce 等 325+ 个连接器。';
    if (/^Query your GitLab SDLC as a knowledge graph\./i.test(text) || /^Orbit indexes groups, projects, source code, merge requests, pipelines/i.test(text)) return '将 GitLab SDLC 作为知识图谱查询。Orbit 会把群组、项目、源代码、合并请求、流水线、工作项和安全发现索引到统一图谱，帮助智能体分析影响范围和关联关系。';
    if (/^Enable Antigravity to deploy apps to Google Cloud Run\.?$/i.test(text)) return '允许 Antigravity 将应用部署到 Google Cloud Run。';
    if (/^Ask questions\. Get answers\. (?:The MCP is a server|This MCP server)/i.test(text) || /^Interact directly with the PostHog product analytics platform using natural language\./i.test(text)) return '让编码智能体通过自然语言查询和操作 PostHog 产品分析数据，可执行查询、管理特性标志、跟踪错误并管理项目。';
    if (/^Investigate and fix software issues using AI-powered root cause analysis/i.test(text)) return '使用 AI 根因分析调查并修复软件问题。连接 Antimetal 账号后，可读取问题、调查过程和分析结果。';
    if (/^The GKE remote MCP server acts as an intermediary/i.test(text)) return 'GKE 远程 MCP 服务在大语言模型与 GKE 集群之间充当中介，为集群资源查询和操作提供安全、结构化的交互方式。';
    if (/^Search and reference over 600,000 real-world app screens, user flows, and UI patterns from Mobbin/i.test(text)) return '直接在 AI 工具中搜索和参考 Mobbin 收录的 60 多万张真实应用界面、用户流程与 UI 设计模式。';
    if (/^Build, edit, deploy, and manage full-stack web apps with Lovable/i.test(text)) return '使用 Lovable 通过自然语言构建、编辑、部署和管理全栈 Web 应用；该 MCP 服务可将 AI 客户端连接到 Lovable 项目与开发能力。';
    return null;
  }
  function isAgentProcessText(text) {
    return /^(?:Worked|Thought|Thinking)\s+for\b/i.test(text)
      || /^(?:Analyzed|Edited|Browsed|Executed|Ran|Searched|Running command|Reading|Read file|Searching)\b/i.test(text);
  }
  function resolve(text, context) {
    if (context && contextual.has(key(text))) return contextual.get(key(text));
    const exact = lookup(text);
    if (exact) return exact;
    const notice = modelNotice(text);
    if (notice) return notice;
    const mcpDescription = translateKnownMcpDescription(text);
    if (mcpDescription) return mcpDescription;
    for (const [pattern, replacement] of templates) if (pattern.test(text)) return text.replace(pattern, replacement);
    const suffix = text.match(/(\.\.\.|…|[.!?:])$/);
    if (suffix) {
      const base = lookup(text.slice(0, -suffix[0].length));
      if (base) return /[。！？：…]$/.test(base) ? base : base + ({ '.': '。', '!': '！', '?': '？', ':': '：' }[suffix[0]] || suffix[0]);
    }
    for (const dynamic of [legacyDynamic, supplementalDynamic]) {
      if (!dynamic) continue;
      const translated = dynamic(text);
      if (translated && translated !== text) return translated;
    }
    const sentences = text.split(/(?<=[.!?])\s+/);
    if (sentences.length > 1) {
      const translated = sentences.map(part => resolve(part, context));
      if (translated.every((part, index) => part !== sentences[index])) return translated.join(' ');
    }
    return text;
  }
  function translate(value, context = false) {
    const original = String(value ?? ''), text = normalize(original);
    if (!text || !/[A-Za-z]/.test(text) || text.length > 2000) return original;
    // Agent reasoning/tool execution lines are not fixed UI. Keep them exactly as
    // Antigravity renders them; this layer localizes only product UI chrome.
    if (isAgentProcessText(text)) return original;
    if (/^(?:https?:\/\/|[a-z]:[\\/]|\/?(?:[\w.-]+\/)+[\w.-]+$)/i.test(text)) return original;
    const cacheKey = `${context ? 'fragment' : 'ui'}:${text}`;
    let result = cache.get(cacheKey);
    if (result === undefined) {
      result = resolve(text, context);
      if (cache.size >= 4096) cache.clear();
      cache.set(cacheKey, result);
    }
    if (result === text) return original;
    return (original.match(/^\s*/)?.[0] || '') + result + (original.match(/\s*$/)?.[0] || '');
  }
  function isProtected(element, attribute = false) {
    let trustedUi = false;
    for (let cur = element; cur; cur = cur.parentElement || cur.getRootNode?.().host) {
      const tag = String(cur.tagName || '').toLowerCase();
      if (['script', 'style', 'pre', 'code', 'kbd', 'samp', 'var', 'noscript'].includes(tag)) return true;
      if (!attribute && ['input', 'textarea'].includes(tag)) return true;
      if (cur.isContentEditable || cur.getAttribute?.('contenteditable') === 'true') return true;
      if (['textbox', 'code'].includes(cur.getAttribute?.('role'))) return true;
      if (cur.matches?.('[role="tooltip"], [role="alert"], [data-testid="jetbox-service-announcement-banner"], [data-agy-ui-text]')) trustedUi = true;
      if (cur.matches?.('[data-agy-no-translate], [translate="no"], [data-language], [data-code], [data-line], .monaco-editor, .cm-editor, .chat-input, .input-area, [data-message-author-role], [data-testid="project-name"], [data-testid="conversation-title"], [data-testid="message-content"]')) return true;
      if (!trustedUi && cur.matches?.('.prose, .markdown, .markdown-body')) {
        // Tooltips/announcements can render Markdown too. This exception never
        // overrides a code, editable, user-message, or conversation guard above.
        let host = cur;
        while (host && !trustedUi) {
          trustedUi = !!host.matches?.('[role="tooltip"], [role="alert"], [data-testid="jetbox-service-announcement-banner"], [data-agy-ui-text]');
          host = host.parentElement || host.getRootNode?.().host;
        }
        if (!trustedUi) return true;
      }
      if (/(?:^|[\s_-])(?:code|diff|syntax|hljs|shiki|prism|token|file-content|project-name|conversation-title|message-content)(?:$|[\s_-])/i.test(String(cur.className || ''))) return true;
    }
    return false;
  }
  function fragmentContext(element) {
    for (let cur = element, depth = 0; cur && depth < 4; cur = cur.parentElement, depth++) {
      const value = cur.textContent || '';
      if (value.length < 700 && /(?:to have the agent generate a plan|让智能体生成计划|Modified in|已在\s*\d*\s*(?:projects?|个项目)|个项目中修改|浏览器子智能体|browser subagent)/i.test(value)) return true;
      if (value.length < 100 && /^(?:See|Show|再显示)\s+\d+\s*(?:more|项)(?:\.\.\.)?$/i.test(normalize(value))) return true;
    }
    return false;
  }
  const written = new WeakMap(), attributeWritten = new WeakMap(), pending = new Map(), observers = new Map(), ownedShadow = new WeakMap();
  let started = false, scheduled = false;
  function report(original, translated, element, attr) {
    if (original !== translated) stats.translated++;
    if (audit) { try { audit(original, translated, element, attr); } catch (_) {} }
  }
  function textNode(node) {
    const element = node.parentElement || node.getRootNode?.().host;
    const previous = written.get(node);
    if (!element || isProtected(element) || (previous?.translated === node.nodeValue && previous.revision === revision)) return;
    stats.visited++;
    const original = previous?.translated === node.nodeValue ? previous.original : node.nodeValue;
    const translated = translate(original, fragmentContext(element));
    report(original, translated, element, 'textContent');
    written.set(node, { original, translated, revision });
    if (translated !== node.nodeValue) node.nodeValue = translated;
  }
  function attributes(element) {
    if (isProtected(element, true)) return;
    let records = attributeWritten.get(element);
    if (!records) { records = new Map(); attributeWritten.set(element, records); }
    for (const attr of ['title', 'placeholder', 'aria-label']) {
      const current = element.getAttribute(attr), previous = records.get(attr);
      if (!current || (previous?.translated === current && previous.revision === revision)) continue;
      const original = previous?.translated === current ? previous.original : current;
      const translated = translate(original);
      report(original, translated, element, attr);
      records.set(attr, {original, translated, revision});
      if (translated !== current) element.setAttribute(attr, translated);
    }
    if (/^(?:BUTTON|OPTION)$/.test(element.tagName) || (element.tagName === 'INPUT' && /^(?:button|submit)$/.test(element.type))) {
      const original = element.getAttribute('value');
      if (original) { const translated = translate(original); if (translated !== original) element.setAttribute('value', translated); }
    }
  }
  const scanJobs = [];
  const CRITICAL_SYNC_NODE_LIMIT = 72;
  const CRITICAL_SELECTOR = 'button,[role="button"],[role="menuitem"],[role="tab"],label,input,textarea,select,option,summary,h1,h2,h3,h4,[aria-label],[title],[placeholder]';
  const SLICE_NODE_LIMIT = 250;
  const SLICE_BUDGET_MS = 6;
  let sliceScheduled = false;
  const now = () => (globalThis.performance && typeof globalThis.performance.now === 'function' ? globalThis.performance.now() : Date.now());
  function processElement(element) {
    attributes(element);
    const shadow = element.shadowRoot || ownedShadow.get(element);
    if (shadow) observeRoot(shadow);
  }
  function scanImmediate(root, limit = CRITICAL_SYNC_NODE_LIMIT) {
    if (!root || !root.isConnected) return true;
    if (root.nodeType === 3) { textNode(root); return true; }
    if (![1, 9, 11].includes(root.nodeType) || isProtected(root, true)) return true;
    if (root.nodeType === 1) processElement(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return isProtected(node.nodeType === 3 ? node.parentElement : node, node.nodeType !== 3) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    let current = null, processed = 0;
    while (processed < limit && (current = walker.nextNode())) {
      if (current.nodeType === 3) textNode(current);
      else processElement(current);
      processed++;
    }
    return current == null;
  }
  function translateCriticalControls(root) {
    if (!root || typeof document === 'undefined') return;
    if (root.nodeType === 3) { textNode(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    const translateControl = element => {
      if (!element || isProtected(element, true)) return;
      attributes(element);
      for (const child of element.childNodes || []) if (child.nodeType === 3) textNode(child);
    };
    if (root.nodeType === 1 && root.matches?.(CRITICAL_SELECTOR)) translateControl(root);
    let count = 0;
    for (const element of root.querySelectorAll?.(CRITICAL_SELECTOR) || []) {
      translateControl(element);
      if (++count >= 160) break;
    }
  }
  function createScanJob(root) {
    if (!root || !root.isConnected) return null;
    if (root.nodeType === 3) return { root, text: true, done: false };
    if (![1, 9, 11].includes(root.nodeType) || isProtected(root, true)) return null;
    if (root.nodeType === 1) processElement(root);
    return {
      root,
      walker: document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) { return isProtected(node.nodeType === 3 ? node.parentElement : node, node.nodeType !== 3) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
      })
    };
  }
  function deferAfterPaint(callback) {
    const timer = typeof globalThis.setTimeout === 'function' ? globalThis.setTimeout : setTimeout;
    let armed = false;
    const arm = () => {
      if (armed) return;
      armed = true;
      timer(callback, 0);
    };
    if (typeof globalThis.requestAnimationFrame === 'function') {
      globalThis.requestAnimationFrame(arm);
      // Hidden/minimized Electron windows can throttle rAF heavily. Never let
      // localization stall forever just because the compositor is paused.
      timer(arm, 32);
    } else arm();
  }
  function scheduleSlice() {
    if (sliceScheduled) return;
    sliceScheduled = true;
    const timer = typeof globalThis.setTimeout === 'function' ? globalThis.setTimeout : setTimeout;
    // The first flush already yielded to a paint. Continue large scans as short
    // macrotasks so Chromium can render/input between slices without rAF throttling.
    timer(processSlice, 0);
  }
  function processSlice() {
    sliceScheduled = false;
    const startedAt = now();
    let processed = 0;
    while (scanJobs.length && processed < SLICE_NODE_LIMIT && now() - startedAt < SLICE_BUDGET_MS) {
      const job = scanJobs[0];
      if (!job.root?.isConnected) { scanJobs.shift(); continue; }
      try {
        if (job.text) {
          textNode(job.root);
          scanJobs.shift();
          processed++;
          continue;
        }
        // React can remove/reparent the current node between slices. TreeWalker
        // then stays in that detached subtree and reports completion, skipping
        // still-connected controls after it. Resume from the root; written-node
        // records avoid translating completed text again, and slice limits still
        // bound each pass.
        if (!job.root.contains(job.walker.currentNode)) job.walker.currentNode = job.root;
        const node = job.walker.nextNode();
        if (!node) { scanJobs.shift(); continue; }
        if (node.nodeType === 3) textNode(node);
        else processElement(node);
        processed++;
      } catch (error) {
        console.warn('[AGY i18n]', error);
        scanJobs.shift();
      }
    }
    if (scanJobs.length) scheduleSlice();
    else if (pending.size) flushPending();
  }
  function flushPending() {
    scheduled = false;
    if (!pending.size) return;
    stats.batches++;
    const batch = [...pending];
    pending.clear();
    for (const [root, observer] of observers) if (root.host && !root.host.isConnected) { observer.disconnect(); observers.delete(root); }
    const subtreeRoots = new Set(batch.filter(([node, attrs]) => !attrs && node?.isConnected).map(([node]) => node));
    for (const [node, onlyAttributes] of batch) {
      if (!node.isConnected) continue;
      if (!onlyAttributes) {
        let ancestor = node.parentNode || node.getRootNode?.().host;
        let nested = false;
        while (ancestor) {
          if (subtreeRoots.has(ancestor)) { nested = true; break; }
          ancestor = ancestor.parentNode || ancestor.getRootNode?.().host;
        }
        if (nested) continue;
      }
      try {
        if (onlyAttributes) attributes(node);
        else {
          const job = createScanJob(node);
          if (job) scanJobs.push(job);
        }
      } catch (error) { console.warn('[AGY i18n]', error); }
    }
    if (scanJobs.length) scheduleSlice();
  }
  function schedule(root, attributeOnly = false) {
    if (!root || typeof document === 'undefined') return;
    if (attributeOnly) { attributes(root); return; }
    // Fixed controls and small subtrees are translated synchronously so users never
    // see English buttons/placeholders for seconds. Large dynamic content still
    // yields to paint and is completed in bounded slices.
    translateCriticalControls(root);
    if (scanImmediate(root)) return;
    pending.set(root, false);
    if (scheduled) return;
    scheduled = true;
    deferAfterPaint(flushPending);
  }
  function observeRoot(root) {
    if (!root) return;
    if (observers.has(root)) { schedule(root); return; }
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList') for (const node of record.addedNodes) schedule(node);
        else if (record.type === 'characterData') textNode(record.target);
        else attributes(record.target);
      }
    });
    observers.set(root, observer);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label', 'value'] });
    schedule(root);
  }
  function refresh() { cache.clear(); stats.fullScans++; if (typeof document !== 'undefined') schedule(document.body); }
  function start() {
    if (started || typeof document === 'undefined') return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', start, { once: true }); return; }
    started = true; stats.fullScans++;
    // First paint: localize fixed chrome immediately, then let the normal observer
    // finish any large content tree without blocking interaction.
    translateCriticalControls(document.body);
    scanImmediate(document.body, 220);
    observeRoot(document.body);
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function(...args) { const root = attach.apply(this, args); ownedShadow.set(this, root); observeRoot(root); return root; };
  }
  // Optional data files support vocabulary updates without rebuilding the ASAR.
  function reloadLocalCatalog() {
    if (typeof require !== 'function') return;
    try {
      const ipc = require('electron')?.ipcRenderer;
      if (typeof ipc?.invoke === 'function') {
        return Promise.resolve(ipc.invoke('agy:i18n:catalog')).then(data => {
          if (mergeInto(overrides, data?.messages)) { stats.catalogUpdates++; refresh(); }
        }).catch(error => console.warn('[AGY i18n] Catalog bridge unavailable:', error.message));
      }
    } catch (_) { /* Development/Node context: use the data-file fallback. */ }
    try {
      const fs = require('fs'), path = require('path'), os = require('os');
      const base = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Antigravity');
      let config = {};
      try { config = JSON.parse(fs.readFileSync(path.join(base, 'agy-hub-integration.json'), 'utf8').replace(/^\uFEFF/, '')); } catch (_) {}
      for (const file of [config.translationCatalogPath, path.join(base, 'agy-translations.zh-CN.json')]) {
        if (typeof file !== 'string' || !path.isAbsolute(file) || !fs.existsSync(file)) continue;
        if (fs.statSync(file).size > 2 * 1024 * 1024) continue;
        const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
        if (mergeInto(overrides, data.messages || data)) { stats.catalogUpdates++; refresh(); }
      }
    } catch (error) { console.warn('[AGY i18n] Local dictionary unavailable:', error.message); }
  }
  globalThis.__agyI18n = { translate, configure, mergeDictionary, validateMessages, schedule, start, refresh, reloadLocalCatalog, isProtected, stats };
  globalThis.__agyTranslateEnhancementText = translate;
  globalThis.__agyTranslationEnhancementDictionary = overrides;
  reloadLocalCatalog();
  if (typeof window !== 'undefined') window.addEventListener('focus', reloadLocalCatalog);
})();
