/**
 * modules/translator.js
 * Antigravity-Chinese v2 - 缈昏瘧寮曟搸
 * 渚濊禆锛歞ictionary.js锛堥€氳繃鍏ㄥ眬鍙橀噺 dictionary/combinedDict/substringReplacements/escapeRegExp锛? * 鎻愪緵锛歵ranslateString, shouldSkipNode, translateNode, observeRoot, startObserver, fetchCloudDict
 */

const codeClassPattern = /(?:^|[\s_-])(code|diff|source|syntax|highlight|viewer|hljs|shiki|prism|monaco|codemirror|token|line-number|line-content|gutter|codeblock|code-block|code-view|code-preview|file-preview|file-content)(?:$|[\s_-])/i;

function translateString(text) {
  if (!text) return text;

  let replacedText = text;
  for (const rule of substringReplacements) {
    if (replacedText.includes(rule.search)) {
      replacedText = replacedText.replaceAll(rule.search, rule.replace);
    }
  }

  text = replacedText;
  const trimmed = text.trim();
  if (!trimmed) return text;

  // --- Dynamic Agent Logs Regex Rules ---
  let dynamicMatch = trimmed;
  let isDynamic = false;

  if (/^Worked for \d+s$/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/Worked for (\d+)s/, '宸插伐浣?$1 绉?);
    isDynamic = true;
  }
  if (/^Thought for \d+s$/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/Thought for (\d+)s/, '宸叉€濊€?$1 绉?);
    isDynamic = true;
  }
  if (/^Edited .* \+\d+ -\d+$/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/Edited (.*) \+(\d+) -(\d+)/, '缂栬緫浜?$1 (+$2 -$3)');
    isDynamic = true;
  }
  if (/^\d+ files? changed$/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/^(\d+) files? changed(.*)/, '$1 涓枃浠跺凡鏇存敼$2');
    isDynamic = true;
  }
  if (/^Explored/.test(trimmed)) {
    if (/^Explored \d+ files?$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Explored (\d+) files?(.*)/, '娴忚浜?$1 涓枃浠?2');
    } else if (/^Explored (.*)$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Explored (.*)/, '娴忚浜?$1');
    }
    isDynamic = true;
  }
  if (/^Canceled/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/^Canceled (.*)/, '宸插彇娑?$1');
    isDynamic = true;
  }

  // Community MCP registry template rules
  const matchEnable = trimmed.match(/^Enable Antigravity to (interact with|deploy apps to) (.*?).?$/i);
  if (matchEnable) {
    const act = matchEnable[1];
    const target = matchEnable[2];
    dynamicMatch = act === 'interact with'
      ? `鍏佽 Antigravity 涓?${target} 杩涜浜や簰銆俙
      : `鍏佽 Antigravity 灏嗗簲鐢ㄩ儴缃插埌 ${target}銆俙;
    isDynamic = true;
  }

  const matchExposes = trimmed.match(/^The (.*?) MCP server exposes (.*?) development tool actions to compatible AI-assistant clients.?$/i);
  if (!isDynamic && matchExposes) {
    dynamicMatch = `${matchExposes[1]} MCP 鏈嶅姟绔紝鍚戝吋瀹圭殑 AI 鍔╂墜瀹㈡埛绔叕寮€ ${matchExposes[2]} 寮€鍙戝伐鍏锋搷浣溿€俙;
    isDynamic = true;
  }

  const matchGives = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) (Server|server) gives AI-powered development tools the ability to (.*?).?$/i);
  if (!isDynamic && matchGives) {
    let action = matchGives[3];
    action = action.replace(/work with your (.*?) projects and your app's codebase/i, '鍗忓悓澶勭悊鎮ㄧ殑 $1 椤圭洰鍙婂簲鐢ㄤ唬鐮佸簱');
    action = action.replace(/build, debug and inspect your (.*?) app/i, '鏋勫缓銆佽皟璇曚笌妫€鏌ユ偍鐨?$1 搴旂敤');
    action = action.replace(/build, debug and inspect your (.*)/i, '鏋勫缓銆佽皟璇曚笌妫€鏌ユ偍鐨?$1');
    dynamicMatch = `閽堝 ${matchGives[1]} 鐨勬ā鍨嬩笂涓嬫枃鍗忚 (MCP) 鏈嶅姟绔紝涓?AI 杈呭姪寮€鍙戝伐鍏锋彁渚?{action}鐨勮兘鍔涖€俙;
    isDynamic = true;
  }

  const matchProvides = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) server provides tools for (.*?).?$/i);
  if (!isDynamic && matchProvides) {
    dynamicMatch = `${matchProvides[1]} 妯″瀷涓婁笅鏂囧崗璁?(MCP) 鏈嶅姟绔紝鎻愪緵鐢ㄤ簬 ${matchProvides[2]} 鐨勫伐鍏枫€俙;
    isDynamic = true;
  }

  const matchRemoteMCP = trimmed.match(/^The (.*?) (?:remote )?MCP server lets you (.*?).?$/i);
  if (!isDynamic && matchRemoteMCP) {
    let action = matchRemoteMCP[2];
    action = action.replace(/manage (.*?) resources/i, '绠＄悊 $1 璧勬簮');
    action = action.replace(/access and run (.*?) tools to (.*)/i, '璁块棶鍜岃繍琛?$1 宸ュ叿浠ワ細$2');
    dynamicMatch = `${matchRemoteMCP[1]} 杩滅▼ MCP 鏈嶅姟绔紝鍏佽鎮?{action}銆俙;
    isDynamic = true;
  }

  // Weekly/5h limit dynamic text
  if (/^You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?.?$/.test(trimmed)) {
    dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?.?/, '鎮ㄥ凡娑堣€椾簡閮ㄥ垎姣忓懆闄愰锛屽皢鍦?$1 澶?$2 灏忔椂鍚庡畬鍏ㄩ噸缃€?);
    isDynamic = true;
  } else if (/^You have used some of your weekly limit, it will fully refresh in (\d+) hours?.?$/.test(trimmed)) {
    dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) hours?.?/, '鎮ㄥ凡娑堣€椾簡閮ㄥ垎姣忓懆闄愰锛屽皢鍦?$1 灏忔椂鍚庡畬鍏ㄩ噸缃€?);
    isDynamic = true;
  }

  if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?.?$/.test(trimmed)) {
    dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?.?/, '鎮ㄥ凡娑堣€椾簡閮ㄥ垎 5 灏忔椂闄愰锛屽皢鍦?$1 灏忔椂 $2 鍒嗛挓鍚庡畬鍏ㄩ噸缃€?);
    isDynamic = true;
  } else if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?.?$/.test(trimmed)) {
    dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?.?/, '鎮ㄥ凡娑堣€椾簡閮ㄥ垎 5 灏忔椂闄愰锛屽皢鍦?$1 鍒嗛挓鍚庡畬鍏ㄩ噸缃€?);
    isDynamic = true;
  }

  if (isDynamic) return text.replace(trimmed, dynamicMatch);

  // 1. Direct Literal Match
  if (dictionary[trimmed]) return text.replace(trimmed, dictionary[trimmed]);

  const trimmedLower = trimmed.toLowerCase();
  for (const key in dictionary) {
    if (key.toLowerCase() === trimmedLower) return text.replace(trimmed, dictionary[key]);
  }

  // 2. Intelligent Punctuation Stripping & Reconstruction
  let core = trimmed;
  let trailPunc = '';
  let matchPunc = '';
  const puncRegex = /(\.\.\.|鈥\.|\\?|!|:|锛殀锛焲锛亅銆?$/;
  const puncMatch = core.match(puncRegex);
  if (puncMatch) {
    matchPunc = puncMatch[0];
    core = core.slice(0, -matchPunc.length).trim();
    if (matchPunc === '.') trailPunc = '.';
    else if (matchPunc === '?') trailPunc = '锛?;
    else if (matchPunc === '!') trailPunc = '锛?;
    else if (matchPunc === ':') trailPunc = '锛?;
    else trailPunc = matchPunc;
  }

  let coreTranslated = dictionary[core] || '';
  if (!coreTranslated) {
    const coreLower = core.toLowerCase();
    for (const key in dictionary) {
      if (key.toLowerCase() === coreLower) { coreTranslated = dictionary[key]; break; }
    }
  }
  if (coreTranslated) return text.replace(trimmed, coreTranslated + trailPunc);

  // 3. Fallback to word-by-word ONLY for short strings (<= 1 word)
  if (/[\u4e00-\u9fa5]/.test(core)) return text;
  const wordsCount = core.split(/\s+/).filter(Boolean).length;
  if (wordsCount > 1) return text;

  let temp = core;
  let replaced = false;
  const sortedKeys = Object.keys(combinedDict).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length <= 3 && !/^[a-zA-Z0-9]+$/.test(key)) continue;
    const escapedKey = escapeRegExp(key);
    const startBoundary = /^[a-zA-Z0-9]/.test(key) ? '\\b' : '';
    const endBoundary = /[a-zA-Z0-9]$/.test(key) ? '\\b' : '';
    const regex = new RegExp(startBoundary + escapedKey + endBoundary, 'gi');
    if (regex.test(temp)) {
      temp = temp.replace(regex, combinedDict[key]);
      replaced = true;
    }
  }

  let finalTranslated = replaced ? temp : core;
  finalTranslated = finalTranslated.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
  if (matchPunc) finalTranslated += trailPunc;
  return text.replace(trimmed, finalTranslated);
}

