/**
 * modules/translator.js
 * Antigravity-Chinese v2 - 翻译与 DOM 树扫描引擎
 * 
 * 职责：
 * 1. 深度遍历 DOM 树翻译节点文本与属性
 * 2. 挂载 MutationObserver 动态汉化实时生成的内容
 * 3. 拦截网页中的动态数值日志，使用正则做智能重构翻译
 */

const codeClassPattern = /(?:^|[\s_-])(code|diff|source|syntax|highlight|viewer|hljs|shiki|prism|monaco|codemirror|token|line-number|line-content|gutter|codeblock|code-block|code-view|code-preview|file-preview|file-content)(?:$|[\s_-])/i;

function translateString(text) {
  if (!text || typeof text !== 'string') return text;
  
  // 引用全局挂载的字典
  const dict = window.dictionary || {};
  const combDict = window.combinedDict || {};
  const rules = window.substringReplacements || [];
  const escapeReg = window.escapeRegExp || ((s) => s);

  let replacedText = text;
  for (const rule of rules) {
    if (rule && rule.search && replacedText.includes(rule.search)) {
      replacedText = replacedText.replaceAll(rule.search, rule.replace || '');
    }
  }

  text = replacedText;
  const trimmed = text.trim();
  if (!trimmed) return text;

  let dynamicMatch = trimmed;
  let isDynamic = false;

  // --- Dynamic Agent Logs Regex Rules ---
  if (/^Worked for \d+s$/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/Worked for (\d+)s/, '已工作 $1 秒');
    isDynamic = true;
  }
  if (/^Thought for \d+s$/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/Thought for (\d+)s/, '已思考 $1 秒');
    isDynamic = true;
  }
  if (/^Edited .* \+\d+ -\d+$/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/Edited (.*) \+(\d+) -(\d+)/, '编辑了 $1 (+$2 -$3)');
    isDynamic = true;
  }
  if (/^\d+ files? changed$/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/^(\d+) files? changed(.*)/, '$1 个文件已更改$2');
    isDynamic = true;
  }
  if (/^Explored/.test(trimmed)) {
    if (/^Explored \d+ files?$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Explored (\d+) files?(.*)/, '浏览了 $1 个文件$2');
    } else if (/^Explored (.*)$/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Explored (.*)/, '浏览了 $1');
    }
    isDynamic = true;
  }
  if (/^Canceled/.test(trimmed)) {
    dynamicMatch = dynamicMatch.replace(/^Canceled (.*)/, '已取消 $1');
    isDynamic = true;
  }

  // --- Baseline model quota reset date warning ---
  const matchBaselineQuota = trimmed.match(/^Your plan's baseline quota will refresh on (\d{4}\/\d{1,2}\/\d{1,2} \d{2}:\d{2}:\d{2})\. To continue using this model now, enable AI Credit overages\.?$/i);
  if (!isDynamic && matchBaselineQuota) {
    dynamicMatch = `您的计划基础额度将在 ${matchBaselineQuota[1]} 重置。若要立即继续使用此模型，请启用 AI 超额额度。`;
    isDynamic = true;
  }

  // --- NEW BUG FIX: Hit 5-hour limit dynamic text ---
  // 提示 1: "You have hit your 5-hour limit, so the weekly limit does not currently apply. Your 5-hour limit will refresh in X hours, Y minutes."
  const matchHit5hWeekly = trimmed.match(/^You have hit your 5-hour limit, so the weekly limit does not currently apply\. Your 5-hour limit will refresh in (\d+) hours?, (\d+) minutes?\.?$/);
  if (matchHit5hWeekly) {
    dynamicMatch = `您已达到 5 小时额度限制，因此每周限额当前暂不适用。您的 5 小时限额将在 ${matchHit5hWeekly[1]} 小时 ${matchHit5hWeekly[2]} 分钟后重置。`;
    isDynamic = true;
  } else {
    const matchHit5hWeeklyMin = trimmed.match(/^You have hit your 5-hour limit, so the weekly limit does not currently apply\. Your 5-hour limit will refresh in (\d+) minutes?\.?$/);
    if (matchHit5hWeeklyMin) {
      dynamicMatch = `您已达到 5 小时额度限制，因此每周限额当前暂不适用。您的 5 小时限额将在 ${matchHit5hWeeklyMin[1]} 分钟后重置。`;
      isDynamic = true;
    }
  }

  // 提示 2: "You have hit your 5-hour limit, it will refresh in X hours, Y minutes. If on a supported paid plan, you can use AI credits in the interim."
  const matchHit5hRefresh = trimmed.match(/^You have hit your 5-hour limit, it will refresh in (\d+) hours?, (\d+) minutes?\. If on a supported paid plan, you can use AI credits in the interim\.?$/);
  if (!isDynamic && matchHit5hRefresh) {
    dynamicMatch = `您已达到 5 小时频度限额，限额将在 ${matchHit5hRefresh[1]} 小时 ${matchHit5hRefresh[2]} 分钟后充值重置。在付费订阅计划下，您可以在此期间超额使用 AI 点数。`;
    isDynamic = true;
  } else {
    const matchHit5hRefreshMin = trimmed.match(/^You have hit your 5-hour limit, it will refresh in (\d+) minutes?\. If on a supported paid plan, you can use AI credits in the interim\.?$/);
    if (!isDynamic && matchHit5hRefreshMin) {
      dynamicMatch = `您已达到 5 小时频度限额，限额将在 ${matchHit5hRefreshMin[1]} 分钟后充值重置。在付费订阅计划下，您可以在此期间超额使用 AI 点数。`;
      isDynamic = true;
    }
  }

  // --- Dynamic Weekly / Hourly Limit Warning Text ---
  if (/^You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?$/.test(trimmed)) {
    dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?/, '您已消耗了部分每周限额，将在 $1 天 $2 小时后完全重置。');
    isDynamic = true;
  } else if (/^You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?$/.test(trimmed)) {
    dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?/, '您已消耗了部分每周限额，将在 $1 小时后完全重置。');
    isDynamic = true;
  }

  if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?$/.test(trimmed)) {
    dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?/, '您已消耗了部分 5 小时限额，将在 $1 小时 $2 分钟后完全重置。');
    isDynamic = true;
  } else if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?\.?$/.test(trimmed)) {
    dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?\.?/, '您已消耗了部分 5 小时限额，将在 $1 分钟后完全重置。');
    isDynamic = true;
  }

  // --- Dynamic MCP servers & registry template rules ---
  const matchEnable = trimmed.match(/^Enable Antigravity to (interact with|deploy apps to) (.*?)\.?$/i);
  if (matchEnable) {
    const act = matchEnable[1];
    const target = matchEnable[2];
    dynamicMatch = act === 'interact with' ? `允许 Antigravity 与 ${target} 进行交互。` : `允许 Antigravity 将应用部署到 ${target}。`;
    isDynamic = true;
  }

  const matchExposes = trimmed.match(/^The (.*?) MCP server exposes (.*?) development tool actions to compatible AI-assistant clients\.?$/i);
  if (!isDynamic && matchExposes) {
    dynamicMatch = `${matchExposes[1]} MCP 服务端，向兼容的 AI 助手客户端公开 ${matchExposes[2]} 开发工具操作。`;
    isDynamic = true;
  }

  const matchGives = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) (Server|server) gives AI-powered development tools the ability to (.*?)\.?$/i);
  if (!isDynamic && matchGives) {
    let action = matchGives[3];
    action = action.replace(/work with your (.*?) projects and your app's codebase/i, '协同处理您的 $1 项目及应用代码库');
    action = action.replace(/build, debug and inspect your (.*?) app/i, '构建、调试与检查您的 $1 应用');
    action = action.replace(/build, debug and inspect your (.*)/i, '构建、调试与检查您的 $1');
    dynamicMatch = `针对 ${matchGives[1]} 的模型上下文协议 (MCP) 服务端，为 AI 辅助开发工具提供${action}的能力。`;
    isDynamic = true;
  }

  const matchProvides = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) server provides tools for (.*?)\.?$/i);
  if (!isDynamic && matchProvides) {
    let action = matchProvides[2];
    action = action.replace(/semantic code analysis, live diagnostics, and transformation of your non-google3 Go codebase/i, '语义代码分析、实时诊断和非 google3 Go 代码库的转换');
    dynamicMatch = `${matchProvides[1]} 模型上下文协议 (MCP) 服务端，提供用于 ${action} 的工具。`;
    isDynamic = true;
  }

  const matchInteractData = trimmed.match(/^Interact with your (.*?) data using natural language\. This MCP server (.*?)\.?$/i);
  if (!isDynamic && matchInteractData) {
    let action = matchInteractData[2];
    action = action.replace(/allows you to securely connect to your datasets to search the datasets, inspect table.*/i, '允许您安全地连接到数据集以搜索数据集、检查数据表并获取结构信息。');
    dynamicMatch = `使用自然语言与您的 ${matchInteractData[1]} 数据进行交互。该 MCP 服务端${action}`;
    isDynamic = true;
  }

  const matchConnectAI = trimmed.match(/^Connect your AI assistant(?:s)? to (.*?)(?:\. This MCP server|,)(?:\s+)?(enables|enabling) (.*?)\.?$/i);
  if (!isDynamic && matchConnectAI) {
    let action = matchConnectAI[3];
    action = action.replace(/data exploration and content management by allowing you to execute.*/i, '通过允许您执行自然语言查询，来实现数据探索与内容管理。');
    action = action.replace(/data discovery and governance by allowing you to.*/i, '通过允许您执行数据探索和治理，来实现数据发现与数据治理。');
    dynamicMatch = `将您的 AI 助手连接到 ${matchConnectAI[1]}。该 MCP 服务端${action}`;
    isDynamic = true;
  }

  const matchRemoteMCP = trimmed.match(/^The (.*?) (?:remote )?MCP server lets you (.*?)\.?$/i);
  if (!isDynamic && matchRemoteMCP) {
    let action = matchRemoteMCP[2];
    action = action.replace(/manage (.*?) resources/i, '管理 $1 资源');
    action = action.replace(/access and run (.*?) tools to (.*)/i, '访问和运行 $1 工具以：$2');
    action = action.replace(/manage Cloud SQL instances, manage users, create and restore backups.*/i, '管理 Cloud SQL 实例、管理用户、创建和恢复备份等');
    action = action.replace(/manage AlloyDB clusters and instances, manage users, create and restore.*/i, '管理 AlloyDB 集群和实例、管理用户、创建和恢复备份等');
    action = action.replace(/create, manage, and query Spanner resources from your AI-enabled development.*/i, '从您的 AI 辅助开发环境中创建、管理和查询 Spanner 资源');
    dynamicMatch = `${matchRemoteMCP[1]} 远程 MCP 服务端，允许您${action}。`;
    isDynamic = true;
  }

  const matchAllows = trimmed.match(/^(Allows running|Allows interacting with|Allows querying|Allows accessing|Provides tools to|Provides tools for|Provides tools) (.*?)\.? This tool runs on the host system outside of any sandboxes\.?$/i);
  if (!isDynamic && matchAllows) {
    const action = matchAllows[1].toLowerCase();
    const target = matchAllows[2].trim();
    let actionZh = '';
    if (action.includes('running')) actionZh = '允许运行';
    else if (action.includes('interacting')) actionZh = '允许与';
    else if (action.includes('querying')) actionZh = '允许查询';
    else if (action.includes('accessing')) actionZh = '允许访问';
    else if (action.includes('tools for') || action.includes('tools to') || action.includes('provides tools')) actionZh = '提供用于';
    
    let targetZh = target;
    const targetLower = target.toLowerCase();
    if (targetLower === 'cmd.exe commands on windows') targetZh = 'Windows 上的 cmd.exe 命令';
    else if (targetLower === 'ipconfig to inspect network settings on the host machine') targetZh = 'ipconfig 以检查宿主机的网络设置';
    else if (targetLower === 'querying active directory domain services on windows') targetZh = '在 Windows 上查询活动目录 (Active Directory) 域服务';
    else if (targetLower === 'bash shell commands') targetZh = 'bash Shell 命令';
    else if (targetLower === 'cmd shell commands') targetZh = 'cmd Shell 命令';
    else if (targetLower === 'the docker daemon') targetZh = 'Docker 守护进程';
    else if (targetLower === 'git repositories') targetZh = 'Git 仓库';
    else if (targetLower === 'search files using grep') targetZh = '使用 grep 搜索文件';
    else if (targetLower === 'managing homebrew packages') targetZh = '管理 Homebrew 软件包';
    else if (targetLower === 'interacting with a kubernetes cluster' || targetLower === 'a kubernetes cluster') targetZh = 'Kubernetes 集群';
    else if (targetLower === 'the npm package manager') targetZh = 'npm 包管理器';
    else if (targetLower === 'the pip package manager') targetZh = 'pip 包管理器';
    else if (targetLower === 'running python scripts and modules' || targetLower === 'python scripts and modules') targetZh = '运行 Python 脚本和模块';
    else if (targetLower === 'searching files using ripgrep') targetZh = '使用 ripgrep 搜索文件';
    else if (targetLower === 'a sqlite database') targetZh = 'SQLite 数据库';
    else if (targetLower === 'the command line tool curl') targetZh = '命令行工具 curl';
    else if (targetLower === 'the google cloud cli') targetZh = 'Google Cloud CLI';
    else if (targetLower === 'google cloud storage') targetZh = 'Google Cloud Storage';
    else if (targetLower === 'github repositories') targetZh = 'GitHub 仓库';
    else if (targetLower === 'gitlab repositories') targetZh = 'GitLab 仓库';
    else if (targetLower === 'gmail messages and drafts') targetZh = 'Gmail 邮件与草稿';
    else if (targetLower === 'google docs documents') targetZh = 'Google 文档';
    else if (targetLower === 'google drive files and folders') targetZh = 'Google 云端硬盘文件与文件夹';
    else if (targetLower === 'google sheets spreadsheets') targetZh = 'Google 表格';
    else if (targetLower === 'jira issues') targetZh = 'Jira 事务';
    else if (targetLower === 'slack channels and messages') targetZh = 'Slack 频道与消息';
    else if (targetLower === 'notion pages and databases') targetZh = 'Notion 页面与数据库';
    else if (targetLower === 'a postgresql database') targetZh = 'PostgreSQL 数据库';
    else if (targetLower === 'a mysql database') targetZh = 'MySQL 数据库';

    if (action.includes('tools for') || action.includes('tools to') || action.includes('provides tools')) {
      dynamicMatch = `${actionZh}${targetZh}的工具。该工具运行在沙盒外的宿主系统上。`;
    } else if (action.includes('interacting')) {
      dynamicMatch = `${actionZh}${targetZh}进行交互。该工具运行在沙盒外的宿主系统上。`;
    } else {
      dynamicMatch = `${actionZh}${targetZh}。该工具运行在沙盒外的宿主系统上。`;
    }
    isDynamic = true;
  }

  if (isDynamic) return text.replace(trimmed, dynamicMatch);

  // 1. Precise Match
  if (dict[trimmed]) return text.replace(trimmed, dict[trimmed]);
  
  const lowerTrimmed = trimmed.toLowerCase();
  for (const k in dict) {
    if (k.toLowerCase() === lowerTrimmed) return text.replace(trimmed, dict[k]);
  }

  // 2. Stripping punctuation & reconstructing
  let core = trimmed;
  let trailPunc = '';
  let matchPunc = '';
  const puncRegex = /(\.\.\.|…|\.|\?|!|:|：|？|！|。)$/;
  const puncMatch = core.match(puncRegex);
  if (puncMatch) {
    matchPunc = puncMatch[0];
    core = core.slice(0, -matchPunc.length).trim();
    if (matchPunc === '.') trailPunc = '.';
    else if (matchPunc === '?') trailPunc = '？';
    else if (matchPunc === '!') trailPunc = '！';
    else if (matchPunc === ':') trailPunc = '：';
    else trailPunc = matchPunc;
  }

  let coreTranslated = dict[core] || '';
  if (!coreTranslated) {
    const coreLower = core.toLowerCase();
    for (const key in dict) {
      if (key.toLowerCase() === coreLower) { coreTranslated = dict[key]; break; }
    }
  }
  if (coreTranslated) return text.replace(trimmed, coreTranslated + trailPunc);

  // 3. Fallback word-by-word (for single words)
  if (/[\u4e00-\u9fa5]/.test(core)) return text;
  const wordsCount = core.split(/\s+/).filter(Boolean).length;
  if (wordsCount > 1) return text;

  let temp = core;
  let replaced = false;
  const sortedKeys = Object.keys(combDict).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (key.length <= 3 && !/^[a-zA-Z0-9]+$/.test(key)) continue;
    const escapedKey = escapeReg(key);
    const startBoundary = /^[a-zA-Z0-9]/.test(key) ? '\\b' : '';
    const endBoundary = /[a-zA-Z0-9]$/.test(key) ? '\\b' : '';
    const regex = new RegExp(startBoundary + escapedKey + endBoundary, 'gi');
    if (regex.test(temp)) {
      temp = temp.replace(regex, combDict[key]);
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

function translateAttributes(root) {
  const attrs = ['title', 'aria-label', 'placeholder'];
  const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (const el of nodes) {
    if (el.closest && el.closest('pre, code, textarea, input[type="password"], .monaco-editor, .xterm')) continue;
    for (const attr of attrs) {
      const value = el.getAttribute && el.getAttribute(attr);
      if (!value) continue;
      const next = translateString(value);
      if (next !== value) el.setAttribute(attr, next);
    }
  }
}

function observeRoot(root = document.body) {
  if (!root || root.__agyTranslated) return;
  root.__agyTranslated = true;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach(translateNode);
  translateAttributes(root);
}

function startObserver() {
  observeRoot(document.body);
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) translateNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE) observeRoot(node);
      }
      if (mutation.type === 'characterData') translateNode(mutation.target);
    }
  });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true, characterData: true });
  window.__agyTranslatorObserver = observer;
}

function fetchCloudDict() {
  return Promise.resolve(false);
}

module.exports = { translateString, translateNode, observeRoot, startObserver, fetchCloudDict };
