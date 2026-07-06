// engine.js - Antigravity 2.0 Core DOM Translation Engine
const path = require('path');
const dictionary = require('../locales/dict.json');
const substringReplacements = require('../locales/substring.json');
const { applyRegexRules } = require('./regexRules');

const codeClassPattern = /(?:^|[\s_-])(code|diff|source|syntax|highlight|viewer|hljs|shiki|prism|monaco|codemirror|token|line-number|line-content|gutter|codeblock|code-block|code-view|code-preview|file-preview|file-content)(?:$|[\s_-])/i;

const punctuationMap = {
  '.': '。',
  ':': '：',
  '?': '？',
  '!': '！',
  ',': '，'
};

const escapeRegExp = (str) => {
  const specials = ['[', ']', '(', ')', '{', '}', '*', '+', '?', '.', '^', '$', '|', '\\\\'];
  return str.split('').map(c => specials.includes(c) ? '\\\\' + c : c).join('');
};

function shouldSkipNode(node) {
  const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!element) return false;

  const skipTags = ['SCRIPT', 'STYLE', 'CODE', 'PRE', 'NOSCRIPT', 'KBD', 'SAMP', 'VAR'];
  if (skipTags.includes(element.tagName)) {
    return true;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return true;
    }
  }

  if (element.getAttribute) {
    if (element.getAttribute('data-language') || 
        element.getAttribute('data-code') ||
        element.getAttribute('data-line') ||
        element.getAttribute('data-line-number')) {
      return true;
    }
  }

  let cur = element;
  while (cur) {
    if (cur.getAttribute && cur.getAttribute('contenteditable') === 'true') {
      return true;
    }

    if (cur.getAttribute) {
      if (cur.getAttribute('data-language') || 
          cur.getAttribute('data-code') ||
          cur.getAttribute('data-line') ||
          cur.getAttribute('data-line-number')) {
        return true;
      }
    }

    if (cur.getAttribute) {
      const role = cur.getAttribute('role');
      if (role === 'code') {
        return true;
      }
    }

    if (cur.classList && (
      cur.classList.contains('monaco-editor') || 
      cur.classList.contains('editor-instance') ||
      cur.classList.contains('input-area') ||
      cur.classList.contains('chat-input')
    )) {
      return true;
    }

    if (cur.className && typeof cur.className === 'string') {
      const lowerClass = cur.className.toLowerCase();
      if (
        lowerClass.includes('code-line') ||
        lowerClass.includes('select-contain') ||
        lowerClass.includes('font-mono') ||
        codeClassPattern.test(cur.className)
      ) {
        return true;
      }
    }

    if (cur.tagName === 'PRE' || cur.tagName === 'CODE') {
      return true;
    }

    cur = cur.parentElement;
  }

  return false;
}

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

  // 1. Dynamic Regex Matching
  const { isDynamic, dynamicMatch } = applyRegexRules(trimmed);
  if (isDynamic) {
    return text.replace(trimmed, dynamicMatch);
  }

  // 2. Direct Literal Match
  if (dictionary[trimmed]) {
    return text.replace(trimmed, dictionary[trimmed]);
  }
  
  const trimmedLower = trimmed.toLowerCase();
  for (const key in dictionary) {
    if (key.toLowerCase() === trimmedLower) {
      return text.replace(trimmed, dictionary[key]);
    }
  }

  // 3. Intelligent Punctuation Stripping & Reconstruction
  let core = trimmed;
  let trailPunc = '';
  let matchPunc = '';

  const puncRegex = /(\.\.\.|…|\.|\?|!|:|：|？|！|。)$/;
  const match = core.match(puncRegex);
  if (match) {
    matchPunc = match[0];
    core = core.slice(0, -matchPunc.length).trim();
    
    if (matchPunc === '.') trailPunc = '.';
    else if (matchPunc === '?') trailPunc = '？';
    else if (matchPunc === '!') trailPunc = '！';
    else if (matchPunc === ':') trailPunc = '：';
    else if (matchPunc === '：') trailPunc = '：';
    else if (matchPunc === '？') trailPunc = '？';
    else if (matchPunc === '！') trailPunc = '！';
    else if (matchPunc === '。') trailPunc = '。';
    else trailPunc = matchPunc;
  }

  let coreTranslated = '';
  if (dictionary[core]) {
    coreTranslated = dictionary[core];
  } else {
    const coreLower = core.toLowerCase();
    for (const key in dictionary) {
      if (key.toLowerCase() === coreLower) {
        coreTranslated = dictionary[key];
        break;
      }
    }
  }

  if (coreTranslated) {
    return text.replace(trimmed, coreTranslated + trailPunc);
  }

  // 4. Fallback to word-by-word ONLY for short strings (<= 1 word)
  if (/[\u4e00-\u9fa5]/.test(core)) {
    return text;
  }
  const wordsCount = core.split(/\s+/).filter(Boolean).length;
  if (wordsCount > 1) {
    return text;
  }

  let temp = core;
  let replaced = false;
  const sortedKeys = Object.keys(dictionary).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length <= 3 && !/^[a-zA-Z0-9]+$/.test(key)) continue;
    const escapedKey = escapeRegExp(key);
    const startBoundary = /^[a-zA-Z0-9]/.test(key) ? '\\b' : '';
    const endBoundary = /[a-zA-Z0-9]$/.test(key) ? '\\b' : '';
    const regex = new RegExp(startBoundary + escapedKey + endBoundary, 'gi');
    if (regex.test(temp)) {
      temp = temp.replace(regex, dictionary[key]);
      replaced = true;
    }
  }

  let finalTranslated = replaced ? temp : core;
  finalTranslated = finalTranslated.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
  if (matchPunc) {
    finalTranslated += trailPunc;
  }
  return text.replace(trimmed, finalTranslated);
}

