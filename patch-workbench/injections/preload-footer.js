(function AGYCustomThemeLibraryBridge() {
  'use strict';
  const { ipcRenderer } = require('electron');
  let lastLibrarySignature = '';
  let syncing = false;

  function updateChoiceState(menu, config) {
    const activeId = config && config.enabled ? String(config.sourceThemeId || config.id || 'native') : 'native';
    menu.querySelectorAll('.agy-theme-choice[data-theme-id]').forEach(button => {
      const active = button.dataset.themeId === activeId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  async function syncMenu(force = false) {
    if (syncing) return;
    const menu = document.getElementById('agy-theme-menu');
    if (!menu) return;
    syncing = true;
    let result;
    try {
      result = await ipcRenderer.invoke('agy-theme:list-custom');
    } catch (error) {
      console.warn('[AGY Theme] custom theme list failed:', error);
      syncing = false;
      return;
    }
    const themes = result && Array.isArray(result.themes) ? result.themes : [];
    const active = result && result.active ? result.active : { enabled: false, id: 'native' };
    const signature = JSON.stringify(themes.map(theme => [theme.id, theme.name, theme.imageFile, theme.paletteId]));
    if (!force && signature === lastLibrarySignature && menu.querySelectorAll('[data-agy-custom-theme="item"]').length === themes.length) {
      updateChoiceState(menu, active);
      syncing = false;
      return;
    }
    lastLibrarySignature = signature;
    menu.querySelectorAll('[data-agy-custom-theme]').forEach(node => node.remove());
    const nativeButton = menu.querySelector('.agy-theme-native');
    if (!themes.length || !nativeButton) {
      updateChoiceState(menu, active);
      syncing = false;
      return;
    }

    const label = document.createElement('div');
    label.dataset.agyCustomTheme = 'label';
    label.textContent = '我的自定义皮肤';
    label.style.cssText = 'padding:9px 12px 4px;font-size:11px;font-weight:600;opacity:.68;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent);margin-top:4px;';
    menu.insertBefore(label, nativeButton);

    for (const theme of themes) {
      const button = document.createElement('button');
      button.className = 'agy-theme-choice';
      button.dataset.themeId = theme.id;
      button.dataset.agyCustomTheme = 'item';
      button.style.setProperty('--choice-accent', theme.accent);
      button.setAttribute('title', `使用自定义皮肤：${theme.name}`);
      button.innerHTML = '<span class="agy-theme-swatch"></span><span></span><small style="margin-left:auto;opacity:.58;font-size:10px">自定义</small>';
      button.children[1].textContent = theme.name;
      button.addEventListener('click', async event => {
        event.stopPropagation();
        try {
          const config = await ipcRenderer.invoke('agy-theme:set-custom', theme.id);
          updateChoiceState(menu, config);
        } catch (error) {
          console.warn('[AGY Theme] custom theme switch failed:', error);
        }
        const switcher = document.getElementById('agy-theme-switcher');
        if (switcher) switcher.classList.remove('open');
      });
      menu.insertBefore(button, nativeButton);
    }
    updateChoiceState(menu, active);
    syncing = false;
  }

  const observer = new MutationObserver(() => syncMenu());
  function start() {
    syncMenu(true).catch(() => {});
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(() => syncMenu().catch(() => {}), 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

(function AGYSupplementalTranslations() {
  'use strict';

  const exact = new Map([
    ['Confirm Undo', '确认撤销'],
    ['View Page', '查看页面'],
    ['Our servers are experiencing high traffic right now, please try again in a minute.', '当前服务器访问量较高，请稍后一分钟再试。'],
    ['Unknown: There was a network issue connecting to the server, please try again.', '网络连接服务器时出现问题，请重试。'],
    ['Agent execution terminated due to error.', '智能体执行因错误而终止。'],
    ['This undo action will not make any code changes.', '此次撤销操作不会改动任何代码。'],
    ['Agent execution failed.', '智能体执行失败。'],
    ['Lost connection to the language server. Agent features may not work.', '与语言服务器的连接已断开，智能体功能可能无法正常使用。'],
    ['Edit Conversation Title', '编辑对话标题'],
    ['Limited time', '限时'],
    ['Conversation Archived', '对话已归档'],
    ['This chat is archived.', '此对话已归档。'],
    ['Reading page', '正在读取页面'],
    ['Read page', '读取页面'],
    ['MCP Tool:', 'MCP 工具：'],
    ['Tool arguments', '工具参数'],
    ['Copied to clipboard', '已复制到剪贴板'],
    ['Created outline', '已创建大纲'],
    ['Extract user messages finished', '提取用户消息完成'],
    ['Run docker compose up finished', '运行 docker compose up 完成'],
    ['Upgrade Sub2API container finished', '升级 Sub2API 容器完成'],
    ['Customizations', '自定义功能'],
    ['Add MCP Servers', '添加 MCP 服务'],
    ['Plugins are packaged collections 共 skills and MCPs to help the Agent in Antigravity call Google developer products.', '插件是由技能和 MCP 服务组成的功能包，可帮助 Antigravity 智能体调用 Google 开发者产品。'],
    ['Curated collection 共 agent skills for science.', '面向科研场景的精选智能体技能合集。'],
    ['Build and prototype location-aware applications with Google Maps Platform. Integrate interactive maps, search and inspect Places details, calculate optimal routes.', '使用 Google Maps Platform 构建和验证位置感知应用。可集成交互式地图、搜索并查看地点详情，以及计算最优路线。'],
    ['Specialized suite 共 agent skills to interact with your cloud and productivity ecosystem (Google Cloud, Google Workspace, and beyond).', '用于连接云服务与生产力生态的专业智能体技能套件，支持 Google Cloud、Google Workspace 等服务。'],
    ['Outside 共 folders file access policy', '项目文件夹外部的文件访问策略'],
    ['Configures how the Agent handles file tools that target paths outside the workspace folders.', '配置智能体如何处理目标路径位于工作区文件夹之外的文件工具操作。'],
    ['Agent settings and permissions for conversations outside 共 projects.', '用于项目之外对话的智能体设置和权限。'],
    ['When toggled on, Antigravity will use your AI credits to fulfill model requests once you\'re out of model quota. Antigravity will always use your model quota first before using AI credits.', '启用后，当模型配额用尽时，Antigravity 将使用 AI 点数继续完成模型请求；系统始终优先使用模型配额。'],
    ['You can upgrade to the Google AI Ultra plan to get higher rate limits.', '您可以升级到 Google AI Ultra 计划，以获得更高的速率限制。'],
    ["View Usage", "查看用量"],
    ["Copy path", "复制路径"],
    ["Delete plugin", "删除插件"],
    ["Using the Google Antigravity Python SDK to build AI agents", "使用 Google Antigravity Python SDK 构建 AI 智能体"],
    ["Five Hour Limit Remaining", "5 小时额度剩余"],
    ["Weekly Limit Remaining", "每周额度剩余"],
    ["Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu.", "有新版本可用时自动提示重启应用。关闭后，你仍可从应用菜单手动检查更新。"],
    ["Work with local agents from another device.", "从其他设备使用本地智能体。"],
    ["Remote Control", "远程控制"],
    ["Enable Remote Control", "启用远程控制"],
    ["to back up your data and run the migration.", "备份数据并执行迁移。"],
    ["Follow the guide at", "请按照以下指南操作："],
    ["Google3 chats will be regrouped into their workspaces in the sidebar.", "Google3 对话将按所属工作区重新分组并显示在侧边栏中。"],
    ["This migration may mess up your settings, chats, and sidebar.", "此迁移可能会影响你的设置、对话和侧边栏布局。"],
    ["Regroup Google3 Chats", "重新分组 Google3 对话"],
    ["Developer-only tools. These settings are stored locally in this browser and do not affect other users.", "仅供开发者使用的工具。这些设置只保存在当前浏览器本地，不会影响其他用户。"],
    ["Models & Usage", "模型与用量"],
    ["Manage your model quota and credits.", "管理模型额度和点数。"],
    ["Experimental features", "实验性功能"],
    ["Toggle Terminal", "切换终端"],
    ["Add to Chat/Quote", "添加到聊天 / 引用"],
    ["Previous Pane Tab", "上一个窗格标签页"],
    ["Next Pane Tab", "下一个窗格标签页"],
    ["Manage Antigravity app settings.", "管理 Antigravity 应用设置。"],
    ["Browse and enable plugins from the Build With Google catalog.", "浏览并启用 Google 构建目录中的插件。"],
    ["Refresh MCP servers", "刷新 MCP 服务"],
    ["Interrupt the agent and send immediately.", "中断智能体并立即发送。"],
    ["Keyboard shortcuts", "键盘快捷键"],
    ["Queue until after the current turn.", "排队至当前轮次结束后发送。"],
    ["Project options", "项目选项"],
    ["More options", "更多选项"],
    ["More actions", "更多操作"],
    ["Environment: Local", "环境：本地"],
    ["Select Environment", "选择环境"],
    ["Select a model using the model selector in the input box", "请使用输入框中的模型选择器选择模型"],
    ["does not exist.", "不存在。"],
    ["Missing Folder", "文件夹不存在"],
    ["Mark Read", "标记为已读"],
    ["Create New", "新建"],
    ["Use Existing", "使用现有项目"],
    ["Project already exists", "项目已存在"],
    ["Registration Guide", "注册指南"],
    ["Sidebar after conversations are regrouped by workspace", "按工作区重新分组后的侧边栏"],
    ["Current sidebar grouping", "当前侧边栏分组"],
    ["for more information (this migration is experimental).", "了解更多信息（此迁移功能为实验性功能）。"],
    ["Google3 chats will be regrouped into their workspaces in the sidebar. See", "Google3 对话将按所属工作区重新分组并显示在侧边栏中。请参阅"],
    ["Copy project", "复制项目"],
    ["File Viewer", "文件查看器"],
    ["View Diff", "查看差异"],
    ["File path breadcrumbs", "文件路径导航"],
    ["File Viewer header", "文件查看器标题栏"],
    ["Send Now", "立即发送"],
    ["Dismiss notification", "关闭通知"],
    ["Yes, and always allow in this project", "是，并始终允许此项目"],
    ["Yes, and always allow in this conversation", "是，并始终允许此对话"],
    ["Mark Unread", "标记为未读"],
    ["This migration is experimental.", "此迁移功能为实验性功能。"],
    ["We will reorganize your Google3 chats into their workspaces in the sidebar. See", "我们会将你的 Google3 对话按所属工作区重新整理到侧边栏中。请参阅"],
    ["Merge Google3 chats", "合并 Google3 对话"],
    ["Conversation Name", "对话名称"],
    ["Conversation ID", "对话 ID"],
    ["Workspace Name", "工作区名称"],
    ["Project Name", "项目名称"],
    ["Mark as Unread", "标记为未读"],
    ["Delete Conversation", "删除对话"],
    ["Config Guide", "配置指南"],
    ["Dismiss error", "关闭错误提示"],
    ["Unknown: Agent execution terminated due to error.", "未知：智能体执行因错误而终止。"],
    ["Sent input to", "已向以下目标发送输入"],
    ["Sending input to", "正在向以下目标发送输入"]
    ["Refresh","刷新"],
    ["Failed to stop agent","停止智能体失败"],
    ["Plugin Operation Error:","插件操作错误："]
  ]);
  globalThis.__agySupplementalTranslations = exact;

  function translateDynamic(value) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    if (exact.has(text)) return exact.get(text);
    let match = text.match(/^Toggle\s+(.+)$/i);
    if (match) return `切换 ${match[1]}`;
    match = text.match(/^(\d+)\s+tools?\s+enabled$/i);
    if (match) return `已启用 ${match[1]} 个工具`;
    match = text.match(/^Executor is not currently running \(error ID:\s*([^)]+)\)$/i);
    if (match) return `执行器当前未运行（错误 ID：${match[1]}）`;
    match = text.match(/^Requesting permission to read\s+(.+)$/i);
    if (match) return `正在请求读取 ${match[1]} 的权限`;
    if (/^When toggled on, Antigravity will use your AI credits/i.test(text)) {
      return '启用后，当模型配额用尽时，Antigravity 将使用 AI 点数继续完成模型请求；系统始终优先使用模型配额。';
    }
    if (/^You can upgrade to the Google AI Ultra plan/i.test(text)) {
      return '您可以升级到 Google AI Ultra 计划，以获得更高的速率限制。';
    }
    if (/^The GKE remote MCP server acts as an intermediary/i.test(text)) {
      return 'GKE 远程 MCP 服务在大语言模型与 GKE 集群之间充当中介，为集群资源查询和操作提供安全、结构化的交互方式。';
    }
    if (/^Investigate and fix software issues using AI-powered root cause analysis/i.test(text)) {
      return '使用 AI 根因分析调查并修复软件问题。连接 Antimetal 账号后，可读取问题、调查过程和分析结果。';
    }
    if (/^Ask questions\. Get answers\. (?:The MCP is a server|This MCP server)/i.test(text)) {
      return '让编码智能体通过自然语言查询 PostHog 数据并获取结果，帮助分析产品使用情况和定位问题。';
    }
    if (/^Within each group, models share a weekly limit and a 5-hour limit\./i.test(text)) {
      return '每个模型组共享每周额度和 5 小时额度。额度会根据模型成本按比例消耗，因此较短的任务或更具性价比的模型可让额度维持更久。5 小时额度用于平衡总体需求并公平分配全局容量；每周额度则与您的个人订阅等级直接关联。';
    }
    match = text.match(/^You have used some (?:共\s*)?your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?$/i);
    if (match) return `您已使用部分每周额度，将在 ${match[1]} 天 ${match[2]} 小时后完全恢复。`;
    match = text.match(/^You have used some (?:共\s*)?your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?$/i);
    if (match) return `您已使用部分 5 小时额度，将在 ${match[1]} 小时 ${match[2]} 分钟后完全恢复。`;
    match = text.match(/^(\d+) files?, (\d+) folders?, (\d+) pages?$/i);
    if (match) return `${match[1]} 个文件，${match[2]} 个文件夹，${match[3]} 个页面`;
    match = text.match(/^(\d+) files?, (\d+) search(?:es)?, (\d+) pages?$/i);
    if (match) return `${match[1]} 个文件，${match[2]} 次搜索，${match[3]} 个页面`;
    match = text.match(/^(\d+) files?, (\d+) tasks?$/i);
    if (match) return `${match[1]} 个文件，${match[2]} 个任务`;
    match = text.match(/^Post "([^"]+)": EOF$/i);
    if (match) return `请求“${match[1]}”失败：连接意外中断（EOF）`;
    return '';
  }

  globalThis.__agyTranslateSupplementalText = translateDynamic;

  function translateTextNode(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const original = String(node.nodeValue || '');
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    const translated = translateDynamic(original);
    if (translated && translated !== original.trim()) node.nodeValue = `${leading}${translated}${trailing}`;
  }

  function translateElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return;
    for (const attribute of ['title', 'placeholder', 'aria-label']) {
      const original = element.getAttribute && element.getAttribute(attribute);
      const translated = translateDynamic(original);
      if (translated && translated !== original) element.setAttribute(attribute, translated);
    }
  }

  function translateTree(root) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType === Node.ELEMENT_NODE) {
      translateElement(root);
      if (root.shadowRoot) observeRoot(root.shadowRoot);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) {
      if (current.nodeType === Node.TEXT_NODE) translateTextNode(current);
      else {
        translateElement(current);
        if (current.shadowRoot) observeRoot(current.shadowRoot);
      }
    }
  }

  const observed = new WeakSet();
  function observeRoot(root) {
    if (!root || observed.has(root)) return;
    observed.add(root);
    translateTree(root);
    const observer = new MutationObserver(mutations => {
      observer.disconnect();
      try {
        for (const mutation of mutations) {
          if (mutation.type === 'characterData') translateTextNode(mutation.target);
          if (mutation.type === 'attributes') translateElement(mutation.target);
          if (mutation.type === 'childList') mutation.addedNodes.forEach(translateTree);
        }
      } finally {
        observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['title', 'placeholder', 'aria-label'] });
  }

  function start() {
    observeRoot(document.documentElement);
    setInterval(() => {
      const quotaWidget = document.getElementById('antigravity-quota-widget');
      if (quotaWidget && quotaWidget.shadowRoot) observeRoot(quotaWidget.shadowRoot);
    }, 700);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

(function AGYTranslationAuditQualityLayer() {
  'use strict';

  const { ipcRenderer, clipboard } = require('electron');
  const rawInvoke = ipcRenderer.invoke.bind(ipcRenderer);
  let cleaning = false;
  let lastAudit = { rawCount: 0, actionable: [], excluded: [] };

  const UI_SINGLE_WORDS = new Set([
    'accept', 'account', 'actions', 'add', 'advanced', 'allow', 'appearance', 'apply', 'approve',
    'back', 'browse', 'cancel', 'clear', 'close', 'confirm', 'connect', 'continue', 'copy', 'create',
    'delete', 'deny', 'disable', 'download', 'edit', 'enable', 'error', 'export', 'failed', 'finish',
    'general', 'hide', 'history', 'import', 'install', 'language', 'loading', 'manage', 'new', 'next',
    'open', 'permissions', 'previous', 'project', 'refresh', 'reject', 'remove', 'rename', 'reset',
    'retry', 'run', 'running', 'save', 'search', 'select', 'settings', 'share', 'show', 'skip',
    'start', 'status', 'stop', 'submit', 'success', 'theme', 'tools', 'uninstall', 'update', 'upload',
    'view', 'warning', 'workspace'
  ]);
  const TECHNICAL_UI_WORDS = new Set([
    'agent', 'ai', 'android', 'antigravity', 'api', 'chrome', 'claude', 'cloud', 'code', 'codex',
    'crm', 'dart', 'devtools', 'docker', 'firebase', 'flutter', 'gemini', 'git', 'github', 'gitlab',
    'google', 'gpt', 'ide', 'javascript', 'kubernetes', 'maps', 'mcp', 'npm', 'openai', 'platform', 'posthog', 'python',
    'sdk', 'sql', 'typescript', 'url', 'web', 'workspace'
  ]);

  function normalize(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function translatableEnglishWords(text) {
    return (String(text || '').match(/[A-Za-z][A-Za-z'-]*/g) || [])
      .map(word => word.toLowerCase())
      .filter(word => !TECHNICAL_UI_WORDS.has(word));
  }

  function humanRoute(route) {
    const value = String(route || '');
    if (!value || value === '/') return '首页 / 对话列表';
    if (value.startsWith('/onboarding')) return '登录与初始化页面';
    if (value.startsWith('/settings')) return '设置页面';
    if (value.startsWith('/c/')) return '对话页面';
    return value.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi, '[动态编号]');
  }

  function humanElement(item) {
    const attributeMap = {
      textContent: '可见文字', title: '悬停提示', placeholder: '输入提示',
      'aria-label': '无障碍标签', value: '按钮文字'
    };
    const tagMap = { button: '按钮', h1: '一级标题', h2: '标题', h3: '小标题', h4: '卡片标题', h5: '卡片标题', h6: '卡片标题', p: '说明文字', small: '辅助说明', label: '设置标签', li: '列表说明', span: '行内文字', div: '普通文字', input: '输入框' };
    return `${tagMap[item.element] || item.element || '界面元素'} · ${attributeMap[item.attribute] || item.attribute || '可见文字'}`;
  }

  function classify(item) {
    const text = normalize(item && item.text);
    const lower = text.toLowerCase();
    const selector = String(item && item.selector || '').toLowerCase();
    const route = String(item && item.route || '');
    const base = {
      ...item,
      text,
      page: humanRoute(route),
      elementDescription: humanElement(item || {}),
      suggestedAction: '将界面英文加入汉化字典，并结合所在页面确认语义'
    };

    function excluded(category, reason) {
      return { ...base, decision: 'ignore', category, confidence: 0.99, reason, suggestedAction: '保留原文，不计入汉化缺失' };
    }
    function actionable(confidence, reason, category = 'ui_text', priority = 'normal') {
      const categoryLabels = {
        partial_translation: '半汉化文本',
        ui_description: '关键简介',
        ui_control: '按钮或标题',
        ui_text: '界面文字'
      };
      return { ...base, decision: 'translate', category, categoryLabel: categoryLabels[category] || '界面文字', priority, confidence, reason };
    }

    const supplemental = globalThis.__agyTranslateSupplementalText && globalThis.__agyTranslateSupplementalText(text);
    if (supplemental) return excluded('already_translated', `已由补充汉化规则翻译为：${supplemental}`);
    if (!text || !/[A-Za-z]/.test(text)) return excluded('not_english_ui', '没有需要翻译的英文内容');
    const hasChinese = /[一-鿿]/.test(text);
    if (/^(?:gemini|claude|gpt|codex)(?:[\s-]+(?:\d|flash|pro|ultra|opus|sonnet|haiku)|$)/i.test(text)) {
      return excluded('model_name', '模型名称属于产品标识，不应翻译');
    }
    if (/^(?:antigravity|openai|google|github|gitlab|mcp|api|sdk|cli)$/i.test(text)) {
      return excluded('product_name', '产品名或技术缩写应保留原文');
    }
    if (/^[a-f0-9]{8}-[a-f0-9-]{27,}(?:-\d+)?$/i.test(text) || /^[a-z0-9_-]{18,}$/i.test(text)) {
      return excluded('identifier', '动态 ID、任务编号或内部标识不是界面文案');
    }
    if (!/\s/.test(text) && /\d/.test(text) && /^[a-z0-9._-]+$/i.test(text)) return excluded('identifier', '账号名、动态编号或内部标识不是界面文案');
    if (/^[a-z]:\\/i.test(text) || /(?:^|[\\/])[^\s\\/]+\.(?:js|ts|tsx|jsx|json|md|css|html|py|rs|toml|yml|yaml|txt|asar|exe|dll|png|jpg|webp)(?:\b|$)/i.test(text)) {
      return excluded('file_or_path', '文件名或路径不需要汉化');
    }
    if (/^(?:ctrl|alt|shift|cmd|win)(?:\+[^\s]+)+$/i.test(text)) return excluded('shortcut', '键盘快捷键应保留原样');
    if (/^(?:git|gh|npm|node|docker(?:-compose)?|cargo|curl|powershell|cmd|python|rg|cat|echo|findstr|get-childitem|get-process|invoke-webrequest)\b/i.test(text)) {
      return excluded('command', '这是命令或工具参数，不是可翻译界面文案');
    }
    if (selector.includes('convo-pill')) return excluded('conversation_title', '这是用户或 AI 生成的对话标题，不属于软件固定文案');
    if (selector.includes('conversation-row-sidebar')) return excluded('conversation_title', '这是用户或 AI 生成的对话标题，不属于软件固定文案');
    if (route === '/' && String(item.element || '').toLowerCase() === 'a' && item.attribute === 'aria-label' && selector.includes('w-full.h-full')) return excluded('conversation_title', '这是用户或 AI 生成的对话标题，不属于软件固定文案');
    if (route.startsWith('/c/') && selector.includes('truncate.inline-block')) return excluded('conversation_title', '这是用户或 AI 生成的对话标题，不属于软件固定文案');
    if (/^Task:\s+/i.test(text) && selector.includes('truncate')) return excluded('agent_task_title', '这是智能体生成的任务标题，不属于软件固定界面文案');
    if (/^(?:Wait for task-|Run .+ finished$|Error while running:|Sent input to$|Sending input to$)/i.test(text) && route.startsWith('/c/')) return excluded('agent_activity', '这是智能体执行过程或任务状态，不属于固定界面文案');
    if (route.startsWith('/c/') && selector.includes('text-secondary-foreground') && (/(?:finished|Timer has expired|Command may require input)$/i.test(text))) return excluded('agent_activity', '这是智能体生成的执行步骤或运行状态，不属于固定界面文案');
    if (route.startsWith('/c/') && selector.includes('inline-flex') && /\b[a-z][a-z0-9]*_[a-z0-9_]+\b/i.test(text)) return excluded('internal_or_search_text', '这是工具生成的内部键或搜索内容，不属于固定界面文案');
    if (/^\$env:/i.test(text)) return excluded('command', '这是 PowerShell 命令内容，不属于固定界面文案');
    if (selector.includes('shadow:#antigravity-quota-widget') && /@/.test(text)) return excluded('account_identifier', '这是账号名称或邮箱，不属于固定界面文案');
    if (/^切换\s+[a-z0-9._-]+$/i.test(text)) return excluded('localized_with_terms', '界面动作已汉化，后半部分是插件或工具标识，应保留原文');
    if (selector.includes('truncate.inline-block') && (route === '/' || selector.includes('text-sm.h-6'))) return excluded('conversation_title', '这是用户或 AI 生成的对话标题，不属于软件固定文案');
    if (selector.includes('h4.flex') && /^test\b/i.test(text)) return excluded('agent_task_title', '这是测试任务标题，不属于软件固定界面文案');
    if (/^\/\s*[a-z0-9_-]+$/i.test(text)) return excluded('tool_command', '这是工具命令名称，不属于界面文案');
    if (/invalid_workspace_selected|\bcursor\b.*\bconfig path\b/i.test(text)) return excluded('internal_or_search_text', '这是内部错误键或搜索内容，不属于固定界面文案');
    if (/^https? scheme$/i.test(text)) return excluded('technical_term', '这是协议技术术语，应保留原文');
    if ((/^"/.test(text) || /\bOR\b/.test(text)) && (selector.includes('inline-flex') || route.startsWith('/c/'))) return excluded('search_query', '这是用户或智能体生成的搜索词，不属于固定界面文案');
    if (/^Sub2API\b/i.test(text) && selector.includes('inline-flex')) return excluded('search_query', '这是用户或智能体生成的搜索词，不属于固定界面文案');
    if (selector.includes('sr-only') && /^(?:ran|read|created|explored|searched|updated|wrote|edited)\b/i.test(text)) {
      return excluded('agent_activity', '这是代理执行过程的辅助播报，不属于固定界面文案');
    }
    if (/\bsite:|\bor\b.*\bgithub\b|^".*"$/.test(lower)) return excluded('user_content', '这是搜索词或用户内容，不属于软件固定文案');
    if (/^[\w.-]+\.(?:com|net|org|io|ai)$/i.test(text) || /^(?:https?:\/\/|net::|[a-z_]+\.[a-z_]+)/i.test(text)) {
      return excluded('technical_status', '域名、错误码或技术状态应保留原文');
    }
    if (/^[a-z][a-z0-9_-]*_[a-z0-9_-]+$/i.test(text)) return excluded('internal_key', '内部键名不属于用户界面文案');

    const words = text.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    const meaningfulEnglish = translatableEnglishWords(text);
    const elementName = String(item.element || '').toLowerCase();
    const isDescription = ['p', 'small', 'li'].includes(elementName)
      || /(?:description|subtitle|helper|support|caption|secondary|summary|explanation|setting.*text|card.*text|plugin|skill|mcp)/i.test(selector)
      || (text.length >= 36 && /(?:role.?=.?(?:dialog|listitem)|settings|preferences|customization)/i.test(selector));

    if (hasChinese && meaningfulEnglish.length >= 2) {
      return actionable(0.99, '文本中同时存在中文和仍可阅读的英文语句，属于未完成或错误的半汉化内容', 'partial_translation', 'high');
    }
    if (hasChinese) {
      return excluded('localized_with_terms', '主体内容已经是中文，仅保留产品名或技术术语');
    }
    if (words.length === 1) {
      return UI_SINGLE_WORDS.has(lower)
        ? actionable(0.96, '常见的单词型按钮、菜单或状态文本', 'ui_control')
        : excluded('ambiguous_single_word', '单独出现的专有词或内容词，缺少足够界面语义');
    }
    if (isDescription && text.length <= 800 && words.length <= 120 && !/[{}[\]<>`$]/.test(text)) {
      return actionable(0.97, '位于卡片简介、设置说明或帮助文本中，是理解功能用途的关键固定文案', 'ui_description', 'high');
    }
    if (['button', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'label'].includes(elementName) || ['placeholder', 'aria-label'].includes(item.attribute)) {
      return actionable(0.98, '位于按钮、标题、设置标签或输入提示中，属于高可信界面文案', 'ui_control');
    }
    if (/\b(?:error|failed|warning|confirm|connection|server|please|cannot|unable|success|permission|install|update|undo|retry)\b/i.test(text)) {
      return actionable(0.94, '用户可见的错误、确认、状态或操作提示', 'ui_text');
    }
    if (text.length <= 120 && words.length <= 16 && !/[{}[\]<>`$]/.test(text)) {
      return actionable(0.82, '短句结构符合界面说明文本，需要人工确认具体译法', 'ui_text');
    }
    return excluded('content_or_log', '更像内容、日志或工具输出，不纳入固定界面汉化');
  }

  function dedupe(items) {
    const merged = new Map();
    for (const item of items) {
      const judged = classify(item);
      const key = `${judged.text.toLowerCase()}\u0000${judged.page}\u0000${judged.elementDescription}`;
      const existing = merged.get(key);
      if (existing) {
        existing.count = (Number(existing.count) || 1) + (Number(judged.count) || 1);
        if (judged.lastSeen > existing.lastSeen) existing.lastSeen = judged.lastSeen;
      } else {
        merged.set(key, { ...judged, count: Number(judged.count) || 1 });
      }
    }
    return Array.from(merged.values());
  }

  function auditItems(items) {
    const judged = dedupe(Array.isArray(items) ? items : []);
    const priorityWeight = item => item.priority === 'high' ? 2 : item.priority === 'low' ? 0 : 1;
    const actionable = judged.filter(item => item.decision === 'translate').sort((a, b) => priorityWeight(b) - priorityWeight(a) || b.confidence - a.confidence || b.count - a.count);
    const excluded = judged.filter(item => item.decision !== 'translate');
    return { rawCount: judged.length, actionable, excluded };
  }

  function collectQuotaWidgetCandidates() {
    const host = document.getElementById('antigravity-quota-widget');
    const root = host && host.shadowRoot;
    if (!root) return [];
    const candidates = [];
    const now = new Date().toISOString();
    const push = (value, element, attribute) => {
      const text = normalize(value);
      if (!text || !/[A-Za-z]/.test(text)) return;
      candidates.push({
        text,
        route: `${location.pathname || ''}${location.hash || ''}`.slice(0, 240),
        element: element && element.tagName ? element.tagName.toLowerCase() : '',
        attribute,
        selector: 'shadow:#antigravity-quota-widget',
        count: 1,
        firstSeen: now,
        lastSeen: now,
        source: 'quota-shadow-dom'
      });
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) {
      if (current.nodeType === Node.TEXT_NODE) {
        push(current.nodeValue, current.parentElement, 'textContent');
      } else if (current.nodeType === Node.ELEMENT_NODE) {
        for (const attribute of ['title', 'placeholder', 'aria-label']) {
          if (current.hasAttribute && current.hasAttribute(attribute)) push(current.getAttribute(attribute), current, attribute);
        }
      }
    }
    return candidates;
  }

  function collectSettingsSurfaceCandidates() {
    const candidates = [];
    const now = new Date().toISOString();
    const route = `${location.pathname || ''}${location.hash || ''}`.slice(0, 240);
    const ignoredHosts = '#antigravity-translation-audit, #antigravity-quota-widget, #agy-theme-switcher';
    const scopeSelector = [
      '[role="dialog"]',
      '[aria-modal="true"]',
      '[data-testid*="settings" i]',
      '[class*="settings" i]',
      '[class*="preferences" i]',
      '[class*="customization" i]'
    ].join(',');
    const scopes = [...document.querySelectorAll(scopeSelector)].filter(element => {
      if (!element || element.closest(ignoredHosts)) return false;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width >= 320 && rect.height >= 180 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    const uniqueScopes = scopes.filter((scope, index) => !scopes.some((other, otherIndex) => otherIndex < index && other.contains(scope)));

    const selectorHint = element => {
      if (!element || !element.tagName) return 'settings-surface';
      const id = element.id ? `#${element.id}` : '';
      const classes = [...element.classList].slice(0, 3).map(name => `.${name}`).join('');
      const role = element.getAttribute('role');
      return `${element.tagName.toLowerCase()}${id}${classes}${role ? `[role="${role}"]` : ''}`.slice(0, 260);
    };
    const push = (value, element, attribute, scope) => {
      if (candidates.length >= 1600) return;
      const text = normalize(value);
      if (!text || !/[A-Za-z]/.test(text) || text.length > 1000) return;
      if (!element || element.closest(ignoredHosts) || element.closest('script, style, code, pre, textarea')) return;
      if (!element.getClientRects().length) return;
      candidates.push({
        text,
        route,
        element: element.tagName ? element.tagName.toLowerCase() : '',
        attribute,
        selector: `${selectorHint(scope)} > ${selectorHint(element)}`,
        count: 1,
        firstSeen: now,
        lastSeen: now,
        source: 'visible-settings-surface'
      });
    };
    const scanRoot = (root, scope) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let current;
      while ((current = walker.nextNode())) {
        if (current.nodeType === Node.TEXT_NODE) {
          push(current.nodeValue, current.parentElement, 'textContent', scope);
          continue;
        }
        if (current.nodeType !== Node.ELEMENT_NODE) continue;
        for (const attribute of ['title', 'placeholder', 'aria-label']) {
          if (current.hasAttribute(attribute)) push(current.getAttribute(attribute), current, attribute, scope);
        }
        if (current.shadowRoot) scanRoot(current.shadowRoot, scope);
      }
    };
    for (const scope of uniqueScopes) scanRoot(scope, scope);
    return candidates;
  }

  async function cleanStoredReport(result) {
    const original = [
      ...(result && Array.isArray(result.items) ? result.items : []),
      ...collectQuotaWidgetCandidates(),
      ...collectSettingsSurfaceCandidates()
    ];
    const audit = auditItems(original);
    lastAudit = audit;
    const originalKeys = original.map(item => `${normalize(item.text)}\u0000${item.attribute}`).sort().join('\n');
    const cleanKeys = audit.actionable.map(item => `${item.text}\u0000${item.attribute}`).sort().join('\n');
    if (!cleaning && originalKeys !== cleanKeys) {
      cleaning = true;
      try {
        await rawInvoke('translations:clear-missing');
        if (audit.actionable.length) await rawInvoke('translations:record-missing', audit.actionable);
      } finally {
        cleaning = false;
      }
    }
    return { ...result, items: audit.actionable, auditSummary: { raw: audit.rawCount, actionable: audit.actionable.length, excluded: audit.excluded.length } };
  }

  ipcRenderer.invoke = async function(channel, ...args) {
    if (channel === 'translations:record-missing' && !cleaning) {
      const audit = auditItems(args[0]);
      if (!audit.actionable.length) return { success: true, count: 0, ignored: audit.excluded.length };
      return rawInvoke(channel, audit.actionable);
    }
    if (channel === 'translations:get-missing') {
      return cleanStoredReport(await rawInvoke(channel, ...args));
    }
    return rawInvoke(channel, ...args);
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function enhanceDialog(host) {
    const root = host && host.shadowRoot;
    if (!root || root.__agyAuditEnhanced === true) return;
    root.__agyAuditEnhanced = true;
    const style = document.createElement('style');
    style.textContent = `
      .row { grid-template-columns: minmax(0,1fr) auto !important; gap: 14px !important; }
      .audit-title-line { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
      .audit-chip { display:inline-flex; align-items:center; min-height:18px; padding:1px 7px; border-radius:999px; font-size:10px; font-weight:600; background:color-mix(in srgb,#22a06b 14%,transparent); color:#16845a; border:1px solid color-mix(in srgb,#22a06b 28%,transparent); }
      .audit-chip.high { background:color-mix(in srgb,#e18b2d 15%,transparent); color:#b56612; border-color:color-mix(in srgb,#e18b2d 34%,transparent); }
      .audit-reason { margin-top:5px; font-size:11px; line-height:1.45; color:var(--vscode-editor-foreground,CanvasText); opacity:.84; }
      .audit-meta { margin-top:5px; color:var(--vscode-descriptionForeground,GrayText); font-size:10px; line-height:1.45; overflow-wrap:anywhere; }
      .audit-confidence { display:block; margin-top:5px; font-size:10px; color:var(--vscode-descriptionForeground,GrayText); }
    `;
    root.appendChild(style);
    const subtitle = root.querySelector('.subtitle');
    if (subtitle) subtitle.textContent = '检查标题、按钮、卡片简介、设置说明和帮助文本；优先发现长简介与中英混杂的半汉化内容';
    const statLabels = root.querySelectorAll('.stat span');
    if (statLabels[0]) statLabels[0].textContent = '待处理文本';
    if (statLabels[1]) statLabels[1].textContent = '高优先级';
    if (statLabels[2]) statLabels[2].textContent = '已排除噪声';
    const copyButton = root.querySelector('.copy');
    if (copyButton) copyButton.textContent = '复制 AI 报告';

    async function refreshEnhanced() {
      const list = root.querySelector('.list');
      const status = root.querySelector('.status');
      if (status) status.textContent = '正在执行严格判定并清理历史噪声…';
      const result = await ipcRenderer.invoke('translations:get-missing');
      const audit = lastAudit;
      const actionable = audit.actionable;
      const highConfidence = actionable.filter(item => item.priority === 'high').length;
      const filteredRate = audit.rawCount ? Math.round((audit.excluded.length / audit.rawCount) * 1000) / 10 : 0;
      const totalNode = root.querySelector('.total');
      const sessionNode = root.querySelector('.session');
      const coverageNode = root.querySelector('.coverage');
      if (totalNode) totalNode.textContent = String(actionable.length);
      if (sessionNode) sessionNode.textContent = String(highConfidence);
      if (coverageNode) coverageNode.textContent = `${filteredRate}%`;
      const search = root.querySelector('.search');

      function render() {
        const query = normalize(search && search.value).toLowerCase();
        const filtered = query ? actionable.filter(item => `${item.text} ${item.reason} ${item.page} ${item.elementDescription}`.toLowerCase().includes(query)) : actionable;
        if (!list) return;
        if (!filtered.length) {
          list.innerHTML = '<div class="empty">没有发现需要汉化的固定界面英文。模型名、命令、路径和对话内容已自动排除。</div>';
          return;
        }
        list.innerHTML = filtered.map(item => `
          <div class="row">
            <div>
              <div class="audit-title-line"><div class="source">${escapeHtml(item.text)}</div><span class="audit-chip${item.priority === 'high' ? ' high' : ''}">${escapeHtml(item.categoryLabel || '建议汉化')}</span></div>
              <div class="audit-reason">判定理由：${escapeHtml(item.reason)}</div>
              <div class="audit-meta">页面：${escapeHtml(item.page)}　·　位置：${escapeHtml(item.elementDescription)}</div>
              <span class="audit-confidence">AI 置信度：${Math.round(item.confidence * 100)}%　·　建议动作：加入汉化字典并人工确认语义</span>
            </div>
            <span class="count">出现 ${Number(item.count) || 1} 次</span>
          </div>`).join('');
      }

      if (search) search.oninput = render;
      render();
      if (status) {
        status.textContent = `已从 ${audit.rawCount} 个候选项中确认 ${actionable.length} 个待汉化项，排除 ${audit.excluded.length} 个噪声项`;
        status.title = result && result.path ? result.path : '';
      }
    }

    const refreshButton = root.querySelector('.refresh');
    if (refreshButton) refreshButton.onclick = () => refreshEnhanced().catch(error => {
      const status = root.querySelector('.status');
      if (status) status.textContent = `刷新失败：${error.message}`;
    });
    if (copyButton) copyButton.onclick = async () => {
      await refreshEnhanced();
      const report = {
        schema: 'agy.translation-audit.v3',
        generatedAt: new Date().toISOString(),
        purpose: '供人工和 AI 补充 Antigravity 中文翻译使用',
        summary: {
          candidatesScanned: lastAudit.rawCount,
          translationRequired: lastAudit.actionable.length,
          noiseExcluded: lastAudit.excluded.length
        },
        instructionsForAI: [
          '只翻译 decision 为 translate 的软件固定界面文本。',
          '优先处理 priority 为 high 的关键简介和半汉化文本，再处理按钮与标题。',
          '卡片简介、设置说明、帮助文本是理解功能的关键，不得因为句子较长而忽略。',
          '保留模型名、产品名、命令、文件名、路径、快捷键和内部标识。',
          '结合 page、elementDescription、reason 判断上下文，不要逐字硬译。'
        ],
        items: lastAudit.actionable.map(item => ({
          sourceText: item.text,
          decision: item.decision,
          category: item.category,
          categoryLabel: item.categoryLabel || '界面文字',
          priority: item.priority || 'normal',
          confidence: item.confidence,
          reason: item.reason,
          page: item.page,
          element: item.elementDescription,
          selector: item.selector || '',
          occurrences: Number(item.count) || 1,
          suggestedAction: item.suggestedAction
        }))
      };
      clipboard.writeText(JSON.stringify(report, null, 2));
      const status = root.querySelector('.status');
      if (status) status.textContent = `已复制 ${report.items.length} 条结构化汉化任务，人工和 AI 均可直接读取`;
    };
    setTimeout(() => refreshEnhanced().catch(() => {}), 220);
  }

  function scan() {
    enhanceDialog(document.getElementById('antigravity-translation-audit'));
  }
  const observer = new MutationObserver(scan);
  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(scan, 700);
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