function shouldSkipNode(node) {
  if (!node) return true;
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element) return false;
  const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'KBD', 'SAMP', 'VAR'];
  if (skipTags.includes(element.tagName)) return true;
  if (node.nodeType === Node.TEXT_NODE) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') return true;
  }
  if (element.getAttribute) {
    if (element.getAttribute('data-language') || element.getAttribute('data-code') ||
        element.getAttribute('data-line') || element.getAttribute('data-line-number')) return true;
  }
  let cur = element;
  while (cur) {
    if (cur.getAttribute && cur.getAttribute('contenteditable') === 'true') return true;
    if (cur.getAttribute) {
      if (cur.getAttribute('data-language') || cur.getAttribute('data-code') ||
          cur.getAttribute('data-line') || cur.getAttribute('data-line-number')) return true;
      if (cur.getAttribute('role') === 'code') return true;
    }
    if (cur.classList && (
      cur.classList.contains('monaco-editor') ||
      cur.classList.contains('editor-instance') ||
      cur.classList.contains('input-area') ||
      cur.classList.contains('chat-input')
    )) return true;
    if (cur.className && typeof cur.className === 'string') {
      const lowerClass = cur.className.toLowerCase();
      if (lowerClass.includes('code-line') || lowerClass.includes('select-contain') ||
          lowerClass.includes('font-mono') || codeClassPattern.test(cur.className)) return true;
    }
    if (cur.tagName === 'PRE' || cur.tagName === 'CODE') return true;
    cur = cur.parentElement;
  }
  return false;
}