function translateNode(node) {
  if (!node) return;
  if (shouldSkipNode(node)) return;

  if (node.nodeType === Node.TEXT_NODE) {
    const original = node.nodeValue;
    const translated = translateString(original);
    if (original !== translated) {
      node.nodeValue = translated;
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    ['placeholder', 'title', 'aria-label', 'value'].forEach(attr => {
      if (node.hasAttribute && node.hasAttribute(attr)) {
        if (attr === 'value' && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
          return;
        }
        const original = node.getAttribute(attr);
        if (original && (node.tagName !== 'INPUT' || node.type === 'button' || node.type === 'submit' || attr !== 'value')) {
          const translated = translateString(original);
          if (original !== translated) {
            node.setAttribute(attr, translated);
          }
        }
      }
    });

    if (node.shadowRoot) {
      observeRoot(node.shadowRoot);
      for (let i = 0; i < node.shadowRoot.childNodes.length; i++) {
        translateNode(node.shadowRoot.childNodes[i]);
      }
    }

    for (let i = 0; i < node.childNodes.length; i++) {
      translateNode(node.childNodes[i]);
    }
  } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    for (let i = 0; i < node.childNodes.length; i++) {
      translateNode(node.childNodes[i]);
    }
  }
}

const observerConfig = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['placeholder', 'title', 'aria-label', 'value']
};

const observers = [];

function observeRoot(root) {
  // Prevent duplicate observers on the same shadow root
  if (root._observedByAntigravity) return;
  root._observedByAntigravity = true;

  const observer = new MutationObserver((mutations) => {
    observer.disconnect();
    try {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (!shouldSkipNode(node)) {
              translateNode(node);
            }
          });
        } else if (mutation.type === 'characterData') {
          const node = mutation.target;
          if (!shouldSkipNode(node)) {
            const original = node.nodeValue;
            const translated = translateString(original);
            if (original !== translated) {
              node.nodeValue = translated;
            }
          }
        } else if (mutation.type === 'attributes') {
          const target = mutation.target;
          if (!shouldSkipNode(target)) {
            const attrName = mutation.attributeName;
            if (attrName === 'value' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
              continue;
            }
            const original = target.getAttribute(attrName);
            if (original) {
              const translated = translateString(original);
              if (original !== translated) {
                target.setAttribute(attrName, translated);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[Antigravity-Chinese] Observer error:', e);
    } finally {
      observer.observe(root, observerConfig);
    }
  });

  observer.observe(root, observerConfig);
  observers.push(observer);
}

function startObserver() {
  console.log('[Antigravity-Chinese] Initializing Core Translation Observer...');
  translateNode(document.body);
  observeRoot(document.body);
}

module.exports = {
  translateString,
  shouldSkipNode,
  translateNode,
  observeRoot,
  startObserver
};