function translateNode(node) {
  if (!node) return;
  if (shouldSkipNode(node)) return;
  if (node.nodeType === Node.TEXT_NODE) {
    const original = node.nodeValue;
    const translated = translateString(original);
    if (original !== translated) node.nodeValue = translated;
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    ['placeholder', 'title', 'aria-label', 'value'].forEach(attr => {
      if (node.hasAttribute && node.hasAttribute(attr)) {
        if (attr === 'value' && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) return;
        const original = node.getAttribute(attr);
        if (original && (node.tagName !== 'INPUT' || node.type === 'button' || node.type === 'submit' || attr !== 'value')) {
          const translated = translateString(original);
          if (original !== translated) node.setAttribute(attr, translated);
        }
      }
    });
    if (node.shadowRoot) translateNode(node.shadowRoot);
    for (let i = 0; i < node.childNodes.length; i++) translateNode(node.childNodes[i]);
  } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    for (let i = 0; i < node.childNodes.length; i++) translateNode(node.childNodes[i]);
  }
}

const observerConfig = {
  childList: true, subtree: true, characterData: true, attributes: true,
  attributeFilter: ['placeholder', 'title', 'aria-label', 'value']
};

const observers = [];

function observeRoot(root) {
  const observer = new MutationObserver((mutations) => {
    observer.disconnect();
    try {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => { if (!shouldSkipNode(node)) translateNode(node); });
        } else if (mutation.type === 'characterData') {
          const node = mutation.target;
          if (!shouldSkipNode(node)) {
            const original = node.nodeValue;
            const translated = translateString(original);
            if (original !== translated) node.nodeValue = translated;
          }
        } else if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (!shouldSkipNode(target)) {
            const attrName = mutation.attributeName;
            if (attrName === 'value' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) continue;
            const original = target.getAttribute(attrName);
            if (original) {
              const translated = translateString(original);
              if (original !== translated) target.setAttribute(attrName, translated);
            }
          }
        }
      }
    } catch (e) {
      console.error('Observer translation error:', e);
    }
    observer.observe(root, observerConfig);
  });
  observer.observe(root, observerConfig);
  observers.push(observer);
}

// Hook attachShadow to catch dynamically created components
const originalAttachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function() {
  const shadowRoot = originalAttachShadow.apply(this, arguments);
  observeRoot(shadowRoot);
  return shadowRoot;
};

function startObserver() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', startObserver);
    return;
  }
  try {
    translateNode(document.body);
  } catch (e) {
    console.error('Translation error:', e);
  }
  observeRoot(document.body);
}

// Hook document title updates
try {
  const originalTitleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
  if (originalTitleDescriptor && originalTitleDescriptor.set) {
    Object.defineProperty(document, 'title', {
      get: function() { return originalTitleDescriptor.get.call(this); },
      set: function(val) {
        if (!val) { originalTitleDescriptor.set.call(this, val); return; }
        const trimmed = val.trim();
        let translated = val;
        if (dictionary[trimmed]) {
          translated = val.replace(trimmed, dictionary[trimmed]);
        } else if (trimmed.includes(' - Antigravity')) {
          const part = trimmed.replace(' - Antigravity', '').trim();
          if (dictionary[part]) translated = `${dictionary[part]} - Antigravity`;
        }
        originalTitleDescriptor.set.call(this, translated);
      }
    });
  }
} catch (e) {
  console.error('Failed to hook document title:', e);
}

// Cloud Dictionary Auto-Updater
const dictUrls = [
  'https://fastly.jsdelivr.net/gh/3169657175/Antigravity-Chinese@main/dist/dictionary.json',
  'https://raw.githubusercontent.com/3169657175/Antigravity-Chinese/main/dist/dictionary.json'
];

async function fetchCloudDict() {
  // Load cached dictionary first for instant startup
  try {
    const cachedDict = localStorage.getItem('antigravity_chinese_patch_dict');
    if (cachedDict) {
      const data = JSON.parse(cachedDict);
      Object.assign(dictionary, data);
    }
  } catch (e) {}

  // Fetch latest in the background
  for (const url of dictUrls) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data && typeof data === 'object') {
          localStorage.setItem('antigravity_chinese_patch_dict', JSON.stringify(data));
          Object.assign(dictionary, data);
          if (document.body) translateNode(document.body);
          return;
        }
      }
    } catch (err) {
      console.warn('Cloud dict fetch failed from ' + url, err);
    }
  }
}

module.exports = { translateString, shouldSkipNode, translateNode, observeRoot, startObserver, fetchCloudDict };
