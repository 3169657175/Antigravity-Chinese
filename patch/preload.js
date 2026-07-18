"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script — runs in every BrowserWindow before the page loads.
 * Exposes a minimal, secure API via contextBridge so the renderer can
 * communicate with the main-process auto-updater without nodeIntegration.
 */
const electron_1 = require("electron");
const updaterAPI = {
    onStateChanged: (callback) => {
        const handler = (_event, state) => {
            callback(state);
        };
        electron_1.ipcRenderer.on('updater:state-changed', handler);
        // Return unsubscribe function
        return () => {
            electron_1.ipcRenderer.removeListener('updater:state-changed', handler);
        };
    },
    applyUpdate: () => electron_1.ipcRenderer.invoke('updater:apply'),
    quitAndInstall: () => electron_1.ipcRenderer.invoke('updater:quit-and-install'),
    checkForUpdates: () => electron_1.ipcRenderer.invoke('updater:check-for-updates'),
    getState: () => electron_1.ipcRenderer.invoke('updater:get-state'),
};
const dialogAPI = {
    showOpenDialog: () => electron_1.ipcRenderer.invoke('dialog:open-workspace'),
};
const notificationAPI = {
    send: (options) => electron_1.ipcRenderer.invoke('notification:send', options),
    openSystemPreferences: () => electron_1.ipcRenderer.invoke('notification:open-system-preferences'),
    onClicked: (callback) => {
        const handler = (_event, payload) => {
            callback(payload);
        };
        electron_1.ipcRenderer.on('notification:clicked', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('notification:clicked', handler);
        };
    },
};
const storageAPI = {
    getItems: () => electron_1.ipcRenderer.invoke('storage:get-items'),
    updateItems: (changes) => electron_1.ipcRenderer.invoke('storage:update-items', changes),
    onChanged: (callback) => {
        const handler = (_event, changes) => {
            callback(changes);
        };
        electron_1.ipcRenderer.on('storage:changed', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('storage:changed', handler);
        };
    },
};
const logsAPI = {
    getElectronLogs: () => electron_1.ipcRenderer.invoke('logs:electron'),
};
const extensionsAPI = {
    sendAuthorities: (authoritiesMap) => electron_1.ipcRenderer.invoke('extensions:send-authorities', authoritiesMap),
};
const deepLinkAPI = {
    onDeepLink: (callback) => {
        const handler = (_event, url) => {
            callback(url);
        };
        electron_1.ipcRenderer.on('deep-link', handler);
        return () => {
            electron_1.ipcRenderer.removeListener('deep-link', handler);
        };
    },
    getStoredDeepLink: () => electron_1.ipcRenderer.invoke('deep-link:get-stored'),
};
const agentAPI = {
    updateActiveAgentCount: (count) => electron_1.ipcRenderer.invoke('agent:update-active-count', count),
};
const electronNativeAPI = {
    getZoomLevel: () => electron_1.webFrame.getZoomFactor(),
    setTitleBarOverlay: (options) => electron_1.ipcRenderer.invoke('window:set-title-bar-overlay', options),
    minimize: () => electron_1.ipcRenderer.invoke('window:minimize'),
    maximize: () => electron_1.ipcRenderer.invoke('window:maximize'),
    unmaximize: () => electron_1.ipcRenderer.invoke('window:unmaximize'),
    isMaximized: () => electron_1.ipcRenderer.invoke('window:is-maximized'),
    close: () => electron_1.ipcRenderer.invoke('window:close'),
    toggleDevTools: () => electron_1.ipcRenderer.invoke('window:toggle-devtools'),
    zoomIn: () => {
        const current = electron_1.webFrame.getZoomLevel();
        electron_1.webFrame.setZoomLevel(current + 0.5);
    },
    zoomOut: () => {
        const current = electron_1.webFrame.getZoomLevel();
        electron_1.webFrame.setZoomLevel(current - 0.5);
    },
    resetZoom: () => {
        electron_1.webFrame.setZoomLevel(0);
    },
    openExternal: (url) => electron_1.ipcRenderer.invoke('shell:open-external', url),
};
const ideAPI = {
    isInstalled: () => electron_1.ipcRenderer.invoke('ide:is-installed'),
};
electron_1.contextBridge.exposeInMainWorld('electronUpdater', updaterAPI);
electron_1.contextBridge.exposeInMainWorld('dialog', dialogAPI);
electron_1.contextBridge.exposeInMainWorld('nativeNotifications', notificationAPI);
electron_1.contextBridge.exposeInMainWorld('nativeStorage', storageAPI);
electron_1.contextBridge.exposeInMainWorld('logs', logsAPI);
electron_1.contextBridge.exposeInMainWorld('extensions', extensionsAPI);
electron_1.contextBridge.exposeInMainWorld('deepLink', deepLinkAPI);
electron_1.contextBridge.exposeInMainWorld('agent', agentAPI);
electron_1.contextBridge.exposeInMainWorld('electronNative', electronNativeAPI);
electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);
electron_1.contextBridge.exposeInMainWorld('mcpLogger', {
    writeLog: (text) => electron_1.ipcRenderer.invoke('mcp:write-log', text),
    getLsInfo: () => electron_1.ipcRenderer.invoke('mcp:get-ls-info')
});

try {
  electron_1.ipcRenderer.invoke('mcp:write-log', '--- Preload Loaded at ' + new Date().toISOString() + ' ---\n');
} catch (e) {
  console.error('Preload boot log failed:', e);
}

// ==========================================
// Antigravity 2.0 Chinese Localization Engine
// ==========================================

(function() {
  const dictionary = {
    "Use Global": "使用全局",
    "Uses global settings when working in this project.": "在此项目中工作时使用全局设置。",
    "All Workspaces": "全部工作区",
    "user_global": "用户全局",
    "Select branch": "选择分支",
    "Edit project name": "编辑项目名称",
    "Copy worktree name": "复制工作树名称",
    "Gemini Models": "Gemini 模型",
    "Select model, current: Gemini 3.5 Flash (Medium)": "选择模型，当前: Gemini 3.5 Flash (Medium)",
    "Analyzing Template Loading Function": "正在分析模板加载函数",
    "Checking Workspace Files": "正在检查工作区文件",
    "Checking Graduation Thesis PDFs": "正在检查毕业论文 PDF 文件",
    "Verifying Report Against Code": "正在对照代码验证报告",
    "Finding Graduation Reports": "正在查找毕业报告",
    "Reviewing Graduation Defense PPT": "正在审查毕业答辩 PPT",
    "Browsing Data Audit Website": "正在浏览数据审计网站",
    "Friendly Greeting And Chat": "友好问候与聊天",
    "Queue After Turn": "回合结束后入队",
    "Send Immediately": "立即发送",
    "Queued Messages": "队列消息",
    "Configure when follow-up messages are sent.": "配置后续消息的发送时机。",
    "Google AI Pro": "Google AI 专业版",
    "Loading token usage...": "正在加载 Token 使用情况...",
    "Loading workspace customizations...": "正在加载工作区自定义设置...",
    "No token data available.": "暂无 Token 使用数据。",
    "You can upgrade to a Google AI Ultra plan to receive higher rate limits.": "您可以升级到 Google AI Ultra 计划以获得更高的速率限制。",
    "Loading MCP servers...": "正在加载 MCP 服务器...",
    "Add MCP": "添加 MCP 服务器",
    "Open MCP Config": "打开 MCP 配置",
    "Delete server": "删除服务器",
    "Marketplace Gallery URL": "插件市场目录 URL",
    "Marketplace Item URL": "插件市场项目 URL",
    "Changes the base URL for marketplace search results. You must restart Antigravity to use the new marketplace after changing this value.": "更改插件市场搜索结果的基准 URL。更改此值后，您必须重启 Antigravity 才能使用新的插件市场。",
    "Changes the base URL on each extension page. You must restart Antigravity to use the new marketplace after changing this value.": "更改每个扩展页面的基准 URL。更改此值后，您必须重启 Antigravity 才能使用新的插件市场。",
    "Editor Settings": "编辑器设置",
    "Open Editor Settings": "打开编辑器设置",
    "Configure editor-specific behaviors and shortcuts.": "配置编辑器特定的行为和快捷键。",
    "To modify editor settings, open Settings within the editor window.": "若要修改编辑器设置，请在编辑器窗口内打开设置。",
    "Show \"Edit\" and \"Chat\" buttons when selecting text in the editor.": "在编辑器中选择文本时，显示“编辑”和“聊天”按钮。",
    "Bot Name": "机器人名称",
    "Avatar URL": "头像 URL",
    "chat space": "聊天空间",
    "or join the": "或加入",
    "For help, visit": "如需帮助，请访问",
    "Configure a chat bot so you can use Jetski directly from Google Chat.": "配置聊天机器人，以便您可以直接从 Google Chat 中使用 Jetski。",
    "Jetski Chat": "Jetski 聊天",
    "CitC Settings": "CitC 开发环境设置",
    "Manage settings specific to Google CitC workspaces development.": "管理特定于 Google CitC 工作区开发的设置。",
    "Manage your notification preferences.": "管理您的通知偏好。",
    "Setup Jetski Chat": "设置 Jetski 聊天",
    "Google Chrome": "Google Chrome 浏览器",
    "Google Drive integration not available": "Google 云端硬盘集成不可用",
    "Configure agent execution, queued message delivery, and permissions.": "配置智能体执行、队列消息投递和权限。",
    "Show all": "显示全部",
    "No Project": "无项目",
    "Try out early-stage features before they ship. These may change or be removed at any time.": "在正式发布前试用早期功能。这些功能可能随时更改或移除。",
    "when working in this project.": "在此项目中工作时。",
    "Also includes": "同时包括",
    "Undo changes up to this point": "撤销更改至此",
    "Cancel (Ctrl+D)": "取消 (Ctrl+D)",
    "Agent response": "智能体回复",
    "User message": "用户消息",
    "Send message": "发送消息",
    "Record voice memo": "录制语音备忘录",
    "Implementation Plan": "实施计划",
    "Skills Used": "已使用技能",
    "Bad response": "差评回复",
    "Good response": "好评回复",
    "Load older messages": "加载历史消息",
    "Auxiliary Pane": "辅助窗格",
    "Typeahead menu": "自动联想菜单",
    "To use the agent, please login": "使用智能体前，请先登录",
    "Success, Continuing...": "成功，正在继续...",
    "Previous": "上一步",
    "Awaiting Authentication...": "等待认证中...",
    "Having trouble? Let us know": "遇到困难？联系我们",
    "There was an unexpected issue setting up your account.": "设置您的账号时发生了意外问题。",
    "Project Settings": "项目设置",
    "New Conversation in Project": "在项目中新建对话",
    "Pin Conversation": "固定对话",
    "Archive Conversation": "归档对话",
    "Baseline model quota reached": "已达到基础模型额度限制",
    "See Plans": "查看计划",
    "Enable Overages": "启用超额使用",
    "Dismiss": "关闭",
    // Tooltips
    "Your quota for this model is running low.": "该模型的配额已不多。",
    "Select Model Ctrl+/": "选择模型 Ctrl+/",
    "Install Antigravity IDE to run and edit your workspace scripts.": "安装 Antigravity IDE 以运行和编辑您的工作区脚本。",
    "Record Audio Ctrl+M": "录音 Ctrl+M",
    "Select Project Ctrl+;": "选择项目 Ctrl+;",
    "Select Model": "选择模型",
    "Record Audio": "录音",
    "Select Project": "选择项目",

    // Appearance & Themes Settings
    "Conversation Width": "对话宽度",
    "Configure the maximum width of the conversation panel.": "配置对话面板的最大宽度。",
    "Narrow": "窄",
    "Wide": "宽",
    "Catppuccin": "Catppuccin",
    "One Light": "One Light",
    "Solarized Light": "Solarized Light",
    "Dracula": "Dracula",
    "Monokai": "Monokai",
    "One Dark Pro": "One Dark Pro",
    "Tokyo Night": "Tokyo Night",
    "Solarized Dark": "Solarized Dark",

    // Top Bar & Menus
    "File": "文件",
    "Edit": "编辑",
    "View": "视图",
    "Selection": "选择",
    "Find": "查找",
    "Help": "帮助",
    "Docs": "文档",
    "Docs & API Reference": "文档与 API 参考",
    "Toggle Developer Tools": "开发者工具",
    "New Window": "新窗口",
    "Quit": "退出",
    "Cancel": "取消",
    "Delete": "删除",
    "and": "和",
    "including": "包含",
    "within it. This action cannot be undone.": "。此操作无法撤销。",
    "?": " 吗？",
    "Confirm Quit": "确认退出",
    "Are you sure you want to quit?": "您确定要退出吗？",
    "There may be agents or background tasks running.": "可能还有智能体或后台任务正在运行。",
    "Welcome to the new Antigravity!": "欢迎使用全新 Antigravity！",
    "Welcome to": "欢迎使用",
    "Welcome to Antigravity": "欢迎使用 Antigravity",
    "Continue with Google": "使用 Google 账号登录",
    "Use Google Cloud project instead": "或使用 Google Cloud 项目凭据",
    "Antigravity has been redesigned to put agents first with new capabilities. If you'd still like a code editor, you can download it as a separate app named": "Antigravity 已经重构为以智能体为核心的全新平台。如果您仍需要代码编辑器，可以将其作为名为以下的独立应用下载：",
    "Antigravity IDE": "Antigravity IDE 编辑器",
    "Download the Antigravity IDE": "下载 Antigravity IDE",
    "Explore the new Antigravity": "探索全新 Antigravity",
    "Setting up…": "正在启动/设置中...",
    "Agent": "智能体",
    "Agents": "智能体",
    "Subagent": "子智能体",
    "Subagents": "子智能体",
    "Task": "任务",
    "Tasks": "任务",
    "Workspace": "工作区",
    "Workspaces": "工作区",
    "Command": "命令",
    "Run": "运行",
    "Settings": "设置",
    "Model": "模型",
    "Stop": "停止",
    "Approve": "批准",
    "Reject": "拒绝",
    "Terminal": "终端",
    "Output": "输出",
    "Codebase": "代码库",
    "Error": "错误",
    "Success": "成功",
    "Pending": "等待中",
    "Running": "运行中",
    "Completed": "已完成",
    "Failed": "已失败",
    "Branch": "分支",
    "Merge": "合并",
    "Conflict": "冲突",
    "Generate Image": "生成图像",
    "Web Search": "网页搜索",
    "Grep Search": "全局搜索",
    "Active Agents": "活跃智能体",
    "No agents running": "没有运行中的智能体",
    "active workspace": "活动工作区",
    "Active Workspace": "活动工作区",
    "Search": "搜索",
    "Search...": "搜索...",
    "Type a command...": "输入命令...",
    "Settings & Preferences": "设置与偏好",
    "General": "通用",
    "Themes": "主题",
    "Language": "语言",
    "Model Selection": "模型选择",
    "Advanced": "高级",
    "Developer": "开发者",
    "Save": "保存",
    "Close": "关闭",
    "Status": "状态",
    "Progress": "进度",
    "Logs": "日志",
    "Console": "控制台",
    "Running task...": "任务运行中...",
    "Task completed successfully": "任务成功完成",
    "An error occurred": "发生错误",
    "Connecting to Language Server...": "正在连接语言服务器...",
    "Language Server": "语言服务器",
    "Connected": "已连接",
    "Disconnected": "已断开",
    "Select a folder": "选择文件夹",
    "Open Folder": "打开文件夹",
    "Create New Project": "创建新项目",
    "New Project": "新建项目",
    "Quick Start": "快速开始",
    "Create a new project. You can add folders to it now or later.": "创建一个新项目，现在或稍后都可以添加文件夹。",
    "Instantly create a new project and folder to start building.": "立即创建一个新项目和文件夹以开始构建。",
    "Select Folder(s)": "选择文件夹",
    "+ Add Folder": "+ 添加文件夹",
    "Add Folder": "添加文件夹",
    "Skip": "跳过",
    "Antigravity": "Antigravity",
    "Antigravity 2.0": "Antigravity 2.0",
    "Google DeepMind": "谷歌 DeepMind",
    "Advanced Agentic Coding": "高级智能体编码",
    "Welcome to Antigravity": "欢迎使用 Antigravity",
    "Get Started": "开始使用",
    "Create an agent to get started": "创建一个智能体以开始",
    "New Agent": "新建智能体",
    "Agent Name": "智能体名称",
    "System Prompt": "系统提示词",
    "Description": "描述",
    "Capabilities": "能力",
    "Write Files": "写入文件",
    "Run Commands": "运行命令",
    "Web Browsing": "网页浏览",
    "Define Subagents": "定义子智能体",
    "Call MCP Tools": "调用 MCP 工具",
    "Inherit Workspace": "继承工作区",
    "Branch Workspace": "分支隔离工作区",
    "Share Workspace": "共享工作区",
    "timer": "定时器",
    "Timers": "定时器",
    "Cron Jobs": "计划任务",
    "Schedule": "调度",
    "Directory analysis": "目录分析",
    "Web search": "网页搜索",
    "File edit": "文件编辑",
    "Command execution": "命令执行",
    "Semantic search": "语义搜索",

    // Added sentences & refined for user experience
    "Permissions": "权限",
    "Configure global allowed and denied resource permissions. Learn more.": "配置全局允许与拒绝的资源访问权限。了解更多。",
    "Configure global allowed and denied resource permissions.": "配置全局允许与拒绝的资源访问权限。",
    "Learn more.": "了解更多。",
    "Learn more": "了解更多",
    "Project-Specific Settings": "项目专属设置",
    "Project-Specific": "项目专属",
    "Modify scoped permissions, folders, and Agent settings like Sandbox and Terminal command execution.": "修改项目专属访问权限、工作文件夹以及智能体设置（例如沙盒和终端命令执行）。",
    "Modify scoped permissions, folders, and Agent settings": "修改项目专属访问权限、工作文件夹以及智能体设置",
    "like Sandbox and Terminal command execution.": "例如沙盒与终端命令执行。",
    "Go to Projects": "转到项目",
    "File Permissions": "文件权限",
    "File Access Rules": "文件访问规则",
    "Configure allowed and denied paths for file reads and writes.": "配置文件读写的允许与拒绝路径。",
    "Network Permissions": "网络权限",
    "Network Access Rules": "网络访问规则",
    "Configure allowed and denied URLs for reading.": "配置允许或禁止读取的 URL。",
    "Terminal & Tooling Permissions": "终端和工具权限",
    "Terminal Commands": "终端命令",
    "Configure allowed terminal commands.": "配置允许执行的终端命令。",
    "Commands Outside Sandbox": "沙盒外命令",
    "Configure allowed commands outside the sandbox.": "配置允许在沙盒外执行的终端命令。",
    "MCP Tools": "MCP 工具",
    "Configure external tools via Model Context Protocol.": "通过模型上下文协议 (MCP) 配置外部工具。",
    "Global": "全局",
    "Sandbox": "沙盒",
    "Sandbox enabled": "沙盒已启用",
    "Sandbox disabled": "沙盒已禁用",
    "Allowed": "已允许",
    "Denied": "已拒绝",
    "Paths": "路径",
    "URLs": "URL",
    "Tools": "工具",

    // Appearance & Settings
    "Appearance": "外观",
    "Configure the Agent's visual theme and display preferences.": "配置智能体的视觉主题与显示偏好。",
    "Chat Settings": "聊天设置",
    "Verbose Agent Chat": "显示智能体详细输出",
    "Display and preserve intermediate thinking steps": "显示并保留智能体中间思考过程",
    "Choose light, dark, or inherit system settings.": "选择浅色、深色，或继承系统设置。",
    "Dark": "深色",
    "Light": "浅色",
    "Light Theme": "浅色主题",
    "Preset": "预设",
    "Default Light": "默认浅色",
    "Background": "背景色",
    "Foreground": "前景色",
    "Accent": "强调色",
    "Dark Theme": "深色主题",
    "Default Dark": "默认深色",
    
    // Customizations
    "Customizations": "自定义",
    "Skills & Customizations": "技能与定制",
    "Configure default behaviors, skills, and MCP servers.": "配置默认行为、技能以及 MCP 服务器。",
    "Token Usage": "Token 使用详情",
    "The breakdown below shows token usage from customizations like skills, rules, and MCP. If the budget is exceeded, large customizations will be truncated automatically.": "以下详情展示了来自技能、规则和 MCP 等自定义项 of the Token 使用情况。如果额度超限，大型自定义内容将被自动截断。",
    "of the customization budget is available.": "的自定义额度可用。",
    "100.0% of the customization budget is available.": "100.0% 的自定义额度可用。",
    "No customizations found for this workspace.": "未找到此工作区的自定义项。",
    "Installed MCP Servers": "已安装的 MCP 服务器",
    "No MCP Servers": "无已安装的 MCP 服务器",
    "You currently don't have any MCP Servers installed.": "您当前未安装任何 MCP 服务器。",
    "Add an MCP server above": "在上方添加一个 MCP 服务器",
    "Search MCP servers...": "搜索 MCP 服务器...",
    "Available MCP Servers": "可用的 MCP 服务器",
    "Enable": "启用",
    "Disable": "禁用",
    "Build With Google Plugins": "使用 Google 插件构建",
    "Build with Antigravity Plugins": "基于 Antigravity 插件构建",
    "Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products. You can always change your choices in Settings.": "插件是包含技能和 MCP 服务封装的资源包，旨在协助 Antigravity 智能体调用 Google 开发者产品。您随时可以在设置中更改选择。",
    "Android": "Android 移动开发",
    "Core tools and knowledge required to develop for Android": "适用于开发 Android 应用程序的核心工具与支持知识库",
    "Modern Web Guidance": "现代 Web 开发指南",
    "Keep your coding agent up to date with the latest web best practices.": "让您的编程智能体掌握现代 Web 开发的最佳实践和设计规范。",
    "Google Antigravity SDK": "Google Antigravity 开发套件",
    "Using the Antigravity Python SDK to build AI agents": "使用 Antigravity Python SDK 快速构建和扩展自定义 AI 智能体",
    "Science": "科学研究与学术",
    "Curated collection of agent skills for science.": "精选的适用于科学计算、学术分析的智能体工具与技能库。",
    "Firebase": "Firebase 开发者套件",
    "Prototype, build & run modern apps users love with Firebase's backend, AI, and operational infrastructure.": "利用 Firebase 的后端服务、AI 与基础运行设施，快速构建并运营用户喜爱的现代化应用。",
    "Chrome DevTools": "Chrome DevTools 工具箱",
    "Reliable automation, in-depth debugging, and performance analysis in Chrome using Chrome DevTools": "在 Chrome 浏览器中利用 DevTools 调试协议实现高可靠性自动化、深度调试及性能剖析",
    
    // Account
    "Account": "账号",
    "Manage your plan, credentials, and general preferences.": "管理您的计划、凭据和常规偏好。",
    "Enable Telemetry": "启用遥测",
    "When toggled on, Antigravity collects usage data to help Google enhance performance and features.": "开启后，Antigravity 会收集匿名使用数据，以帮助 Google 持续改进性能和功能。",
    "Marketing Emails": "营销电子邮件",
    "Receive product updates, tips, and promotions from Google Antigravity via email.": "通过电子邮件接收来自 Google Antigravity 的产品更新、技巧与促销信息。",
    "Your Plan:": "您的计划：",
    "Your Plan: Google AI Pro": "您的计划：Google AI Pro",
    "You can upgrade to a Google AI Ultra plan to receive the highest rate limits.": "您可以升级到 Google AI Ultra 计划以获得更高额的使用速率限制。",
    "Email": "电子邮件",
    
    // Browser & App Settings
    "Browser Settings": "浏览器设置",
    "Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.": "配置浏览器子智能体。这需要安装 Google Chrome。可以在对话输入框中输入 /browser 来调用浏览器子智能体。",
    "Configure the browser agent. Running this feature requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.": "配置浏览器智能体。运行此功能需要安装 Google Chrome 浏览器。可以通过在对话输入框中输入 /browser 来调用浏览器智能体。",
    "Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing": "配置浏览器子智能体。这需要安装 Google Chrome。可以通过输入",
    "in the conversation input box.": "在对话输入框中调用该子智能体。",
    "Browser Javascript Execution Policy": "浏览器 JavaScript 执行策略",
    "Controls whether the agent can run custom JavaScript to automate complex browser actions.": "控制智能体是否可以运行自定义 JavaScript 以自动化复杂的浏览器操作。",
    "Request Review": "需要人工审核",
    "Disabled": "已禁用",
    "Block all browser JavaScript execution.": "禁止执行所有浏览器 JavaScript。",
    "Prompt for approval before running browser scripts.": "在运行浏览器脚本前需人工批准。",
    "Allow full browser script execution without prompting.": "允许执行所有浏览器脚本（无需提示）。",
    "Actuation Permissions": "动作执行权限",
    "Browser Actuation Permissions": "浏览器动作执行权限",
    "Execute URLs": "动作执行 URL 规则",
    "Allow/deny agent browser actuation access to specific URLs.": "允许或阻止智能体在浏览器中操作访问特定的 URL 地址列表。",
    "Browser Actuation Rules": "浏览器操作控制规则",
    "Configure allowed and denied URLs for browser actuation.": "配置允许或禁止浏览器执行动作的 URL 列表。",
    "App Settings": "应用设置",
    "Automatic Check for Updates": "自动检查更新",
    "When enabled, you will be automatically prompted to restart the app when there is a new update available. When disabled, you can check for updates manually from the app menu.": "开启后，当有新版本可用时，系统会自动提示您重启应用以应用更新。关闭后，您可以通过应用菜单手动检查更新。",
    "Prevent Sleep": "防止计算机休眠",
    "Prevent the computer from sleeping while the app is running.": "在应用运行时防止计算机进入休眠状态。",
    "Keep In Menu Bar": "常驻系统托盘",
    "The app will be accessible from the menu bar and will keep running in the background when all windows are closed.": "关闭所有窗口后，应用将常驻菜单栏并在后台保持运行。",
    "Notifications": "通知",
    "Notification Settings": "通知设置",
    "To modify notification settings, open your operating system's system preferences.": "如需修改通知设置，请打开您操作系统的系统偏好设置。",

    // Agent Settings
    "Agent Settings": "智能体设置",
    "Security Preset": "安全预设",
    "Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.": "为智能体选择预定义的安全预设。这将控制终端自动执行策略和文件访问策略。",
    "Choose a predefined security preset for the agent.": "为智能体选择预定义的安全预设。",
    "This controls terminal auto-execution policy, and file access policy.": "这将控制终端自动执行策略和文件访问策略。",
    "Learn more about Default": "了解关于默认预设的更多信息",
    "Default": "默认",
    "Agent Behavior": "智能体行为",
    "Artifact Review Policy": "工件审核策略",
    "Specifies agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.": "设置智能体在请求审核工件时的行为方式。工件是其为提供更丰富对话体验而创建的文档。",
    "Always Ask": "始终询问",
    "Local Permissions": "项目专属权限",
    "Inherits from global settings. Local permissions have higher priority.": "继承自全局设置。项目专属权限具有更高的优先级。",
    "Inherits from global settings.": "继承自全局设置。",
    "Local permissions have higher priority.": "项目专属权限具有更高的优先级。",
    "Danger Zone": "危险区域",
    "Delete Project": "删除项目",
    "Permanently delete this project and all of its conversations.": "永久删除当前项目及其包含的所有历史对话。",
    
    // Additional Agent Settings & Context Menu
    "Custom": "自定义",
    "Outside of folders file access policy": "文件夹外文件访问策略",
    "Configures how the agent tries to access files outside of its working folders.": "配置智能体如何尝试访问其工作文件夹外部的文件。",
    "Terminal command Auto execution": "终端命令自动执行",
    "Controls whether terminal commands require your approval before running.": "控制终端命令在运行前是否需要您批准。",
    "Require Review": "需要审核",
    "Add Context": "添加上下文",
    "Media": "媒体",
    "Mentions": "提及",
    "Actions": "操作",
    "Browser": "浏览器",
    "Worktree": "工作树",
    "Projects": "项目",
    "Review Changes": "审核更改",
    "Ask anything, @ to mention, / for actions": "输入任何问题，输入 @ 提及，/ 触发操作",
    "Ask anything, @to mention, /for actions": "输入任何问题，输入 @ 提及，/ 触发操作",
    "Ask anything, @ to mention, / for commands": "输入任何问题，输入 @ 提及，/ 触发命令",
    "Ask anything, @to mention, /for commands": "输入任何问题，输入 @ 提及，/ 触发命令",
    "Overview": "概览",
    "Artifacts": "工件",
    "Conversations": "对话",
    "Agent settings and permissions for conversations outside of projects.": "项目外部对话的智能体设置和权限配置。",
    "Not in Project": "不在项目中",
    "Manage project folders, agent settings, and permissions.": "管理项目文件夹、智能体设置和专属权限。",

    // Security Presets
    "Requires manual review for all terminal commands and file accesses outside of the working folders.": "运行终端命令以及访问工作区外的文件时，均需手动人工审核。",
    "Full Machine": "完整本机访问",
    "All terminal commands require review. The agent can read or write to any file in the machine.": "所有终端命令均需审核，智能体可读写本机上的任意文件。",
    "Unrestricted": "无限制模式",
    "Disables all safety barriers for maximal iteration velocity.": "禁用所有安全屏障以获得极致的迭代效率。",
    "Manually customize individual settings.": "手动自定义各项具体设置。",
    "Always Proceed": "自动继续",

    // Themes
    "One Light": "One Light",
    "Solarized Light": "Solarized Light",
    "One Dark Pro": "One Dark Pro",
    
    // Models
    "Configure AI models and view your quota.": "配置 AI 模型并查看您的配额与可用点数。",
    "Refresh": "刷新",
    "Model Credits": "模型额度",
    "Enable AI Credit Overages": "允许 AI 额度超限使用",
    "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.": "开启后，当您的免费配额耗尽时，Antigravity 将使用您的 AI 点数来满足请求。系统会优先扣除免费模型配额，配额不足时再使用点数。",
    "Model Quota": "模型配额",
    "View your available model quota and AI credits. Model quota refreshes periodically based on your plan. Enable AI Credit Overages to continue using models when your quota is exhausted.": "查看您的可用模型配额与 AI 账户额度。模型配额会根据您的订阅计划定期刷新。额度耗尽后，可开启 AI 额度超限使用以继续体验。",

    // Shortcuts & UI
    "Shortcuts": "快捷键",
    "Keyboard shortcuts for quick navigation and control.": "用于快速导航与控制的键盘快捷键。",
    "Recommended": "推荐",
    "Open Conversation Picker": "打开对话选择器",
    "Open File Search": "打开文件搜索",
    "Focus Input": "聚焦输入框",
    "New Conversation": "新建对话",
    "Navigation": "导航",
    "Go Back": "后退",
    "Go Forward": "前进",
    "File Picker": "文件选择器",
    "Scheduled Tasks": "计划任务",
    "Select Previous Conversation": "选择上一个对话",
    "Select Next Conversation": "选择下一个对话",
    "Open Settings": "打开设置",
    "Conversation": "对话",
    "Conversation History": "历史对话",
    "Conversation history": "历史对话",
    "Toggle Model Selector": "切换模型选择器",
    "Toggle Voice Recording": "切换录音",
    "Find in Pane": "在窗格中查找",
    "Layout Controls": "布局控制",
    "Toggle Sidebar": "切换侧边栏",
    "Toggle Auxiliary Pane": "切换辅助窗格",
    "Zoom In": "放大",
    "Zoom Out": "缩小",
    "Reset Zoom": "重置缩放",

    // Feedback
    "Provide Feedback": "提供反馈",
    "Feedback Type": "反馈类型",
    "Bug Report": "Bug 报告",
    "Feature Request": "功能请求",
    "Auth and Billing": "账号与计费",
    "General Feedback": "常规反馈",
    "Please describe the feature you'd like to see. The more detailed the requirements, the easier it will be for our team to incorporate your ideas. Some helpful information includes:": "请描述您希望获得的新功能。需求描述越详尽，我们的团队就越容易采纳您的想法。以下是一些建议提供的信息：",
    "What is missing in your workflow": "您的工作流中缺少了什么",
    "What you would like to see to address this gap in your workflow": "您希望通过什么功能来解决这一需求",
    "How this feature would help you and other users": "此功能如何帮助您和其他用户",
    "Describe the feature you would like to see...": "请描述您希望获得的新功能...",
    "Attach a screenshot (optional)": "添加屏幕截图（可选）",
    "Attach Antigravity server logs": "附带 Antigravity 服务器日志",
    "Send feedback as": "发送反馈身份",
    "We recommend attaching logs. Attaching logs will help the Antigravity team act on and prioritize your feedback.": "我们建议附带日志。这将有助于 Antigravity 团队更快速、更有针对性地处理您的问题。",

    // Automatic Update Menus
    "Checking for Updates...": "正在检查更新...",
    "Downloading Update...": "正在下载更新...",
    "Restart to Update": "重启以应用更新",
    "Check for Updates": "检查更新",
    "No updates available": "当前已是最新版本",
    "Update available": "发现新版本",
    "Downloading...": "正在下载...",
    "Update downloaded": "更新已下载完成",
    "Error checking for updates": "检查更新失败",

    // Native sidebar items and UI
    "Global Settings": "全局设置",
    "Project-Level Settings": "项目级设置",
    "Model Selection": "模型选择",
    "Tool Execution Policy": "工具执行策略",
    "Terminal Sandbox": "终端沙箱",
    "Non-Workspace File Access": "非工作区文件访问",
    "Internet Access Policy": "网络访问策略",
    "Permission Grants": "授权许可",
    "Command Allowlist / Denylist": "命令白名单/黑名单",
    "Browser Allowlist": "浏览器白名单",
    "Artifact Review Mode": "制品评审模式",
    "Notifications": "系统通知",
    "App Settings": "应用设置",
    "File Access Policy": "文件访问策略",
    "Sandbox Mode": "沙箱模式",
    "Auto-Execution Policy": "自动执行策略",
    "always-proceed": "总是允许 (不提示)",
    "request-review": "请求审查 (每次提示)",
    "strict": "严格限制 (禁止执行)",
    "proceed-in-sandbox": "在沙箱中执行",
    "allow": "允许",
    "ask": "询问",
    "deny": "拒绝",
    "Allow once": "仅允许一次",
    "Always allow": "始终允许",
    "Allow": "允许",
    "Deny": "拒绝",
    "Dismiss": "关闭",
    "Run once": "仅执行一次",
    "Always run": "始终执行",
    "Don't run": "不执行",
    "Allow editing": "允许编辑",
    "Always allow editing": "始终允许编辑",
    "Deny editing": "拒绝编辑",
    "Allow command": "允许命令",
    "Always allow command": "始终允许命令",
    "Deny command": "拒绝命令",
    "THEME_MODE_LIGHT": "浅色模式",
    "THEME_MODE_DARK": "深色模式",
    "THEME_MODE_INHERIT": "跟随系统",
    "Theme Mode": "主题模式",
    "Keep computer awake": "防止电脑休眠",
    "Run in background": "后台运行",
    "Auto-check for updates": "自动检查更新",
    "Ask Antigravity...": "向 Antigravity 提问...",
    "Type a message...": "输入消息...",
    "Ask anything, @ to mention, / for actions": "输入问题，输入 @ 提及，/ 执行动作",
    "Approved": "已批准",
    "Proceed": "继续",
    "Wait": "等待",
    "Done": "完成",
    "Show logs": "显示日志",
    "Clear": "清空",
    "Reset": "重置",
    "Apply": "应用",
    "Create": "创建",
    "Add": "添加",
    "Remove": "移除",
    "View": "查看",
    "Folders": "文件夹",
    "Subagents": "子智能体",
    "Background Tasks": "后台任务",
    "Files Changed": "文件变更",
    "Terminals": "终端列表",
    "Create New Task": "创建新任务",
    "Cron Expression": "Cron 表达式",
    "Duration (Seconds)": "时长 (秒)",
    "Task Prompt": "任务提示词",
    "Active Tasks": "活动中的任务",
    "Task History": "任务历史",
    "No active tasks": "没有运行中的任务",
    "No scheduled tasks": "没有计划中的任务",
    "Delete Task": "删除任务",
    "Skills": "技能 (Skills)",
    "Rules": "规则 (Rules)",
    "Plugins": "插件 (Plugins)",
    "MCP Servers": "MCP 服务端",
    "Add MCP Server": "添加 MCP 服务端",
    "Name": "名称",
    "Type": "类型",
    "Arguments": "参数",
    "Environment Variables": "环境变量",
    "Active": "活跃",
    "Inactive": "未活跃",
    "Select Workspace": "选择工作区",
    "Please visit the following URL to authorize.": "请访问以下网址进行授权。",
    "After authorizing, paste the authorization code below.": "授权后，在下方粘贴授权码。",
    "Install IDE": "安装 IDE",
    "Recent Conversations": "最近的对话",
    "Clear Chat History": "清空聊天记录",
    "Show Less": "收起",
    "Show More": "展开",
    "Copied!": "已复制！",
    "Selected": "已选择",
    "Select...": "选择...",
    "Submit": "发送",
    "Back": "返回",
    "Next": "下一步",
    "Finish": "完成",
    "Loading...": "加载中...",
    "No items found": "未找到项",
    // Model quota page translations
    "Weekly Limit": "每周额度限额",
    "Five Hour Limit": "五小时额度限额",
    "Claude and GPT models": "Claude 与 GPT 模型",
    "Within each group, models share a weekly limit and a 5-hour limit. Quota is consumed proportionally to the cost of the tokens. Thus, limits will last longer with shorter tasks or using more cost-effective models. The 5-hour limit smooths out aggregate demand to fairly distribute global capacity across all users, while your weekly limit is tied directly to your individual tier.": "在每个组内，模型共享每周限额和 5 小时限额。额度消耗比例取决于 Token 的成本。因此，对于较短的任务或使用更具性价比的模型，额度持续时间更长。5 小时限额可平滑总体需求，以公平地在所有用户之间分配全局容量，而您的每周限额则直接与您的个人级别挂钩。",
    // Display options popover menu translations
    "Display Options": "显示选项",
    "Group By": "分组方式",
    "Project": "项目",
    "Environment": "环境",
    "Sort Conversations": "对话排序",
    "Last Updated": "最近更新",
    "Alphabetical (A-Z)": "字母顺序 (A-Z)",
    "Date Added": "添加日期",
    "Subtitles": "副标题",
    "No Subtitle": "不显示副标题",
    "Scheduled": "已计划",
    "None": "无",
    "Sort": "排序",
    
    // Comprehensive Community MCP Server Catalog Translations
    "Interact with your BigQuery data using natural language. This MCP server allows you to securely connect to your datasets to search the datasets, inspect table metadata, execute SQL queries, generate time-series forecasts, and perform contribution analysis directly from your AI tools.": "使用自然语言与您的 BigQuery 数据进行交互。该 MCP 服务端允许您安全地连接到数据集以搜索数据集、检查数据表元数据、执行 SQL 查询、生成时间序列预测并直接从您的 AI 工具中进行贡献分析。",
    "The AlloyDB for PostgreSQL remote MCP server lets you access and run AlloyDB tools to manage AlloyDB clusters and instances, manage users, create and restore backups, administer users, import and export data, and run SQL queries from your AI-enabled development environments and AI agent platforms.": "AlloyDB for PostgreSQL 远程 MCP 服务端，允许您访问和运行 AlloyDB 工具，以便从您的 AI 辅助开发环境和 AI 智能体平台中管理 AlloyDB 集群和实例、管理用户、创建和恢复备份、管理用户、导入和导出数据并运行 SQL 查询。",
    "The Bigtable Admin remote MCP server lets you manage Bigtable resources.": "Bigtable Admin 远程 MCP 服务端，允许您管理 Bigtable 资源。",
    "The Cloud SQL remote MCP server lets you access and run Cloud SQL tools to manage Cloud SQL instances, manage users, create and restore backups, administer users, import and export data, and run SQL queries from your AI-enabled development environments and AI agent platforms.": "Cloud SQL 远程 MCP 服务端，允许您访问和运行 Cloud SQL 工具，以便从您的 AI 辅助开发环境和 AI 智能体平台中管理 Cloud SQL 实例、管理用户、创建和恢复备份、管理用户、导入和导出数据并运行 SQL 查询。",
    "The Spanner remote MCP server lets you access and run Spanner tools to create, manage, and query Spanner resources from your AI-enabled development environments and AI agent platforms.": "Spanner 远程 MCP 服务端，允许您访问 and 运行 Spanner 工具，以便从您的 AI 辅助开发环境和 AI 智能体平台中创建、管理和查询 Spanner 资源。",
    "Connect your AI assistants to Looker business intelligence. This MCP server enables data exploration and content management by allowing you to execute natural language queries, run saved Looks, create and manage dashboards, and perform instance health checks within your Looker environment.": "将您的 AI 助手连接到 Looker 商业智能。该 MCP 服务端通过允许您在 Looker 环境中执行自然语言查询、运行已存的 Looks、创建和管理仪表板以及执行实例健康检查，来实现数据探索与内容管理。",
    "Connect your AI assistants to the Knowledge Catalog (formerly known as Dataplex). This MCP server enables data discovery and governance by allowing you to search for data assets, retrieve detailed metadata such as schemas and ownership, and explore aspect types across your distributed data.": "将您的 AI 助手连接到知识目录 (Knowledge Catalog，前身为 Dataplex)。该 MCP 服务端通过允许您搜索数据资产、检索详细元数据（如 Schema 和所有权）以及探索分布式数据中的切面类型，来启用数据发现与数据治理。",
    "Interact with your Oracle Database data using natural language. This MCP server allows you to securely connect to your databases for executing SQL queries, inspecting table schemas, and troubleshooting database performance issues directly from your AI tools.": "使用自然语言与您的 Oracle 数据库数据进行交互。该 MCP 服务端允许您安全地连接到数据库，以便直接从您的 AI 工具中执行 SQL 查询、检查数据表 Schema 并排查数据库性能问题。",
    "The Dev Mode MCP Server brings Figma directly into your workflow by providing important design information and context to AI agents generating code from Figma design files.": "Dev Mode MCP 服务端通过向根据 Figma 设计文件生成代码的 AI 智能体提供关键的设计信息和上下文，将 Figma 直接引入您的工作流。",
    "The GitHub MCP Server is a Model Context Protocol (MCP) server that provides seamless integration with GitHub APIs, enabling advanced automation and interaction capabilities for developers and tools.": "GitHub MCP 服务端是一个模型上下文协议 (MCP) 服务端，提供与 GitHub API 的无缝集成，为开发人员和工具启用高级自动化与交互能力。",
    "Neon MCP Server is an open-source tool that lets you interact with your Neon Postgres databases in natural language.": "Neon MCP 服务端是一个开源工具，允许您使用自然语言与您的 Neon Postgres 数据库进行交互。",
    "The Stripe Model Context Protocol server allows you to integrate with Stripe APIs through function calling. This protocol supports various tools to interact with different Stripe services.": "Stripe 模型上下文协议 (MCP) 服务端允许您通过函数调用与 Stripe API 集成。该协议支持多种工具来与不同的 Stripe 服务进行交互。",
    "Interact with Redis key-value stores": "与 Redis 键值存储进行交互",
    "A Model Context Protocol server for interacting with MongoDB Atlas.": "用于与 MongoDB Atlas 进行交互的模型上下文协议 (MCP) 服务端。",
    "Official Notion MCP Server that allows interaction with Notion workspaces, pages, databases, and comments via the Notion API.": "官方 Notion MCP 服务端，允许通过 Notion API 与 Notion 工作区、页面、数据库和评论进行交互。",
    "Official Linear.app MCP Server for interacting with Linear projects, issues, and workflows.": "官方 Linear.app MCP 服务端，用于与 Linear 项目、事务 (Issues) 和工作流进行交互。",
    "An MCP server implementation that integrates the Perplexity Sonar API to provide real-time, web-wide research capabilities.": "集成了 Perplexity Sonar API 的 MCP 服务端实现，提供实时的全网搜索与调研能力。",
    "Official PayPal MCP Server that allows integration with PayPal APIs for payment processing, transaction management, and account operations.": "官方 PayPal MCP 服务端，允许与 PayPal API 集成，用于付款处理、交易管理和账户操作。",
    "The Heroku Platform MCP Server enables seamless interaction with Heroku Platform resources, allowing LLMs to read, manage, and operate applications, add-ons, databases, and more.": "Heroku 平台 MCP 服务端，提供与 Heroku 平台资源的无缝交互，允许大语言模型 (LLM) 读取、管理和运行应用程序、插件、数据库等。",
    "The Pinecone MCP Server enables AI tools to search Pinecone documentation, configure indexes, generate code informed by your index configuration, and upsert/search data in your Pinecone indexes.": "Pinecone MCP 服务端，允许 AI 工具搜索 Pinecone 文档、配置索引、根据您的索引配置生成相关代码，以及在 Pinecone 索引中更新 (Upsert)/搜索数据。",
    "Connect your Supabase projects to AI assistants. This MCP server allows managing tables, fetching config, executing SQL queries, managing edge functions, and working with database schema in your Supabase projects.": "将您的 Supabase 项目连接到 AI 助手。该 MCP 服务端允许在您的 Supabase 项目中管理表、获取配置、执行 SQL 查询、管理 Edge 函数以及处理数据库 Schema。",
    "The Prisma MCP Server enables AI tools to interact with Prisma for creating and managing Postgres databases easily.": "Prisma MCP 服务端，允许 AI 工具与 Prisma 进行交互，以轻松创建和管理 Postgres 数据库。",
    "The Locofy MCP Server enables Locofy.ai code to be integrated and extended with your IDE.": "Locofy MCP 服务端，允许 Locofy.ai 代码与您的 IDE 进行集成和扩展。",
    "Airweave lets agents search any app.": "Airweave 允许智能体搜索任何应用程序。",
    "Atlassian MCP Server for interacting with Atlassian products.": "Atlassian MCP 服务端，用于与 Atlassian 产品进行交互。",
    "Interact with your Harness account using natural language. This MCP server lets AI agents inspect and manage CI/CD pipelines, executions, services, environments, connectors, feature flags, cloud costs, security findings, chaos experiments, and other Harness platform resources.": "使用自然语言与您的 Harness 账户进行交互。该 MCP 服务端允许 AI 智能体检查和管理 CI/CD 流水线、执行、服务、环境、连接器、特性标志、云成本、安全发现、混沌实验以及其他 Harness 平台资源。",
    "SonarQube MCP Server enables AI assistants to interact with SonarQube instances for code quality analysis, project management, and quality gate operations.": "SonarQube MCP 服务端，允许 AI 助手与 SonarQube 实例进行交互，进行代码质量分析、项目管理和质量阀门 (Quality Gate) 操作。",
    "Netlify MCP Server enables AI assistants to interact with Netlify's platform for managing sites, deployments, domains, and other web development workflows.": "Netlify MCP 服务端，允许 AI 助手与 Netlify 平台进行交互，管理站点、部署、域名及其他 Web 开发工作流。",
    "A Model Context Protocol server that provides structured thinking and reasoning capabilities for LLM conversations.": "为大语言模型 (LLM) 对话提供结构化思考与推理能力的模型上下文协议 (MCP) 服务端。",
    "Sonatype MCP server for interacting with our dependency management and security intelligence platform.": "Sonatype MCP 服务端，用于与我们的依赖项管理和安全情报平台进行交互。",
    "The Google Maps Platform Code Assist MCP server provides your favorite AI coding assistant with up-to-date, official Google Maps Platform documentation, code samples, and best practices. By grounding your AI assistant in our official resources, it can generate more accurate, reliable, and useful code.": "Google Maps Platform Code Assist MCP 服务端，为您喜爱的 AI 编码助手提供最新、官方的 Google 地图平台文档、代码示例和最佳实践。通过让 AI 助手基于官方资源开展工作，它能生成更精确、可靠和实用的代码。",
    "This MCP server provides your LLM with docs and examples to instrument your AI apps with Arize AX. It also provides access to Arize support. Connect it to your IDE or LLM and get curated tracing examples, best practices and Arize support!": "此 MCP 服务端为您的 LLM 提供文档和示例，以便使用 Arize AX 插桩您的 AI 应用。它还提供了获取 Arize 支持的通道。将其连接到您的 IDE 或 LLM，获取精选的追踪示例、最佳实践和 Arize 技术支持！",
    "The Postman MCP Server connects Postman to AI tools, giving AI agents and assistants the ability to access workspaces, manage collections and environments, evaluate APIs, and automate workflows through natural language interactions.": "Postman MCP 服务端将 Postman 连接到 AI 工具，为 AI 智能体和助手提供访问工作区、管理集合 (Collections) 和环境、评估 API 以及通过自然语言交互实现工作流自动化的能力。",
    "The Stitch MCP server enables AI assistants to interact with Stitch for vibe design: generating UI designs from text and images, and accessing project and screen details. See https://stitch.withgoogle.com/docs for more details.": "Stitch MCP 服务端，允许 AI 助手与 Stitch 交互以进行视觉设计：根据文本和图像生成 UI 设计，以及访问项目与屏幕详情。详见 https://stitch.withgoogle.com/docs。",
    "The Google Developer Knowledge MCP server gives AI-powered development tools the ability to search Google's official developer documentation and retrieve information for Google's products such as Firebase, Google Cloud, Android, Maps, and more. By connecting your AI application straight to our official library of documentation, it ensures the code and guidance you receive are up-to-date and based on authoritative context.": "Google Developer Knowledge MCP 服务端，为 AI 辅助开发工具提供搜索 Google 官方开发者文档并检索 Google 产品（如 Firebase、Google Cloud、Android、Maps 等）信息的能力。通过将您的 AI 应用直接连接到我们的官方文档库，确保您收到的代码和指导是最新且权威的。",
    "The ClickHouse MCP server enables agents to securely interact with ClickHouse databases. It provides a universal interface to execute SQL, explore data, and view backup & billing details, allowing agentic tooling to leverage ClickHouse's high-performance analytical capabilities.": "ClickHouse MCP 服务端，允许智能体安全地与 ClickHouse 数据库进行交互。它提供了一个通用的接口来执行 SQL、探索数据以及查看备份与计费信息，使智能体工具能够充分利用 ClickHouse 高性能的分析能力。",
    "Perform a range of infrastructure management tasks, including: manage virtual machine (VM) instances, manage instance group managers and instance templates, manage disks and snapshots, retrieve information about reservations and commitments.": "执行一系列基础设施管理任务，包括：管理虚拟机 (VM) 实例、管理实例组管理器和实例模板、管理磁盘与快照、检索有关预留和承诺的信息。",
    "Access enterprise mobility data using natural language queries about device fleets, automated auditing of policy compliance, and the integration of device management data into broader automated workflows.": "使用自然语言查询关于设备群、自动审核政策合规性，并将设备管理数据集成到更广泛的自动化工作流中，以访问企业移动数据。",
    "Search your Google Cloud projects using natural language.": "使用自然语言搜索您的 Google Cloud 项目。",
    "Perform searches on ingested data in Google-owned data stores.": "对 Google 拥有的数据存储中摄取的数据执行搜索。",
    "Interact with documents stored in a Firestore database using natural language.": "使用自然语言与 Firestore 数据库中存储的文档进行交互。",
    "Access resources in the Cloud Logging platform using natural language.": "使用自然语言访问 Cloud Logging 平台中的资源。",
    "Manage clusters for Managed Service for Apache Kafka and Kafka Connect using natural language.": "使用自然语言管理 Managed Service for Apache Kafka 和 Kafka Connect 的集群。",
    "Access resources in the Cloud Monitoring platform using natural language.": "使用自然语言访问 Cloud Monitoring 平台中的资源。",
    "Manage Pub/Sub resources and publish messages. Create, list, get, update, and delete Pub/Sub topics, subscriptions, and snapshots, as well as publish messages to topics.": "管理 Pub/Sub 资源并发布消息。创建、列出、获取、更新和删除 Pub/Sub 主题、订阅及快照，以及向主题发布消息。",
    "Enable Antigravity to control and inspect a live Chrome browser, with access to the full power of Chrome DevTools for reliable automation, in-depth debugging, and performance analysis.": "允许 Antigravity 控制并检查正在运行的 Chrome 浏览器，访问完整的 Chrome 开发者工具，以实现可靠的自动化、深度的调试和性能分析。"
  };

  const coreWords = {
    "create": "创建", "delete": "删除", "new": "新建", "edit": "编辑", "save": "保存", "cancel": "取消", "confirm": "确认",
    "close": "关闭", "open": "打开", "stop": "停止", "start": "启动", "run": "运行", "add": "添加", "remove": "移除",
    "update": "更新", "select": "选择", "clear": "清除", "search": "搜索", "find": "查找", "view": "查看", "show": "显示", "hide": "隐藏",
    "agent": "智能体", "agents": "智能体", "subagent": "子智能体", "subagents": "子智能体", "task": "任务", "tasks": "任务",
    "workspace": "工作区", "workspaces": "工作区", "directory": "目录", "folder": "文件夹", "file": "文件", "files": "文件",
    "command": "命令", "commands": "命令", "terminal": "终端", "console": "控制台", "output": "输出", "input": "输入",
    "log": "日志", "logs": "日志", "setting": "设置", "settings": "设置", "preference": "偏好", "preferences": "偏好",
    "theme": "主题", "themes": "主题", "model": "模型", "models": "模型", "capability": "能力", "capabilities": "能力",
    "running": "运行中", "completed": "已完成", "failed": "已失败", "pending": "等待中", "success": "成功", "error": "错误",
    "system": "系统", "prompt": "提示词", "instructions": "指令", "description": "描述", "name": "名称", "version": "版本",
    "active": "活跃", "background": "后台", "parent": "父级", "child": "子级", "branch": "分支", "share": "共享", "inherit": "继承",
    "original": "原始", "backup": "备份", "duration": "持续时间", "seconds": "秒", "timer": "定时器", "timers": "定时器",
    "schedule": "调度", "cron": "定时任务", "tools": "工具", "tool": "工具", "execute": "执行", "execution": "执行", "plan": "计划",
    "chat": "聊天", "message": "消息", "messages": "消息", "history": "历史", "clear history": "清除历史",
    "worked": "工作了", "changed": "已更改", "review": "审核", "reviewing": "审核中", "reviewed": "已审核", "for": "持续",
    "thought": "思考了", "edited": "编辑了", "canceled": "已取消", "js": "Js",
    "explore": "探索", "explored": "浏览了", "change": "更改", "changes": "更改",
    "turn": "回合", "turns": "回合"
  };

  const combinedDict = Object.assign({}, coreWords, dictionary);

  const substringReplacements = [
    { search: " tokens", replace: " 标记" },
    { search: "Load older messages, showing", replace: "加载历史消息，当前显示" },
    { search: "of", replace: "共" },
    { search: "See all", replace: "查看全部" },
    { search: "Worked for", replace: "已工作 " },
    { search: "Thinking for", replace: "已思考 " },
    { search: 'Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products. You can always change your choices in Settings.', replace: '插件是包含技能和 MCP 服务封装的资源包，旨在协助 Antigravity 智能体调用 Google 开发者产品。您随时可以在设置中更改选择。' },
    { search: 'Plugins are packaged collections of skills and MCPs to help the Agent', replace: '插件是包含技能和 MCP 服务封装的资源包，旨在协助智能体' },
    { search: 'in Antigravity', replace: '在 Antigravity 中' },
    { search: 'work with Google', replace: '调用 Google' },
    { search: 'developer products.', replace: '开发者产品。' },
    { search: 'Developer products.', replace: '开发者产品。' },
    { search: 'You can always change your choices in Settings.', replace: '您随时可以在设置中更改选择。' },
    { search: 'Reliable automation, in-depth debugging, and performance analysis in Chrome using Chrome DevTools and Puppeteer', replace: '在 Chrome 浏览器中利用 DevTools 调试协议与 Puppeteer 实现高可靠性自动化、深度调试及性能剖析' },
    { search: 'Dart and Flutter', replace: 'Dart & Flutter' },
    { search: 'Skills providing tailored instructions for happy path Dart & Flutter development workflows.', replace: '针对 Dart & Flutter 基础及常用开发工作流提供定制化的智能体指令集支持。' },
    { search: 'Configure the browser subagent. Running this feature requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.', replace: '配置浏览器子智能体。运行此功能需要安装 Google Chrome 浏览器。可以通过在对话输入框中输入 /browser 来调用浏览器子智能体。' },
    { search: 'Configure the browser subagent. Running this feature requires', replace: '配置浏览器子智能体。运行此功能需要安装' },
    { search: 'to be installed', replace: '即可' },
    { search: 'The browser subagent can be invoked by typing', replace: '可以通过在对话输入框中输入' },
    { search: 'in the conversation input box.', replace: '来调用浏览器智能体。' },
    { search: 'Browser Actuation Permissions', replace: '浏览器动作执行权限' },
    { search: 'Allow/deny agent browser actuation access to specific URLs.', replace: '允许或阻止智能体在浏览器中操作访问特定的 URL 地址列表。' },
    { search: 'Download', replace: '下载' },
    { search: 'Search MCP servers by name', replace: '按名称搜索 MCP 服务端' },
    { search: 'Interact with the Dux platform using natural language. This MCP server enables agentic capabilities for account clients.', replace: '使用自然语言与 Dux 平台进行交互。该 MCP 服务端为账户客户端启用了智能体功能。' },
    { search: 'Connect your AI assistant to Firebase. Exposes tools for database, auth, and analytics to build and deploy app projects.', replace: '将您的 AI 助手连接到 Firebase。提供用于数据库、身份验证和分析的工具，以构建和部署应用项目。' },
    { search: 'The go-pls (Go Language Server) MCP server provides tools for semantic code navigation, refactoring, and code completion in your Go projects.', replace: 'go-pls (Go 语言服务器) MCP 服务端提供用于 Go 项目中语义代码导航、重构和代码补全的工具。' },
    { search: 'Interact with BigQuery data using natural language. This MCP server lists datasets, runs queries, and inspects database schemas.', replace: '使用自然语言与 BigQuery 数据进行交互。该 MCP 服务端可以列出数据集、运行查询并检查数据库 Schema。' },
    { search: 'The AlloyDB for PostgreSQL server MCP exposes a schema and a set of tools to manage AlloyDB clusters and resources, manage users, create and restore backups', replace: 'AlloyDB for PostgreSQL MCP 服务端公开了 Schema 和一组工具，用于管理 AlloyDB 集群和资源、管理用户、创建和恢复备份' },
    { search: 'The Google Cloud Bigtable Admin MCP server lets you manage Bigtable resources.', replace: 'Google Cloud Bigtable Admin MCP 服务端允许您管理 Bigtable 资源。' },
    { search: 'The Cloud SQL template MCP server lets you create and run Cloud SQL tools to examine database performance, configure instances, view logs, and more.', replace: 'Cloud SQL 模板 MCP 服务端允许您创建和运行 Cloud SQL 工具，以检查数据库性能、配置实例、查看日志等。' },
    { search: 'The Spanner template MCP server lets you create and run Spanner tools to create, querying, and query Spanner resources.', replace: 'Spanner 模板 MCP 服务端允许您创建和运行 Spanner 工具，以创建、查询和管理 Spanner 资源。' },
    { search: 'Connect your AI assistant to Looker business intelligence. This MCP server enables data exploration and content management by allowing agents to execute runs', replace: '将您的 AI 助手连接到 Looker 商业智能。该 MCP 服务端允许智能体执行数据探索和内容管理' },
    { search: 'Connect your AI assistant to the Knowledge Sharing (formerly known as Dataplex)', replace: '将您的 AI 助手连接到知识共享（前身为 Dataplex）' },
    { search: 'The MCP Toolbox for Databases is an open-source MCP server designed to simplify and secure the development of tools for interacting with databases.', replace: 'MCP Toolbox for Databases 是一个开源的 MCP 服务端，旨在简化并保护与数据库交互的工具开发。' },
    { search: 'Interact with your Oracle Database using natural language. The MCP server allows you to safely connect to your database for execution, sql querying,', replace: '使用自然语言与您的 Oracle 数据库进行交互。该 MCP 服务端允许您安全地连接到数据库以执行 SQL 查询等' },
    { search: 'The Figma Dev Mode MCP Server helps developers understand design layouts by converting design layout information to structural layout annotations', replace: 'Figma Dev Mode MCP 服务端通过将设计布局信息转换为结构化布局注释，帮助开发人员理解设计布局' },
    { search: 'The standard GitHub Server for interacting with GitHub API', replace: '用于与 GitHub API 交互的官方标准 GitHub 服务端' },
    { search: 'Allows AI Agents to interact with the Glean API, searching for items, reading documents, and conducting search queries.', replace: '允许 AI 智能体与 Glean API 进行交互，以搜索项目、阅读文档并执行搜索查询。' },
    { search: 'The official Model Context Protocol server allows you to integrate with Stripe APIs to perform user billing, files and support issues lookup, and transaction lookup.', replace: '官方模型上下文协议 (MCP) 服务端允许您与 Stripe API 集成，以执行用户计费、文件和支持问题查找以及交易查询。' },
    { search: 'Interact with Sentry issues and events.', replace: '与 Sentry 的问题 (Issues) 和事件 (Events) 进行交互。' },
    { search: 'Official Slack MCP Server for interacting with Slack channels, users, and sending messages.', replace: '官方 Slack MCP 服务端，用于与 Slack 频道、用户进行交互并发送消息。' },
    { search: 'Official Linear MCP Server for interacting with Linear projects, issues, and teams.', replace: '官方 Linear MCP 服务端，用于与 Linear 项目、问题和团队进行交互。' },
    { search: 'An MCP server implementation that integrates the Puppeteer library to provide agents with web research capabilities.', replace: '集成了 Puppeteer 库的 MCP 服务端实现，为智能体提供网页调研能力。' },
    { search: 'Official Figma MCP Server allows integration with Figma APIs for file review, code generation, and assets assets search.', replace: '官方 Figma MCP 服务端，允许与 Figma API 集成以进行文件评审、代码生成和资源搜索。' },
    { search: 'The Heroku Platform API server provides seamless access to Heroku resources including apps, config vars, deploy keys, manage application, add-ons', replace: 'Heroku 平台 API 服务端提供对 Heroku 资源（包括应用、配置变量、部署密钥、应用管理、插件等）的无缝访问' },
    { search: 'The Pinecone MCP server enables AI assistants to perform vector search, database index creation, generate code context to coordinate configuration, and', replace: 'Pinecone MCP 服务端允许 AI 助手执行向量搜索、数据库索引创建、生成代码上下文以协调配置等' },
    { search: 'Connect your Supabase projects to AI assistants. This MCP server handles managing tables, executing queries, database schema querying, checking connection logs, and', replace: '将您的 Supabase 项目连接 to AI 助手。该 MCP 服务端负责管理表、执行查询、数据库 Schema 查询、检查连接日志等' },
    { search: 'The Prisma MCP Server exposes API endpoints for database schema querying and migration execution.', replace: 'Prisma MCP 服务端公开了用于数据库 Schema 查询和迁移执行的 API 端点。' },
    { search: 'Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY)', replace: '提供 Google Antigravity (AGY) 的全面指南、快速参考和网站地图' },
    { search: 'including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations.', replace: '包括 Antigravity 命令行界面 (agy)、Antigravity 2.0、Antigravity IDE、Python SDK、斜杠命令、快捷键以及自定义设置。' },
    { search: 'Activate this skill when the user asks questions about how to use, configure, or customize Antigravity, AGY, the agy CLI, the Antigravity IDE, or Antigravity 2.0.', replace: '当用户询问如何使用、配置或自定义 Antigravity、AGY、agy 命令行、Antigravity IDE 或 Antigravity 2.0 时，激活此技能。' },
    { search: 'Search MCP servers by name', replace: '按名称搜索 MCP 服务端' },
    { search: 'Investigate and fix software issues using AI-powered root cause analysis. This MCP server connects to your Antimetal account to search issues, read', replace: '使用 AI 驱动的根因分析调查和修复软件问题。该 MCP 服务端连接到您的 Antimetal 账户以搜索问题、读取' },
    { search: 'Query and act on your marketing, analytics, CRM, e-commerce, and warehouse data', replace: '查询并处理您的营销、分析、CRM、电子商务和仓库数据' },
    { search: 'across 325+ connectors (Meta Ads, Google Ads, TikTok Ads, GA4, HubSpot,', replace: '支持 325+ 个连接器（Meta 广告、Google 广告、TikTok 广告、GA4、HubSpot' },
    { search: 'Query your GitLab SDLC as a knowledge graph.', replace: '将您的 GitLab SDLC 作为知识图谱进行查询。' },
    { search: 'Orbit indexes groups, projects, source code, merge requests, pipelines, work items, and security findings into a single graph so agents can answer blast radius', replace: 'Orbit 将群组、项目、源代码、合并请求、流水线、工作项和安全发现索引到单个图谱中，以便智能体能够回答影响范围' },
    { search: 'Enable Antigravity to deploy apps to Google Cloud Run.', replace: '允许 Antigravity 将应用部署到 Google Cloud Run。' },
    { search: 'Interact directly with the PostHog product analytics platform using natural language.', replace: '使用自然语言直接与 PostHog 产品分析平台进行交互。' },
    { search: 'Run queries, manage feature flags, track errors, and manage projects.', replace: '运行查询、管理特性标志、跟踪错误并管理项目。' },
    { search: 'Allows interacting with Google Kubernetes Engine (GKE) clusters on Google Cloud Platform (GCP).', replace: '允许在 Google Cloud Platform (GCP) 上与 Google Kubernetes Engine (GKE) 集群进行交互。' },
    { search: 'Toggle Developer Tools', replace: '切换开发者工具' },
    { search: 'Full Machine', replace: '整机授权' },
    { search: 'Turbo Mode', replace: '极速模式' },
    { search: 'Turbo mode', replace: '极速模式' },
    { search: 'Learn more about ', replace: '了解更多关于 ' },
    { search: 'Learn more about', replace: '了解更多关于' },
    { search: 'Enable Telemetry', replace: '允许收集匿名使用数据' },
    { search: 'Manually customize individual settings.', replace: '手动配置具体的权限规则。' },
    { search: 'Working..', replace: '正在处理..' },
    { search: 'Working...', replace: '正在处理...' },
    { search: 'Working.', replace: '正在处理...' },
    { search: 'Thinking..', replace: '正在思考..' },
    { search: 'Thinking...', replace: '正在思考...' },
    { search: 'Analyzing..', replace: '正在分析..' },
    { search: 'Analyzing...', replace: '正在分析...' },
    { search: 'Danger Zone', replace: '危险区域' },
    { search: 'Delete Project', replace: '删除项目' },
    { search: 'Permanently delete this project and all of its conversations', replace: '永久删除此项目及其所有的对话记录' },
    { search: 'Are you sure you want to delete the project', replace: '您确定要删除项目' },
    { search: 'This will permanently delete', replace: '这将永久删除' },
    { search: 'within it. This action cannot be undone.', replace: '。此操作无法撤销。' },
    { search: 'active conversations', replace: '个活跃对话' },
    { search: 'active conversation', replace: '个活跃对话' },
    { search: 'archived conversations', replace: '个已归档对话' },
    { search: 'archived conversation', replace: '个已归档对话' },
    { search: 'Permanently delete', replace: '永久删除' },
    { search: 'including', replace: '，包含' },
    { search: 'within it.', replace: '。' },
    { search: 'Add Context', replace: '添加上下文' },
    { search: 'Media', replace: '媒体文件 (图片/视频)' },
    { search: 'Mentions', replace: '提及项 (@ 符号)' },
    { search: 'Actions', replace: '动作指令 (/ 符号)' },
    { search: 'Toggle Model Selector', replace: '切换模型选择器' },
    { search: 'Toggle Voice Recording', replace: '开启/关闭语音录制' },
    { search: 'Find in Pane', replace: '在窗格中查找' },
    { search: 'LAYOUT CONTROLS', replace: '布局控制' },
    { search: 'Toggle Sidebar', replace: '开启/关闭侧边栏' },
    { search: 'Toggle Auxiliary Pane', replace: '开启/关闭辅助窗格' },
    { search: 'Zoom In', replace: '放大' },
    { search: 'Zoom Out', replace: '缩小' },
    { search: 'Reset Zoom', replace: '重置缩放' },
    { search: 'Go To Projects', replace: '前往项目管理中心' },
    { search: 'Light Theme', replace: '浅色主题' },
    { search: 'Dark Theme', replace: '深色主题' }
  ];

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
    
    // --- 5-hour limit dynamic text (Hit warnings) ---
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

    // --- Baseline model quota reset date warning ---
    const matchBaselineQuota = trimmed.match(/^Your plan's baseline quota will refresh on (\d{4}\/\d{1,2}\/\d{1,2} \d{2}:\d{2}:\d{2})\. To continue using this model now, enable AI Credit overages\.?$/i);
    if (!isDynamic && matchBaselineQuota) {
      dynamicMatch = `您的计划基础额度将在 ${matchBaselineQuota[1]} 重置。若要立即继续使用此模型，请启用 AI 超额额度。`;
      isDynamic = true;
    }
    // Community MCP registry template rules
    const matchEnable = trimmed.match(/^Enable Antigravity to (interact with|deploy apps to) (.*?)\.?$/i);
    if (matchEnable) {
      const act = matchEnable[1];
      const target = matchEnable[2];
      if (act === 'interact with') {
        dynamicMatch = `允许 Antigravity 与 ${target} 进行交互。`;
      } else {
        dynamicMatch = `允许 Antigravity 将应用部署到 ${target}。`;
      }
      isDynamic = true;
    }
    
    const matchExposes = trimmed.match(/^The (.*?) MCP server exposes (.*?) development tool actions to compatible AI-assistant clients\.?$/i);
    if (!isDynamic && matchExposes) {
      const name = matchExposes[1];
      const target = matchExposes[2];
      dynamicMatch = `${name} MCP 服务端，向兼容的 AI 助手客户端公开 ${target} 开发工具操作。`;
      isDynamic = true;
    }

    const matchGives = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) (Server|server) gives AI-powered development tools the ability to (.*?)\.?$/i);
    if (!isDynamic && matchGives) {
      const name = matchGives[1];
      let action = matchGives[3];
      action = action.replace(/work with your (.*?) projects and your app's codebase/i, '协同处理您的 $1 项目及应用代码库');
      action = action.replace(/build, debug and inspect your (.*?) app/i, '构建、调试与检查您的 $1 应用');
      action = action.replace(/build, debug and inspect your (.*)/i, '构建、调试与检查您的 $1');
      dynamicMatch = `针对 ${name} 的模型上下文协议 (MCP) 服务端，为 AI 辅助开发工具提供${action}的能力。`;
      isDynamic = true;
    }

    const matchProvides = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) server provides tools for (.*?)\.?$/i);
    if (!isDynamic && matchProvides) {
      const name = matchProvides[1];
      let action = matchProvides[2];
      action = action.replace(/semantic code analysis, live diagnostics, and transformation of your non-google3 Go codebase/i, '语义代码分析、实时诊断和非 google3 Go 代码库的转换');
      dynamicMatch = `${name} 模型上下文协议 (MCP) 服务端，提供用于 ${action} 的工具。`;
      isDynamic = true;
    }

    // 5. Interact with your ... data...
    const matchInteractData = trimmed.match(/^Interact with your (.*?) data using natural language\. This MCP server (.*?)\.?$/i);
    if (!isDynamic && matchInteractData) {
      const target = matchInteractData[1];
      let action = matchInteractData[2];
      action = action.replace(/allows you to securely connect to your datasets to search the datasets, inspect table.*/i, '允许您安全地连接到数据集以搜索数据集、检查数据表并获取结构信息。');
      dynamicMatch = `使用自然语言与您的 ${target} 数据进行交互。该 MCP 服务端${action}`;
      isDynamic = true;
    }

    // 6. Connect your AI assistant(s) to ...
    const matchConnectAI = trimmed.match(/^Connect your AI assistant(?:s)? to (.*?)(?:\. This MCP server|,)(?:\s+)?(enables|enabling) (.*?)\.?$/i);
    if (!isDynamic && matchConnectAI) {
      const target = matchConnectAI[1];
      let action = matchConnectAI[3];
      action = action.replace(/data exploration and content management by allowing you to execute.*/i, '通过允许您执行自然语言查询，来实现数据探索与内容管理。');
      action = action.replace(/data discovery and governance by allowing you to.*/i, '通过允许您执行数据探索和治理，来实现数据发现与数据治理。');
      dynamicMatch = `将您的 AI 助手连接到 ${target}。该 MCP 服务端${action}`;
      isDynamic = true;
    }

    // 7. The ... remote MCP server lets you ... (Bigtable Admin, Cloud SQL, Spanner)
    const matchRemoteMCP = trimmed.match(/^The (.*?) (?:remote )?MCP server lets you (.*?)\.?$/i);
    if (!isDynamic && matchRemoteMCP) {
      const name = matchRemoteMCP[1];
      let action = matchRemoteMCP[2];
      action = action.replace(/manage (.*?) resources/i, '管理 $1 资源');
      action = action.replace(/access and run (.*?) tools to (.*)/i, '访问和运行 $1 工具以：$2');
      action = action.replace(/manage Cloud SQL instances, manage users, create and restore backups.*/i, '管理 Cloud SQL 实例、管理用户、创建和恢复备份等');
      action = action.replace(/manage AlloyDB clusters and instances, manage users, create and restore.*/i, '管理 AlloyDB 集群和实例、管理用户、创建和恢复备份等');
      action = action.replace(/create, manage, and query Spanner resources from your AI-enabled development.*/i, '从您的 AI 辅助开发环境中创建、管理和查询 Spanner 资源');
      dynamicMatch = `${name} 远程 MCP 服务端，允许您${action}。`;
      isDynamic = true;
    }

    // MCP Server Description dynamic translation
    const matchAllows = trimmed.match(/^(Allows running|Allows interacting with|Allows querying|Allows accessing|Provides tools to|Provides tools for|Provides tools) (.*?)\.? This tool runs on the host system outside of any sandboxes\.?$/i);
    if (!isDynamic && matchAllows) {
      const action = matchAllows[1].toLowerCase();
      const target = matchAllows[2].trim();
      let actionZh = '';
      if (action.includes('running')) {
        actionZh = '允许运行';
      } else if (action.includes('interacting')) {
        actionZh = '允许与';
      } else if (action.includes('querying')) {
        actionZh = '允许查询';
      } else if (action.includes('accessing')) {
        actionZh = '允许访问';
      } else if (action.includes('tools for') || action.includes('tools to') || action.includes('provides tools')) {
        actionZh = '提供用于';
      }
      
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
      else if (targetLower === 'google cloud pub/sub') targetZh = 'Google Cloud Pub/Sub';
      else if (targetLower === 'google cloud storage') targetZh = 'Google Cloud Storage';
      else if (targetLower === 'google cloud spanner') targetZh = 'Google Cloud Spanner';
      else if (targetLower === 'google cloud secret manager') targetZh = 'Google Cloud Secret Manager';
      else if (targetLower === 'google cloud kms') targetZh = 'Google Cloud KMS';
      else if (targetLower === 'github repositories') targetZh = 'GitHub 仓库';
      else if (targetLower === 'gitlab repositories') targetZh = 'GitLab 仓库';
      else if (targetLower === 'gmail messages and drafts') targetZh = 'Gmail 邮件与草稿';
      else if (targetLower === 'google calendar events') targetZh = 'Google 日历事件';
      else if (targetLower === 'google docs documents') targetZh = 'Google 文档';
      else if (targetLower === 'google drive files and folders') targetZh = 'Google 云端硬盘文件与文件夹';
      else if (targetLower === 'google sheets spreadsheets') targetZh = 'Google 表格';
      else if (targetLower === 'jira issues') targetZh = 'Jira 事务';
      else if (targetLower === 'confluence pages') targetZh = 'Confluence 页面';
      else if (targetLower === 'slack channels and messages') targetZh = 'Slack 频道与消息';
      else if (targetLower === 'linear issues') targetZh = 'Linear 事务';
      else if (targetLower === 'notion pages and databases') targetZh = 'Notion 页面与数据库';
      else if (targetLower === 'a postgresql database') targetZh = 'PostgreSQL 数据库';
      else if (targetLower === 'a mysql database') targetZh = 'MySQL 数据库';
      else if (targetLower === 'a redis cache') targetZh = 'Redis 缓存';
      else if (targetLower === 'an elasticsearch cluster') targetZh = 'Elasticsearch 集群';
      else if (targetLower === 'a mongodb database') targetZh = 'MongoDB 数据库';
      else if (targetLower === 'sentry projects and issues') targetZh = 'Sentry 项目与问题';
      else if (targetLower === 'datadog services') targetZh = 'Datadog 服务';
      else if (targetLower === 'aws services') targetZh = 'AWS 服务';
      else if (targetLower === 'azure services') targetZh = 'Azure 服务';
      else if (targetLower === 'cloudflare services') targetZh = 'Cloudflare 服务';
      else if (targetLower === 'vercel services') targetZh = 'Vercel 服务';
      else if (targetLower === 'heroku services') targetZh = 'Heroku 服务';
      else if (targetLower === 'netlify services') targetZh = 'Netlify 服务';
      else if (targetLower === 'github copilot services') targetZh = 'GitHub Copilot 服务';
      else if (targetLower === 'openai services') targetZh = 'OpenAI 服务';
      else if (targetLower === 'anthropic services') targetZh = 'Anthropic 服务';
      else if (targetLower === 'google gemini services') targetZh = 'Google Gemini 服务';
      else if (targetLower === 'google vertex ai services') targetZh = 'Google Vertex AI 服务';

      if (action.includes('tools for') || action.includes('tools to') || action.includes('provides tools')) {
        dynamicMatch = `${actionZh}${targetZh}的工具。该工具运行在沙盒外的宿主系统上。`;
      } else if (action.includes('interacting')) {
        dynamicMatch = `${actionZh}${targetZh}进行交互。该工具运行在沙盒外的宿主系统上。`;
      } else {
        dynamicMatch = `${actionZh}${targetZh}。该工具运行在沙盒外的宿主系统上。`;
      }
      isDynamic = true;
    }

    // Weekly limit dynamic text
    if (/^You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?/, '您已消耗了部分每周限额，将在 $1 天 $2 小时后完全重置。');
      isDynamic = true;
    } else if (/^You have used some of your weekly limit, it will fully refresh in (\d+) days?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) days?\.?/, '您已消耗了部分每周限额，将在 $1 天后完全重置。');
      isDynamic = true;
    } else if (/^You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?/, '您已消耗了部分每周限额，将在 $1 小时后完全重置。');
      isDynamic = true;
    } else if (/^You have used some of your weekly limit, it will fully refresh in (\d+) minutes?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) minutes?\.?/, '您已消耗了部分每周限额，将在 $1 分钟后完全重置。');
      isDynamic = true;
    }

    // 5-hour limit dynamic text
    if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?/, '您已消耗了部分 5 小时限额，将在 $1 小时 $2 分钟后完全重置。');
      isDynamic = true;
    } else if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?\.?/, '您已消耗了部分 5 小时限额，将在 $1 分钟后完全重置。');
      isDynamic = true;
    }
    // "Show N breakdown" / "Show N breakdowns"
    if (/^Show (\d+) breakdowns?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/Show (\d+) breakdowns?/, '显示 $1 个详细分项');
      isDynamic = true;
    }

    // "Hide N breakdown" / "Hide N breakdowns"
    if (!isDynamic && /^Hide (\d+) breakdowns?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/Hide (\d+) breakdowns?/, '收起 $1 个详细分项');
      isDynamic = true;
    }

    // "X% of the customization budget is available." (dynamic percentage)
    if (!isDynamic && /^(\d+\.?\d*)% of the customization budget is available\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/^(\d+\.?\d*)% of the customization budget is available\.?$/, '$1% 的自定义额度可用。');
      isDynamic = true;
    }

    // "Permanently delete [project] including X active conversation(s) and X archived conversation(s)."
    if (!isDynamic && /^Permanently delete .+ including \d+ active conversations? and \d+ archived conversations?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(
        /^Permanently delete (.+) including (\d+) active conversations? and (\d+) archived conversations?\.?$/,
        '永久删除「$1」，包含 $2 个活跃对话和 $3 个已归档对话。'
      );
      isDynamic = true;
    }


    if (isDynamic) {
      return text.replace(trimmed, dynamicMatch);
    }

    // 1. Direct Literal Match
    if (dictionary[trimmed]) {
      return text.replace(trimmed, dictionary[trimmed]);
    }
    
    const trimmedLower = trimmed.toLowerCase();
    for (const key in dictionary) {
      if (key.toLowerCase() === trimmedLower) {
        return text.replace(trimmed, dictionary[key]);
      }
    }

    // 2. Intelligent Punctuation Stripping & Reconstruction
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

    // 3. Fallback to word-by-word ONLY for short strings (<= 1 word)
    if (/[\u4e00-\u9fa5]/.test(core)) {
      return text;
    }
    const wordsCount = core.split(/\s+/).filter(Boolean).length;
    if (wordsCount > 1) {
      return text;
    }

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
    if (matchPunc) {
      finalTranslated += trailPunc;
    }
    return text.replace(trimmed, finalTranslated);
  }

  const codeClassPattern = /(?:^|[\s_-])(code|diff|source|syntax|highlight|viewer|hljs|shiki|prism|monaco|codemirror|token|line-number|line-content|gutter|codeblock|code-block|code-view|code-preview|file-preview|file-content)(?:$|[\s_-])/i;

  function shouldSkipNode(node) {
    if (!node) return true;
    
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

  const translationAuditState = {
    translated: new Set(),
    missingSeen: new Set(),
    missing: new Map(),
    flushTimer: null,
    flushPromise: null
  };

  const translationAuditIgnore = new Set([
    'antigravity', 'google', 'gemini', 'claude', 'openai', 'github', 'gitlab',
    'firebase', 'chrome', 'chromium', 'electron', 'javascript', 'typescript',
    'python', 'windows', 'macos', 'linux', 'json', 'yaml', 'html', 'css', 'api',
    'mcp', 'sdk', 'cli', 'gpt', 'gpt-oss', 'oauth', 'url', 'uri', 'http', 'https'
  ]);

  const translationAuditSingleWordUi = new Set([
    'accept', 'account', 'actions', 'add', 'advanced', 'allow', 'appearance', 'apply',
    'approve', 'back', 'browse', 'cancel', 'clear', 'close', 'confirm', 'connect',
    'continue', 'copy', 'create', 'delete', 'deny', 'disable', 'download', 'edit',
    'enable', 'error', 'export', 'failed', 'finish', 'general', 'hide', 'history',
    'import', 'install', 'language', 'loading', 'manage', 'media', 'model', 'new',
    'next', 'open', 'permissions', 'previous', 'project', 'refresh', 'reject',
    'remove', 'rename', 'reset', 'retry', 'run', 'running', 'save', 'search',
    'select', 'settings', 'share', 'show', 'skip', 'start', 'status', 'stop',
    'submit', 'success', 'theme', 'tools', 'uninstall', 'update', 'upload', 'view',
    'warning', 'workspace'
  ]);

  function normalizeAuditText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function isLikelyUntranslatedUiText(value) {
    const text = normalizeAuditText(value);
    if (text.length < 2 || text.length > 180) return false;
    if (/[一-鿿]/.test(text) || !/[A-Za-z]/.test(text)) return false;
    if (/^(?:https?:\/\/|www\.|file:|data:|blob:)/i.test(text)) return false;
    if (/\b[A-Z]:\\|(?:^|\s)[./~][\w./\\-]+/.test(text)) return false;
    if (/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/.test(text)) return false;
    if (/^[a-f0-9]{24,}$/i.test(text) || /^[A-Za-z0-9+/=_-]{48,}$/.test(text)) return false;
    if (/^[\w.-]+\.(?:js|ts|tsx|jsx|json|md|css|html|py|ps1|bat|exe|dll)$/i.test(text)) return false;
    if (/^[{}[\]()<>=_$#@`'"\\/|:;,.+*?!~-]+$/.test(text)) return false;

    const words = text.match(/[A-Za-z][A-Za-z'-]*/g) || [];
    if (words.length === 0 || words.length > 28) return false;
    if (words.length === 1 && translationAuditIgnore.has(words[0].toLowerCase())) return false;
    if (words.length === 1 && !translationAuditSingleWordUi.has(words[0].toLowerCase())) return false;
    return true;
  }

  function isAuditExcludedElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
    if (element.closest && element.closest(
      '#antigravity-quota-widget, #antigravity-translation-audit, [data-agy-translation-audit], ' +
      'input, textarea, [contenteditable="true"], pre, code, .monaco-editor, ' +
      '.markdown, .markdown-body, .prose, .user-message, .assistant-message, .message-content'
    )) return true;
    const root = element.getRootNode && element.getRootNode();
    return Boolean(root && root.host && (
      root.host.id === 'antigravity-quota-widget' ||
      root.host.id === 'antigravity-translation-audit'
    ));
  }

  function buildAuditSelector(element) {
    if (!element || !element.tagName) return '';
    const parts = [];
    let current = element;
    for (let depth = 0; current && current.tagName && depth < 3; depth += 1) {
      let part = current.tagName.toLowerCase();
      const role = current.getAttribute && current.getAttribute('role');
      const testId = current.getAttribute && current.getAttribute('data-testid');
      if (role && /^[\w-]{1,40}$/.test(role)) part += `[role="${role}"]`;
      if (testId && /^[\w-]{1,60}$/.test(testId)) part += `[data-testid="${testId}"]`;
      const classes = current.classList
        ? Array.from(current.classList).filter(c => /^[A-Za-z_-][\w-]{0,50}$/.test(c)).slice(0, 2)
        : [];
      if (classes.length) part += '.' + classes.join('.');
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(' > ').slice(0, 300);
  }

  function flushMissingTranslations() {
    if (translationAuditState.flushPromise || translationAuditState.missing.size === 0) {
      return translationAuditState.flushPromise || Promise.resolve();
    }
    const entries = Array.from(translationAuditState.missing.values());
    translationAuditState.missing.clear();
    translationAuditState.flushPromise = electron_1.ipcRenderer
      .invoke('translations:record-missing', entries)
      .catch(() => {
        for (const entry of entries) {
          const key = `${entry.text.toLowerCase()}\u0000${entry.attribute}`;
          const existing = translationAuditState.missing.get(key);
          if (existing) existing.count += entry.count;
          else translationAuditState.missing.set(key, entry);
        }
      })
      .finally(() => {
        translationAuditState.flushPromise = null;
        if (translationAuditState.missing.size > 0) scheduleMissingTranslationFlush();
      });
    return translationAuditState.flushPromise;
  }

  function scheduleMissingTranslationFlush() {
    if (translationAuditState.flushTimer) return;
    translationAuditState.flushTimer = setTimeout(() => {
      translationAuditState.flushTimer = null;
      flushMissingTranslations();
    }, 1500);
  }

  function recordTranslationAudit(original, translated, element, attribute = 'textContent') {
    const text = normalizeAuditText(original);
    if (!isLikelyUntranslatedUiText(text) || isAuditExcludedElement(element)) return;
    if (normalizeAuditText(translated) !== text && /[一-鿿]/.test(translated)) {
      translationAuditState.translated.add(text.toLowerCase());
      return;
    }

    const key = `${text.toLowerCase()}\u0000${attribute}`;
    translationAuditState.missingSeen.add(key);
    const now = new Date().toISOString();
    const existing = translationAuditState.missing.get(key);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = now;
    } else {
      translationAuditState.missing.set(key, {
        text,
        route: `${location.pathname || ''}${location.hash || ''}`.slice(0, 240),
        element: element && element.tagName ? element.tagName.toLowerCase() : '',
        attribute,
        selector: buildAuditSelector(element),
        count: 1,
        firstSeen: now,
        lastSeen: now
      });
    }
    scheduleMissingTranslationFlush();
  }

  function getTranslationAuditSessionStats() {
    const translated = translationAuditState.translated.size;
    const missing = translationAuditState.missingSeen.size;
    const total = translated + missing;
    return {
      translated,
      missing,
      coverage: total > 0 ? Math.round((translated / total) * 1000) / 10 : 100
    };
  }

  window.addEventListener('beforeunload', () => flushMissingTranslations());

  function translateNode(node) {
    if (!node) return;
    if (shouldSkipNode(node)) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const original = node.nodeValue;
      const translated = translateString(original);
      recordTranslationAudit(original, translated, node.parentElement, 'textContent');
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
              recordTranslationAudit(original, translated, node, attr);
              if (original !== translated) {
              node.setAttribute(attr, translated);
            }
          }
        }
      });
      if (node.shadowRoot) {
        translateNode(node.shadowRoot);
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
              recordTranslationAudit(original, translated, node.parentElement, 'textContent');
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
                recordTranslationAudit(original, translated, target, attrName);
                if (original !== translated) {
                  target.setAttribute(attrName, translated);
                }
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

  // Hook document title updates so that the window title is localized
  try {
    const originalTitleDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'title');
    if (originalTitleDescriptor && originalTitleDescriptor.set) {
      Object.defineProperty(document, 'title', {
        get: function() {
          return originalTitleDescriptor.get.call(this);
        },
        set: function(val) {
          if (!val) {
            originalTitleDescriptor.set.call(this, val);
            return;
          }
          const trimmed = val.trim();
          let translated = val;
          if (dictionary[trimmed]) {
            translated = val.replace(trimmed, dictionary[trimmed]);
          } else if (trimmed.includes(' - Antigravity')) {
            const part = trimmed.replace(' - Antigravity', '').trim();
            if (dictionary[part]) {
              translated = `${dictionary[part]} - Antigravity`;
            }
          }
          originalTitleDescriptor.set.call(this, translated);
        }
      });
    }
  } catch (e) {
    console.error('Failed to hook document title:', e);
  }

  // Dynamic Cloud Dictionary Auto-Updater (Cached via localStorage for instant startup)
  try {
    const cachedDict = localStorage.getItem('antigravity_chinese_patch_dict');
    if (cachedDict) {
      const data = JSON.parse(cachedDict);
      Object.assign(dictionary, data);
    }
  } catch (e) {
    console.error('Failed to load cached cloud dictionary:', e);
  }

  // Fetch the latest dictionary in the background (CDN fast lane with GitHub fallback)
  const dictUrls = [
    'https://fastly.jsdelivr.net/gh/good9527/Antigravity-Chinese-Patch@main/dist/dictionary.json',
    'https://raw.githubusercontent.com/good9527/Antigravity-Chinese-Patch/main/dist/dictionary.json'
  ];

  async function fetchCloudDict() {
    for (const url of dictUrls) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          if (data && typeof data === 'object') {
            localStorage.setItem('antigravity_chinese_patch_dict', JSON.stringify(data));
            Object.assign(dictionary, data);
            console.log('Antigravity Chinese Patch: Cloud dictionary updated successfully from ' + new URL(url).hostname + '! Total keys: ' + Object.keys(data).length);
            
            // Force refresh current body translation
            if (document.body) {
              translateNode(document.body);
            }
            return;
          }
        }
      } catch (err) {
        console.warn('Antigravity Chinese Patch: Failed to fetch cloud dict from ' + url, err);
      }
    }
    console.warn('Antigravity Chinese Patch: All cloud update routes failed or offline. Using cached/local dictionary.');
  }

  fetchCloudDict();

  // --- Sidebar Minimalist Quota Monitor (Minimalist / Severe style) ---
  // DFII Score: 18 (Memorable, clean DOM injection, inherits theme styles automatically)
  
  function updateStoredQuota() {
    try {
      const dialog = document.querySelector('[role="dialog"], .settings-modal, .onboarding-modal');
      if (!dialog) return;
      
      const allDivs = dialog.querySelectorAll('*');
      for (let i = 0; i < allDivs.length; i++) {
        const el = allDivs[i];
        if (!el || el.children.length > 0) continue;
        
        const text = el.textContent ? el.textContent.trim() : '';
        if (text.includes('每周频度限额') || text.includes('Weekly Limit')) {
          const val = findPercentageNearby(el);
          if (val) {
            const group = checkModelGroup(el);
            if (group === 'gemini') {
              localStorage.setItem('quota_gemini_weekly', val);
            } else if (group === 'claude') {
              localStorage.setItem('quota_claude_weekly', val);
            }
          }
        }
        else if (text.includes('5小时额度限额') || text.includes('五小时额度限额') || text.includes('Five Hour Limit') || text.includes('5-hour limit')) {
          const val = findPercentageNearby(el);
          if (val) {
            const group = checkModelGroup(el);
            if (group === 'gemini') {
              localStorage.setItem('quota_gemini_5h', val);
            } else if (group === 'claude') {
              localStorage.setItem('quota_claude_5h', val);
            }
          }
        }
      }
    } catch (e) {
      console.error('Quota scraper error:', e);
    }
  }

  function findPercentageNearby(element) {
    let parent = element.parentElement;
    if (!parent) return null;
    const text = parent.textContent || '';
    const match = text.match(/(\d+)%/);
    if (match) return match[0];
    
    let grandParent = parent.parentElement;
    if (grandParent) {
      const text2 = grandParent.textContent || '';
      const match2 = text2.match(/(\d+)%/);
      if (match2) return match2[0];
    }
    return null;
  }

  function checkModelGroup(element) {
    let cur = element;
    while (cur && cur.tagName !== 'BODY') {
      const text = cur.textContent || '';
      if (text.includes('Gemini Models')) return 'gemini';
      if (text.includes('Claude') || text.includes('GPT')) return 'claude';
      cur = cur.parentElement;
    }
    return null;
  }

  function getNativeThemeColors(anchor = document.body) {
    const rootStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const pick = (...names) => {
      for (const name of names) {
        const val = rootStyle.getPropertyValue(name).trim() || bodyStyle.getPropertyValue(name).trim();
        if (val) return val;
      }
      return '';
    };
    const parseColor = (value) => {
      const match = String(value || '').match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const parts = match[1].split(',').map(v => parseFloat(v.trim()));
      if (parts.length < 3) return null;
      if (parts.length >= 4 && parts[3] === 0) return null;
      return { r: parts[0], g: parts[1], b: parts[2] };
    };
    const rgb = (c) => `rgb(${c.r}, ${c.g}, ${c.b})`;
    const rgba = (c, a) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
    const mix = (a, b, t) => ({
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t)
    });
    const luminance = (c) => {
      const vals = [c.r, c.g, c.b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return vals[0] * 0.2126 + vals[1] * 0.7152 + vals[2] * 0.0722;
    };
    const findBackground = (start) => {
      let cur = start || document.body;
      while (cur && cur !== document.documentElement) {
        const bg = parseColor(getComputedStyle(cur).backgroundColor);
        if (bg) return bg;
        cur = cur.parentElement;
      }
      return parseColor(pick('--background', '--color-background', '--vscode-editor-background')) ||
        parseColor(bodyStyle.backgroundColor) ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? { r: 16, g: 16, b: 16 } : { r: 245, g: 245, b: 245 });
    };
    const pageBgColor = findBackground(anchor);
    const isDark = luminance(pageBgColor) < 0.45;
    const fg = isDark ? { r: 232, g: 236, b: 242 } : { r: 32, g: 35, b: 42 };
    const muted = isDark ? { r: 170, g: 176, b: 186 } : { r: 88, g: 95, b: 108 };
    const contrast = isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
    const surfaceColor = mix(pageBgColor, contrast, isDark ? 0.09 : 0.035);
    const subtleColor = mix(pageBgColor, contrast, isDark ? 0.14 : 0.055);
    const hoverColor = mix(pageBgColor, contrast, isDark ? 0.2 : 0.085);
    const accent = pick('--accent', '--primary', '--vscode-focusBorder') || '#3b82f6';
    return {
      isDark,
      accent,
      base: rgb(pageBgColor),
      surface: rgb(surfaceColor),
      foreground: rgb(fg),
      muted: rgb(muted),
      border: rgba(contrast, isDark ? 0.16 : 0.12),
      subtle: rgb(subtleColor),
      subtleHover: rgb(hoverColor),
      overlay: isDark ? 'rgba(0,0,0,0.56)' : 'rgba(0,0,0,0.26)',
      shadow: isDark ? '0 18px 48px rgba(0,0,0,0.45)' : '0 18px 42px rgba(0,0,0,0.16)'
    };
  }

  function showBeautifulConfirm(title, message, confirmText = '确定', cancelText = '取消') {
    return new Promise((resolve) => {
      const theme = getNativeThemeColors();
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.background = theme.overlay;
      overlay.style.backdropFilter = 'blur(6px)';
      overlay.style.webkitBackdropFilter = 'blur(6px)';
      overlay.style.zIndex = '2147483647';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.22s cubic-bezier(0.25, 1, 0.5, 1)';

      const card = document.createElement('div');
      card.style.background = theme.surface;
      card.style.border = '1px solid ' + theme.border;
      card.style.borderRadius = '10px';
      card.style.padding = '24px 28px';
      card.style.width = '380px';
      card.style.boxShadow = theme.shadow;
      card.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      card.style.transform = 'scale(0.92) translateY(10px)';
      card.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.22s ease';
      card.style.opacity = '0';
      card.style.color = theme.foreground;

      const titleEl = document.createElement('div');
      titleEl.style.fontSize = '16px';
      titleEl.style.fontWeight = '600';
      titleEl.style.color = theme.foreground;
      titleEl.style.marginBottom = '12px';
      titleEl.style.letterSpacing = '0';
      titleEl.textContent = title;

      const descEl = document.createElement('div');
      descEl.style.fontSize = '13.5px';
      descEl.style.lineHeight = '1.6';
      descEl.style.color = theme.muted;
      descEl.style.marginBottom = '24px';
      descEl.style.whiteSpace = 'pre-wrap';
      descEl.textContent = message;

      const btnArea = document.createElement('div');
      btnArea.style.display = 'flex';
      btnArea.style.justifyContent = 'flex-end';
      btnArea.style.gap = '12px';

      const cancelBtn = document.createElement('button');
      cancelBtn.style.background = theme.subtle;
      cancelBtn.style.border = '1px solid ' + theme.border;
      cancelBtn.style.borderRadius = '6px';
      cancelBtn.style.padding = '8px 16px';
      cancelBtn.style.fontSize = '12.5px';
      cancelBtn.style.fontWeight = '500';
      cancelBtn.style.color = theme.foreground;
      cancelBtn.style.cursor = 'pointer';
      cancelBtn.style.transition = 'all 0.15s ease';
      cancelBtn.textContent = cancelText;

      cancelBtn.onmouseenter = () => {
        cancelBtn.style.background = theme.subtleHover;
        cancelBtn.style.borderColor = theme.border;
      };
      cancelBtn.onmouseleave = () => {
        cancelBtn.style.background = theme.subtle;
        cancelBtn.style.borderColor = theme.border;
      };

      const confirmBtn = document.createElement('button');
      confirmBtn.style.background = theme.accent;
      confirmBtn.style.border = 'none';
      confirmBtn.style.borderRadius = '6px';
      confirmBtn.style.padding = '8px 20px';
      confirmBtn.style.fontSize = '12.5px';
      confirmBtn.style.fontWeight = '600';
      confirmBtn.style.color = '#ffffff';
      confirmBtn.style.cursor = 'pointer';
      confirmBtn.style.boxShadow = 'none';
      confirmBtn.style.transition = 'all 0.15s ease';
      confirmBtn.textContent = confirmText;

      confirmBtn.onmouseenter = () => {
        confirmBtn.style.transform = 'translateY(-1px)';
        confirmBtn.style.filter = theme.isDark ? 'brightness(1.12)' : 'brightness(0.96)';
      };
      confirmBtn.onmouseleave = () => {
        confirmBtn.style.transform = 'translateY(0)';
        confirmBtn.style.filter = 'brightness(1)';
      };

      btnArea.appendChild(cancelBtn);
      btnArea.appendChild(confirmBtn);
      card.appendChild(titleEl);
      card.appendChild(descEl);
      card.appendChild(btnArea);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      const close = (result) => {
        overlay.style.opacity = '0';
        card.style.transform = 'scale(0.92) translateY(10px)';
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
          resolve(result);
        }, 220);
      };

      cancelBtn.onclick = (e) => { e.stopPropagation(); close(false); };
      confirmBtn.onclick = (e) => { e.stopPropagation(); close(true); };
      overlay.onclick = (ev) => {
        if (ev.target === overlay) {
          ev.stopPropagation();
          close(false);
        }
      };

      setTimeout(() => {
        overlay.style.opacity = '1';
        card.style.opacity = '1';
        card.style.transform = 'scale(1) translateY(0)';
      }, 20);
    });
  }

  function runGrpcSniff() {
    const log = (msg) => {
        try {
            electron_1.ipcRenderer.invoke('debug:log', '[preload] ' + msg);
        } catch(e) {}
    };

    log('runGrpcSniff called');
    if (window.antigravitySniffingInProgress) {
        log('Sniff already in progress, skipping');
        return;
    }
    window.antigravitySniffingInProgress = true;
    log('Invoking accounts:sniff...');
    electron_1.ipcRenderer.invoke('accounts:sniff').then(sniffRes => {
      window.antigravitySniffingInProgress = false;
      log('accounts:sniff result: ' + JSON.stringify(sniffRes));
      if (sniffRes && sniffRes.success && (sniffRes.newlySaved || sniffRes.updatedCurrent)) {
        log('Sniff registered change, reloading accounts...');
        electron_1.ipcRenderer.invoke('accounts:list').then(newList => {
          window.antigravityAccounts = newList.accounts || [];
          window.antigravityCurrentAccount = newList.currentAccountId || '';
          log('Accounts reloaded, current=' + window.antigravityCurrentAccount);
          injectQuotaWidget();
        });
      }
    }).catch(err => {
      window.antigravitySniffingInProgress = false;
      log('Sniff invoke error: ' + err.message);
      console.warn('[preload] Sniff failed:', err);
    });
  }

  let startupSniffInterval;
  function startStartupSniff() {
    const log = (msg) => {
        try {
            electron_1.ipcRenderer.invoke('debug:log', '[preload-startup] ' + msg);
        } catch(e) {}
    };
    log('startStartupSniff initiated');
    let tries = 0;
    startupSniffInterval = setInterval(() => {
      tries++;
      if (window.antigravitySniffingInProgress) return;
      window.antigravitySniffingInProgress = true;
      
      log('Startup sniff try #' + tries);
      electron_1.ipcRenderer.invoke('accounts:sniff').then(sniffRes => {
        window.antigravitySniffingInProgress = false;
        log('Startup sniff try #' + tries + ' response: ' + JSON.stringify(sniffRes));
        if (sniffRes && sniffRes.success) {
          log('Startup sniff succeeded, clearing startup loop.');
          clearInterval(startupSniffInterval);
          
          // Reload list to ensure current account is in sync
          electron_1.ipcRenderer.invoke('accounts:list').then(newList => {
            window.antigravityAccounts = newList.accounts || [];
            window.antigravityCurrentAccount = newList.currentAccountId || '';
            log('Startup accounts synced, current=' + window.antigravityCurrentAccount);
            injectQuotaWidget();
          });
        }
        if (tries >= 15) {
          log('Startup sniff reached maximum tries, clearing.');
          clearInterval(startupSniffInterval);
        }
      }).catch(err => {
        window.antigravitySniffingInProgress = false;
        log('Startup sniff error: ' + err.message);
        if (tries >= 15) {
          clearInterval(startupSniffInterval);
        }
      });
    }, 2000);
  }

  function injectQuickLogin() {
    try {
      const buttons = Array.from(document.querySelectorAll('button'));
      let googleBtn = null;
      for (const btn of buttons) {
        const txt = btn.textContent ? btn.textContent.trim() : '';
        if (txt.includes('Continue with Google') || txt.includes('使用 Google 账号登录')) {
          googleBtn = btn;
          break;
        }
      }
      
      if (!googleBtn) return;
      if (document.getElementById('antigravity-quick-login-container')) return;
      
      const container = googleBtn.parentElement;
      if (!container) return;
      const quickTheme = getNativeThemeColors(container);
      
      const qkContainer = document.createElement('div');
      qkContainer.id = 'antigravity-quick-login-container';
      qkContainer.style.marginTop = '28px';
      qkContainer.style.width = '100%';
      qkContainer.style.display = 'flex';
      qkContainer.style.flexDirection = 'column';
      qkContainer.style.alignItems = 'center';
      qkContainer.style.gap = '10px';
      qkContainer.style.opacity = '0';
      qkContainer.style.transition = 'opacity 0.25s cubic-bezier(0.25, 1, 0.5, 1)';
      
      electron_1.ipcRenderer.invoke('accounts:list').then(res => {
        const accounts = res.accounts || [];
        if (accounts.length === 0) return;
        
        const title = document.createElement('div');
        title.style.fontSize = '12px';
        title.style.fontWeight = '600';
        title.style.color = quickTheme.muted;
        title.style.opacity = '1';
        title.style.marginBottom = '6px';
        title.style.letterSpacing = '1px';
        title.style.textTransform = 'uppercase';
        title.style.userSelect = 'none';
        title.textContent = '— 快捷登录已存账号 —';
        qkContainer.appendChild(title);
        
        accounts.forEach(acc => {
          const btn = document.createElement('div');
          btn.style.width = '260px';
          btn.style.padding = '10px 16px';
          btn.style.borderRadius = '8px';
          btn.style.border = '1px solid ' + quickTheme.border;
          btn.style.background = quickTheme.subtle;
          btn.style.color = quickTheme.foreground;
          btn.style.fontSize = '12.5px';
          btn.style.fontWeight = '500';
          btn.style.cursor = 'pointer';
          btn.style.textAlign = 'center';
          btn.style.boxSizing = 'border-box';
          btn.style.transition = 'all 0.18s cubic-bezier(0.25, 1, 0.5, 1)';
          btn.style.textOverflow = 'ellipsis';
          btn.style.overflow = 'hidden';
          btn.style.whiteSpace = 'nowrap';
          btn.textContent = `${acc.name} (${acc.email})`;
          
          btn.onmouseenter = () => {
            btn.style.background = quickTheme.isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(59, 130, 246, 0.08)';
            btn.style.borderColor = 'rgba(59, 130, 246, 0.4)';
            btn.style.color = quickTheme.accent;
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = quickTheme.isDark ? '0 4px 14px rgba(0, 0, 0, 0.28)' : '0 4px 12px rgba(59, 130, 246, 0.15)';
          };
          btn.onmouseleave = () => {
            btn.style.background = quickTheme.subtle;
            btn.style.borderColor = quickTheme.border;
            btn.style.color = quickTheme.foreground;
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = 'none';
          };
          
          btn.onclick = (e) => {
            e.stopPropagation();
            btn.style.opacity = '0.6';
            btn.style.pointerEvents = 'none';
            btn.textContent = '正在快捷登录并重启...';
            electron_1.ipcRenderer.invoke('accounts:switch', acc.id);
          };
          
          qkContainer.appendChild(btn);
        });
        
        container.appendChild(qkContainer);
        setTimeout(() => { qkContainer.style.opacity = '1'; }, 50);
      }).catch(err => {
        console.error('[preload] Failed to fetch accounts for quick login onboarding:', err);
      });
    } catch (e) {
      console.error('[preload] Quick login UI injection failed:', e);
    }
  }

  function escapeTranslationAuditHtml(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  async function showTranslationAuditPanel() {
    const existing = document.getElementById('antigravity-translation-audit');
    if (existing) {
      existing.remove();
      return;
    }

    await flushMissingTranslations();
    const host = document.createElement('div');
    host.id = 'antigravity-translation-audit';
    host.setAttribute('data-agy-translation-audit', 'true');
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { color-scheme: light dark; }
        .overlay {
          position: fixed; inset: 0; z-index: 1000000; display: grid; place-items: center;
          padding: 24px; box-sizing: border-box; background: rgba(0,0,0,.36);
          font-family: var(--font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
        }
        .dialog {
          width: min(760px, calc(100vw - 32px)); height: min(680px, calc(100vh - 48px));
          display: grid; grid-template-rows: auto auto auto 1fr auto; overflow: hidden;
          border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.28)); border-radius: 8px;
          background: var(--vscode-editor-background, Canvas); color: var(--vscode-editor-foreground, CanvasText);
          box-shadow: 0 18px 54px rgba(0,0,0,.28);
        }
        .header, .toolbar, .footer { display: flex; align-items: center; gap: 8px; padding: 12px 16px; }
        .header { border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,.22)); }
        .title { min-width: 0; flex: 1; }
        h2 { margin: 0; font-size: 16px; font-weight: 600; letter-spacing: 0; }
        .subtitle { margin-top: 3px; color: var(--vscode-descriptionForeground, GrayText); font-size: 11px; }
        button, input { font: inherit; letter-spacing: 0; }
        button {
          min-height: 30px; border: 1px solid var(--vscode-button-border, rgba(127,127,127,.28)); border-radius: 5px;
          padding: 5px 10px; cursor: pointer; color: var(--vscode-button-secondaryForeground, CanvasText);
          background: var(--vscode-button-secondaryBackground, color-mix(in srgb, CanvasText 8%, Canvas));
        }
        button:hover { background: var(--vscode-button-secondaryHoverBackground, color-mix(in srgb, CanvasText 14%, Canvas)); }
        .close { width: 30px; padding: 0; font-size: 20px; line-height: 1; border-color: transparent; background: transparent; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,.18)); }
        .stat { padding: 11px 16px; border-right: 1px solid var(--vscode-widget-border, rgba(127,127,127,.18)); }
        .stat:last-child { border-right: 0; }
        .stat strong { display: block; font-size: 18px; font-weight: 600; }
        .stat span { color: var(--vscode-descriptionForeground, GrayText); font-size: 11px; }
        .toolbar { border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,.18)); }
        .search {
          flex: 1; min-width: 120px; height: 30px; box-sizing: border-box; padding: 5px 9px;
          border: 1px solid var(--vscode-input-border, rgba(127,127,127,.28)); border-radius: 5px;
          background: var(--vscode-input-background, Canvas); color: var(--vscode-input-foreground, CanvasText); outline: none;
        }
        .search:focus { border-color: var(--vscode-focusBorder, #3b82f6); }
        .list { overflow: auto; }
        .row { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,.13)); }
        .row:hover { background: var(--vscode-list-hoverBackground, color-mix(in srgb, CanvasText 5%, Canvas)); }
        .source { font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; user-select: text; }
        .meta { margin-top: 4px; color: var(--vscode-descriptionForeground, GrayText); font-size: 10px; overflow-wrap: anywhere; }
        .count { align-self: start; color: var(--vscode-descriptionForeground, GrayText); font-size: 11px; white-space: nowrap; }
        .empty { padding: 48px 20px; color: var(--vscode-descriptionForeground, GrayText); text-align: center; font-size: 12px; }
        .footer { justify-content: flex-end; border-top: 1px solid var(--vscode-widget-border, rgba(127,127,127,.2)); }
        .status { flex: 1; min-width: 0; color: var(--vscode-descriptionForeground, GrayText); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .danger { color: var(--vscode-errorForeground, #d84848); }
        @media (max-width: 560px) {
          .overlay { padding: 8px; } .dialog { width: 100%; height: calc(100vh - 16px); }
          .toolbar { flex-wrap: wrap; } .search { flex-basis: 100%; } .stats { grid-template-columns: 1fr 1fr 1fr; }
          .stat { padding: 9px; } .stat strong { font-size: 15px; }
        }
      </style>
      <div class="overlay">
        <section class="dialog" role="dialog" aria-modal="true" aria-label="汉化覆盖检查">
          <header class="header">
            <div class="title"><h2>汉化覆盖检查</h2><div class="subtitle">自动收集实际界面中尚未翻译的英文</div></div>
            <button class="close" title="关闭" aria-label="关闭">×</button>
          </header>
          <div class="stats">
            <div class="stat"><strong class="total">--</strong><span>累计漏译</span></div>
            <div class="stat"><strong class="session">--</strong><span>本次发现</span></div>
            <div class="stat"><strong class="coverage">--</strong><span>本次覆盖率</span></div>
          </div>
          <div class="toolbar">
            <input class="search" type="search" placeholder="搜索英文、页面或元素">
            <button class="copy">复制 JSON</button>
            <button class="export">导出</button>
            <button class="clear danger">清空</button>
          </div>
          <div class="list"><div class="empty">正在读取漏译报告...</div></div>
          <footer class="footer"><span class="status"></span><button class="refresh">刷新</button></footer>
        </section>
      </div>`;

    const overlay = root.querySelector('.overlay');
    const list = root.querySelector('.list');
    const search = root.querySelector('.search');
    const status = root.querySelector('.status');
    let items = [];

    const close = () => host.remove();
    root.querySelector('.close').onclick = close;
    overlay.onclick = event => { if (event.target === overlay) close(); };
    host.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });

    function render() {
      const query = search.value.trim().toLowerCase();
      const filtered = query ? items.filter(item =>
        `${item.text} ${item.route} ${item.element} ${item.attribute}`.toLowerCase().includes(query)
      ) : items;
      if (filtered.length === 0) {
        list.innerHTML = `<div class="empty">${items.length ? '没有匹配的漏译' : '暂未发现漏译，继续浏览不同页面即可自动检查'}</div>`;
        return;
      }
      list.innerHTML = filtered.map(item => `
        <div class="row">
          <div><div class="source">${escapeTranslationAuditHtml(item.text)}</div>
          <div class="meta">${escapeTranslationAuditHtml(item.route || '当前页面')} · ${escapeTranslationAuditHtml(item.element || 'element')}.${escapeTranslationAuditHtml(item.attribute || 'textContent')}</div></div>
          <span class="count">出现 ${Number(item.count) || 1} 次</span>
        </div>`).join('');
    }

    // 判定某个文本是否在当前汉化引擎中已被译出（支持精确字典与子串规则Live检测）
    function isTextAlreadyTranslated(text) {
      if (!text) return false;
      const lower = text.toLowerCase().trim();
      if (combinedDict[text] || dictionary[text] || coreWords[text]) return true;
      if (combinedDict[lower] || dictionary[lower] || coreWords[lower]) return true;
      for (const repl of substringReplacements) {
        if (text.includes(repl.search)) return true;
      }
      return false;
    }

    async function load() {
      status.textContent = '正在同步...';
      await flushMissingTranslations();
      const result = await electron_1.ipcRenderer.invoke('translations:get-missing');
      const originalItems = result && Array.isArray(result.items) ? result.items : [];
      
      // 1. 过滤掉所有在当前版本中【已被汉化补全】的词条
      items = originalItems.filter(item => !isTextAlreadyTranslated(item.text));

      // 2. 物理磁盘数据自清洗：如果旧的历史账单里有词条已被我们刚刚翻译了，自动重写存盘剔除它
      if (items.length < originalItems.length) {
        await electron_1.ipcRenderer.invoke('translations:clear-missing');
        if (items.length > 0) {
          await electron_1.ipcRenderer.invoke('translations:record-missing', items);
        }
      }

      const sessionStats = getTranslationAuditSessionStats();
      root.querySelector('.total').textContent = String(items.length);
      root.querySelector('.session').textContent = String(sessionStats.missing);
      root.querySelector('.coverage').textContent = `${sessionStats.coverage}%`;
      const widget = document.getElementById('antigravity-quota-widget');
      const badge = widget && widget.shadowRoot && widget.shadowRoot.querySelector('.translation-audit-badge');
      if (badge) badge.textContent = String(items.length);
      status.textContent = result.path || '';
      render();
    }

    search.oninput = render;
    root.querySelector('.refresh').onclick = load;
    root.querySelector('.copy').onclick = async () => {
      const result = await electron_1.ipcRenderer.invoke('translations:copy-missing');
      status.textContent = result.success ? `已复制 ${result.count} 条漏译` : '复制失败';
    };
    root.querySelector('.export').onclick = async () => {
      const result = await electron_1.ipcRenderer.invoke('translations:export-missing');
      if (result.success) status.textContent = `已导出到 ${result.path}`;
    };
    root.querySelector('.clear').onclick = async () => {
      const confirmed = await showBeautifulConfirm('清空漏译报告', '确定清空目前自动收集的全部漏译记录吗？', '清空', '取消');
      if (!confirmed) return;
      await electron_1.ipcRenderer.invoke('translations:clear-missing');
      translationAuditState.missing.clear();
      translationAuditState.missingSeen.clear();
      await load();
    };

    search.focus();
    load().catch(error => {
      list.innerHTML = `<div class="empty">读取失败：${escapeTranslationAuditHtml(error.message)}</div>`;
    });
  }

  function injectQuotaWidget() {
    try {
      // 1. 异步载入多账号列表并缓存于 window 对象中（增加即时重绘与凭据嗅探）
      if (window.antigravityAccounts === undefined) {
        window.antigravityAccounts = null;
        try {
          electron_1.ipcRenderer.invoke('accounts:list').then(res => {
            window.antigravityAccounts = res.accounts || [];
            window.antigravityCurrentAccount = res.currentAccountId || '';
            // 异步数据一落地，立即强行重绘挂件，彻底消灭 2 秒的显示等待延迟
            injectQuotaWidget();
            startStartupSniff();
          }).catch(err => {
            console.error('[preload] accounts:list invoke failed:', err);
            window.antigravityAccounts = [];
            injectQuotaWidget();
          });
        } catch (e) {
          window.antigravityAccounts = [];
        }
        return;
      } else {
        // runGrpcSniff is called on window focus and on a 30s interval to prevent write race conditions
      }

      const buttons = document.querySelectorAll('button, .sidebar-item, nav [role="button"], a');
      let settingsBtn = null;
      for (let i = 0; i < buttons.length; i++) {
        const el = buttons[i];
        const text = el.textContent ? el.textContent.trim() : '';
        if (text === '设置' || text === 'Settings' || text === 'Global Settings' || text === '全局设置') {
          let cur = el;
          while (cur && cur.parentElement && cur.parentElement.tagName !== 'BODY') {
            if (cur.tagName === 'BUTTON' || cur.getAttribute('role') === 'button' || cur.classList.contains('sidebar-item') || cur.parentElement.tagName === 'NAV') {
              settingsBtn = cur;
              break;
            }
            cur = cur.parentElement;
          }
          if (settingsBtn) break;
        }
      }
      
      if (!settingsBtn) return;

      function readQuotaTheme(anchor) {
        function parseColor(value) {
          if (!value || value === 'transparent') return null;
          const m = value.match(/rgba?\(([^)]+)\)/i);
          if (!m) return null;
          const parts = m[1].split(',').map(v => parseFloat(v.trim()));
          if (parts.length < 3) return null;
          if (parts.length >= 4 && parts[3] === 0) return null;
          return { r: parts[0], g: parts[1], b: parts[2] };
        }

        function findSurfaceColor(start) {
          let cur = start;
          while (cur && cur !== document.documentElement) {
            const bg = parseColor(window.getComputedStyle(cur).backgroundColor);
            if (bg) return bg;
            cur = cur.parentElement;
          }
          return parseColor(window.getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255 };
        }

        function mix(a, b, t) {
          return {
            r: Math.round(a.r + (b.r - a.r) * t),
            g: Math.round(a.g + (b.g - a.g) * t),
            b: Math.round(a.b + (b.b - a.b) * t)
          };
        }

        function rgb(c) {
          return `rgb(${c.r}, ${c.g}, ${c.b})`;
        }

        function rgba(c, a) {
          return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
        }

        function luminance(c) {
          const vals = [c.r, c.g, c.b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          });
          return vals[0] * 0.2126 + vals[1] * 0.7152 + vals[2] * 0.0722;
        }

        const surface = findSurfaceColor(anchor);
        const isDark = luminance(surface) < 0.45;
        const fg = isDark ? { r: 222, g: 226, b: 232 } : { r: 39, g: 43, b: 51 };
        const subtle = isDark ? { r: 170, g: 176, b: 186 } : { r: 92, g: 99, b: 112 };
        const contrast = isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
        const card = mix(surface, contrast, isDark ? 0.08 : 0.035);
        const trigger = mix(surface, contrast, isDark ? 0.14 : 0.055);
        const hover = mix(surface, contrast, isDark ? 0.2 : 0.08);
        const border = rgba(contrast, isDark ? 0.16 : 0.12);
        return {
          fg: rgb(fg),
          muted: rgb(subtle),
          surface: rgb(surface),
          card: rgb(card),
          trigger: rgb(trigger),
          hover: rgb(hover),
          border,
          menuBg: rgb(card),
          menuFg: rgb(fg)
        };
      }
      
      let widget = document.getElementById('antigravity-quota-widget');
      let root = widget ? widget.shadowRoot : null;
      
      if (!widget) {
        widget = document.createElement('div');
        widget.id = 'antigravity-quota-widget';
        widget.style.padding = '0';
        widget.style.margin = '4px 12px 10px 12px';
        widget.style.boxSizing = 'border-box';
        widget.style.background = 'transparent';
        widget.style.border = 'none';
        widget.style.overflow = 'visible';
        
        root = widget.attachShadow({ mode: 'open' });
        
        const style = document.createElement('style');
        style.textContent = `
          :host {
            color-scheme: normal;
            --ag-fg: #272b33;
            --ag-muted-fg: #5c6370;
            --ag-card-bg-base: #ffffff;
            --ag-card-bg: #f6f7f8;
            --ag-trigger-bg: #f0f1f3;
            --ag-menu-bg: #ffffff;
            --ag-menu-fg: #272b33;
            --ag-accent: var(--vscode-textLink-foreground, var(--accent, var(--primary, #3b82f6)));
            --ag-border: rgba(0, 0, 0, 0.12);
            --ag-hover: #eceef1;
            --ag-active: color-mix(in srgb, var(--ag-accent) 14%, transparent);
            --ag-danger: #d84848;
          }
          .widget-card {
            box-sizing: border-box !important;
            padding: 8px 12px !important;
            border-radius: 6px !important;
            font-size: 11px !important;
            font-family: var(--font-family, sans-serif) !important;
            border: 1px solid var(--ag-border) !important;
            background: var(--ag-card-bg) !important;
            color: var(--ag-fg) !important;
            opacity: 0.96 !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 4px !important;
            cursor: pointer !important;
            transition: opacity 0.2s, background 0.2s !important;
            position: relative;
            overflow: visible !important;
          }
          .widget-card:hover {
            opacity: 1 !important;
            background: var(--ag-hover) !important;
          }
          .quota-title {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 4px;
            letter-spacing: 0.5px;
            color: var(--ag-accent);
          }
          .weekly-row, .hourly-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            color: var(--ag-muted-fg);
            margin-bottom: 2px;
            overflow: hidden !important;
          }
          .quota-weekly, .quota-5h {
            font-weight: bold;
            color: var(--ag-fg);
          }
          .accounts-container {
            margin-top: 6px;
            border-top: 1px solid var(--ag-border);
            padding-top: 6px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            position: relative;
            overflow: visible !important;
          }
          .switcher-header {
            font-size: 9px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2px;
            overflow: hidden !important;
          }
          .switcher-title {
            text-transform: uppercase;
            color: var(--ag-muted-fg);
            letter-spacing: 0.5px;
            user-select: none;
          }
          .add-link {
            color: var(--ag-accent);
            cursor: pointer;
            font-weight: bold;
            text-decoration: none;
            transition: color 0.1s;
            user-select: none;
          }
          .add-link:hover {
            filter: brightness(1.05);
          }
          .select-trigger {
            width: 100%;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid var(--ag-border);
            background: var(--ag-trigger-bg);
            color: var(--ag-fg);
            font-size: 10px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            box-sizing: border-box;
            transition: background 0.15s, border-color 0.15s;
            font-family: inherit;
            overflow: hidden !important;
          }
          .select-trigger:hover {
            background: var(--ag-hover) !important;
            border-color: var(--ag-border) !important;
          }
          .trigger-label {
            display: inline-block !important;
            text-overflow: ellipsis !important;
            overflow: hidden !important;
            white-space: nowrap !important;
            max-width: 80% !important;
            box-sizing: border-box !important;
          }
          .arrow-icon {
            font-size: 8px;
            color: var(--ag-muted-fg);
            margin-left: 4px;
            transition: transform 0.25s;
            pointer-events: none;
          }
                    .dropdown-list {
            display: none;
            position: absolute;
            bottom: 26px;
            left: 0;
            right: 0;
            background: var(--vscode-menu-background, var(--vscode-dropdown-background, var(--ag-menu-bg))) !important;
            color: var(--vscode-menu-foreground, var(--vscode-dropdown-foreground, var(--ag-menu-fg))) !important;
            border: 1px solid var(--vscode-menu-border, var(--vscode-dropdown-border, var(--ag-border))) !important;
            border-radius: 6px;
            box-shadow: 0 -8px 24px rgba(0,0,0,0.12);
            z-index: 99999;
            padding: 4px;
            flex-direction: column;
            gap: 2px;
            box-sizing: border-box;
            font-family: inherit;
            max-height: 200px;
            overflow-y: auto;
            overflow-x: hidden;
          }
          .account-item {
            padding: 6px 8px;
            font-size: 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.1s;
            color: var(--vscode-menu-foreground, var(--vscode-dropdown-foreground, var(--ag-menu-fg)));
          }
          .account-item:hover {
            background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground, var(--ag-hover))) !important;
            color: var(--vscode-menu-selectionForeground, var(--vscode-list-hoverForeground, inherit)) !important;
          }
          .account-item.active {
            background: var(--vscode-list-activeSelectionBackground, var(--ag-active)) !important;
            color: var(--vscode-list-activeSelectionForeground, var(--ag-accent)) !important;
            font-weight: bold !important;
          }
          .account-item.active:hover {
            background: var(--vscode-list-activeSelectionBackground, var(--ag-active)) !important;
            opacity: 0.9;
          }
          .delete-btn {
            font-size: 14px;
            color: color-mix(in srgb, var(--ag-danger) 70%, transparent);
            padding: 0 6px;
            cursor: pointer;
            border-radius: 3px;
            font-weight: bold;
            transition: color 0.1s, background 0.1s;
            user-select: none;
          }
          .delete-btn:hover {
            color: var(--ag-danger) !important;
            background: color-mix(in srgb, var(--ag-danger) 12%, transparent) !important;
          }
          .add-new-item {
            padding: 6px 8px;
            font-size: 10px;
            display: flex;
            align-items: center;
            cursor: pointer;
            border-radius: 4px;
            transition: background 0.1s;
            color: var(--ag-accent);
            font-weight: bold;
          }
          .add-new-item:hover {
            background: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground, var(--ag-hover))) !important;
            color: var(--vscode-menu-selectionForeground, var(--vscode-list-hoverForeground, var(--ag-accent))) !important;
          }
          .translation-audit-row {
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
            margin-top: 3px; padding-top: 6px; border-top: 1px solid var(--ag-border);
          }
          .translation-audit-btn {
            display: inline-flex; align-items: center; gap: 5px; min-width: 0; padding: 2px 0;
            border: 0; background: transparent; color: var(--ag-muted-fg); font: inherit;
            font-size: 10px; cursor: pointer;
          }
          .translation-audit-btn:hover { color: var(--ag-accent); }
          .translation-audit-badge {
            min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 8px;
            display: inline-flex; align-items: center; justify-content: center;
            background: var(--ag-active); color: var(--ag-accent); font-size: 9px; font-weight: 600;
          }
        `;
        root.appendChild(style);
        
        const card = document.createElement('div');
        card.className = 'widget-card';
        card.innerHTML = `
          <div class="quota-title"></div>
          <div class="weekly-row">
            <span>每周额度：</span>
            <span class="quota-weekly">--</span>
          </div>
          <div class="hourly-row">
            <span>5H额度：</span>
            <span class="quota-5h">--</span>
          </div>
          <div class="accounts-container"></div>
          <div class="translation-audit-row">
            <button class="translation-audit-btn" type="button" title="查看自动收集的漏译">
              <span>汉化覆盖检查</span><span class="translation-audit-badge">0</span>
            </button>
          </div>
        `;
        root.appendChild(card);

        const auditBtn = root.querySelector('.translation-audit-btn');
        auditBtn.onclick = event => {
          event.stopPropagation();
          showTranslationAuditPanel();
        };
        auditBtn.onmousedown = event => event.stopPropagation();
        electron_1.ipcRenderer.invoke('translations:get-missing').then(result => {
          const badge = root.querySelector('.translation-audit-badge');
          if (badge) badge.textContent = String(result && result.items ? result.items.length : 0);
        }).catch(() => {});
        
        card.onclick = () => {
          settingsBtn.click();
        };
        
        settingsBtn.parentNode.insertBefore(widget, settingsBtn);
      }

      const quotaTheme = readQuotaTheme(settingsBtn);
      widget.style.setProperty('--ag-fg', quotaTheme.fg);
      widget.style.setProperty('--ag-muted-fg', quotaTheme.muted);
      widget.style.setProperty('--ag-card-bg-base', quotaTheme.surface);
      widget.style.setProperty('--ag-card-bg', quotaTheme.card);
      widget.style.setProperty('--ag-trigger-bg', quotaTheme.trigger);
      widget.style.setProperty('--ag-menu-bg', quotaTheme.menuBg);
      widget.style.setProperty('--ag-menu-fg', quotaTheme.menuFg);
      widget.style.setProperty('--ag-border', quotaTheme.border);
      widget.style.setProperty('--ag-hover', quotaTheme.hover);
      
      const gWeekly = localStorage.getItem('quota_gemini_weekly') || '--';
      const g5h = localStorage.getItem('quota_gemini_5h') || '--';
      const cWeekly = localStorage.getItem('quota_claude_weekly') || '--';
      const c5h = localStorage.getItem('quota_claude_5h') || '--';
      
      function getCurrentModel() {
        try {
          const interactives = document.querySelectorAll('button, [role="button"], .select, .trigger, .dropdown, a');
          for (let i = 0; i < interactives.length; i++) {
            const el = interactives[i];

            // 向上查找父级，排除侧边栏和下拉浮窗的干扰
            let isSidebar = false;
            let isDropdownOption = false;
            let p = el.parentElement;
            while (p && p.tagName !== 'BODY') {
              const cl = p.className ? String(p.className).toLowerCase() : '';
              if (cl.includes('sidebar') || cl.includes('history') || cl.includes('project') || cl.includes('activitybar')) {
                isSidebar = true;
                break;
              }
              if (cl.includes('dropdown') || cl.includes('menu') || cl.includes('context') || cl.includes('option') || cl.includes('portal')) {
                isDropdownOption = true;
                break;
              }
              p = p.parentElement;
            }

            if (isSidebar || isDropdownOption) continue;

            const text = el.textContent ? el.textContent.trim() : '';
            const m = text.match(/\b(Gemini|Claude|GPT-OSS|GPT)\b/i);
            if (m) {
              return m[1];
            }
          }
        } catch (e) {}
        return 'Gemini';
      }

      const currentModel = getCurrentModel().toLowerCase();
      const isGemini = currentModel.includes('gemini');

      const titleEl = root.querySelector('.quota-title');
      const weeklyEl = root.querySelector('.quota-weekly');
      const hourlyEl = root.querySelector('.quota-5h');
      const accountsContainer = root.querySelector('.accounts-container');

      // 增量刷新配额文本数值，而不重绘整个 DOM 树
      if (isGemini) {
        if (titleEl.textContent !== 'gemini') {
          titleEl.textContent = 'gemini';
          titleEl.style.color = '#3b82f6';
        }
        if (weeklyEl.textContent !== gWeekly) weeklyEl.textContent = gWeekly;
        if (hourlyEl.textContent !== g5h) hourlyEl.textContent = g5h;
      } else {
        const isGpt = currentModel.includes('gpt');
        const titleText = isGpt ? 'gpt' : 'claude';
        const color = isGpt ? '#f59e0b' : '#10b981';
        if (titleEl.textContent !== titleText) {
          titleEl.textContent = titleText;
          titleEl.style.color = color;
        }
        if (weeklyEl.textContent !== cWeekly) weeklyEl.textContent = cWeekly;
        if (hourlyEl.textContent !== c5h) hourlyEl.textContent = c5h;
      }

      // 仅在 trigger 节点不存在时（或者初始化获取到新账号列表时），才进行账号切换区域 of HTML 构建
      let trigger = accountsContainer.querySelector('#antigravity-account-select-trigger');
      if (!trigger && window.antigravityAccounts && window.antigravityAccounts.length > 0) {
        const currentAcc = window.antigravityAccounts.find(a => a.id === window.antigravityCurrentAccount);
        const triggerLabel = currentAcc ? `${currentAcc.name} (${currentAcc.email})` : '未登录或选择账号';

        accountsContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 4px; position: relative;" onclick="event.stopPropagation();">
            <div class="switcher-header">
              <span class="switcher-title">切换账号</span>
              <span id="antigravity-add-account" class="add-link">添加账号</span>
            </div>
            
            <div id="antigravity-account-select-trigger" class="select-trigger">
              <span class="trigger-label">${triggerLabel}</span>
              <span class="arrow-icon">▼</span>
            </div>

            <div id="antigravity-account-dropdown" class="dropdown-list" style="display: none;">
              <!-- Dropdown items will be dynamically generated -->
            </div>
          </div>
        `;

        trigger = accountsContainer.querySelector('#antigravity-account-select-trigger');
        const dropdown = accountsContainer.querySelector('#antigravity-account-dropdown');
        const arrow = trigger.querySelector('.arrow-icon');

        function renderDropdownItems() {
          const listHtml = window.antigravityAccounts.map(acc => {
            const isCurrent = acc.id === window.antigravityCurrentAccount;
            const activeClass = isCurrent ? 'active' : '';
            return `
              <div class="account-item ${activeClass}" data-id="${acc.id}">
                <span style="display: inline-block !important; text-overflow: ellipsis !important; overflow: hidden !important; white-space: nowrap !important; max-width: 80% !important; pointer-events: none; box-sizing: border-box !important;">
                  ${acc.name} (${acc.email})
                </span>
                <span class="delete-btn" data-id="${acc.id}" title="删除此账号">×</span>
              </div>
            `;
          }).join('') + `
            <div class="add-new-item" data-id="__add_new_account__">
              + 登录新账号...
            </div>
          `;
          
          dropdown.innerHTML = listHtml;

          // Event bindings
          const items = dropdown.querySelectorAll('.account-item, .add-new-item');
          items.forEach(item => {
            const itemId = item.getAttribute('data-id');
            const isCurrent = itemId === window.antigravityCurrentAccount;

            // Click behavior
            item.onclick = (e) => {
              e.stopPropagation();
              dropdown.style.display = 'none';
              arrow.style.transform = 'rotate(0deg)';

              if (itemId === '__add_new_account__') {
                showBeautifulConfirm('登录新账号', '是否要清空当前登录状态并重启客户端以登录新账号？', '确定', '取消').then(confirmed => {
                  if (confirmed) {
                    electron_1.ipcRenderer.invoke('accounts:clear-keyring');
                  }
                });
              } else if (!isCurrent) {
                const triggerLabelEl = trigger.querySelector('.trigger-label');
                if (triggerLabelEl) triggerLabelEl.textContent = '正在切换...';
                trigger.style.opacity = '0.5';
                
                electron_1.ipcRenderer.invoke('accounts:switch', itemId).then(res => {
                  if (!res.success) {
                    alert('切换账号失败: ' + res.error);
                    trigger.style.opacity = '1';
                    injectQuotaWidget();
                  }
                }).catch(err => {
                  alert('切换账号发生错误: ' + err.message);
                  trigger.style.opacity = '1';
                  injectQuotaWidget();
                });
              }
            };

            // Delete button binding
            const delBtn = item.querySelector('.delete-btn');
            if (delBtn) {
              const targetAcc = window.antigravityAccounts.find(a => a.id === itemId);
              delBtn.onclick = (ev) => {
                ev.stopPropagation(); // Avoid triggering switch
                dropdown.style.display = 'none';
                arrow.style.transform = 'rotate(0deg)';

                const deleteMessage = isCurrent
                  ? `确定要删除当前正在使用的账号 ${targetAcc ? targetAcc.email : 'Unknown'} 吗？\\n删除后会清除系统凭据并自动重启客户端。`
                  : `确定要删除账号 ${targetAcc ? targetAcc.email : 'Unknown'} 吗？\\n删除后如需再次使用，必须重新登录。`;
                showBeautifulConfirm('删除账号', deleteMessage, '确定删除', '取消').then(confirmed => {
                  if (confirmed) {
                    electron_1.ipcRenderer.invoke('accounts:delete', itemId).then(res => {
                      if (res.success) {
                        if (res.mustRelaunch) {
                          return;
                        }
                        electron_1.ipcRenderer.invoke('accounts:list').then(newList => {
                          window.antigravityAccounts = newList.accounts || [];
                          window.antigravityCurrentAccount = newList.currentAccountId || '';
                          injectQuotaWidget();
                        });
                      } else {
                        showBeautifulConfirm('错误提示', '删除账号失败: ' + res.error, '好的', '关闭');
                      }
                    });
                  }
                });
              };
            }
          });
        }

        trigger.onclick = (e) => {
          e.stopPropagation();
          const isOpen = dropdown.style.display === 'flex';
          if (isOpen) {
            dropdown.style.display = 'none';
            arrow.style.transform = 'rotate(0deg)';
          } else {
            renderDropdownItems();
            dropdown.style.display = 'flex';
            arrow.style.transform = 'rotate(180deg)';
          }
        };

        // Click outside listener (only bind once globally)
        if (!window.antigravityDropdownListenerAdded) {
          window.antigravityDropdownListenerAdded = true;
          document.addEventListener('click', () => {
            const w = document.getElementById('antigravity-quota-widget');
            if (w && w.shadowRoot) {
              const dp = w.shadowRoot.querySelector('#antigravity-account-dropdown');
              if (dp && dp.style.display === 'flex') {
                dp.style.display = 'none';
                const trg = w.shadowRoot.querySelector('#antigravity-account-select-trigger');
                if (trg) {
                  const arr = trg.querySelector('.arrow-icon');
                  if (arr) arr.style.transform = 'rotate(0deg)';
                }
              }
            }
          });
        }

        // Add Account Button binding
        const addBtn = accountsContainer.querySelector('#antigravity-add-account');
        if (addBtn) {
          addBtn.onclick = (e) => {
            e.stopPropagation();
            addBtn.style.pointerEvents = 'none';
            addBtn.style.opacity = '0.5';
            showBeautifulConfirm('登录新账号', '是否要清空当前登录状态并重启客户端以登录新账号？', '确定', '取消').then(confirmed => {
              if (confirmed) {
                electron_1.ipcRenderer.invoke('accounts:clear-keyring');
              } else {
                addBtn.style.pointerEvents = 'auto';
                addBtn.style.opacity = '1';
              }
            }).catch(err => {
              addBtn.style.pointerEvents = 'auto';
              addBtn.style.opacity = '1';
            });
          };
          addBtn.onmousedown = (e) => e.stopPropagation();
        }
      } else if (trigger) {
        // Alignment trigger value
        const currentAcc = window.antigravityAccounts ? window.antigravityAccounts.find(a => a.id === window.antigravityCurrentAccount) : null;
        const triggerLabelEl = trigger.querySelector('.trigger-label');
        if (triggerLabelEl) {
          const currentText = currentAcc ? `${currentAcc.name} (${currentAcc.email})` : '未登录或选择账号';
          if (triggerLabelEl.textContent.trim() !== currentText) {
            triggerLabelEl.textContent = currentText;
          }
        }
      }

    } catch (e) {
      console.error('Quota widget error:', e);
    }
  }

  // --- Webpage Context Telemetry Injection (ContextIsolation Bypass) ---
  try {
    const spyCode = `
      (function() {
        function logUrl(url, method, responseText) {
          try {
            let cleanText = responseText;
            if (responseText && responseText.length > 2000) {
              cleanText = responseText.substring(0, 2000) + '... (truncated)';
            }
            const logContent = "[" + new Date().toISOString() + "] " + (method || "GET") + " " + url + "\\nResponse: " + cleanText + "\\n\\n";
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog(logContent);
            }
          } catch (e) {}
        }

        function parseAndStoreQuotaJson(json) {
          try {
            function deepSearch(obj) {
              if (!obj || typeof obj !== 'object') return;
              for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                  const val = obj[key];
                  if (key === 'gemini' || key === 'geminiModels' || key.includes('gemini')) {
                    extractGroupQuota(val, 'gemini');
                  } else if (key === 'claude' || key === 'claudeGpt' || key.includes('claude') || key.includes('gpt')) {
                    extractGroupQuota(val, 'claude');
                  } else {
                    deepSearch(val);
                  }
                }
              }
            }

            function extractGroupQuota(groupObj, type) {
              if (!groupObj || typeof groupObj !== 'object') return;
              let weeklyUsed = null;
              let fiveHourUsed = null;
              
              for (const k in groupObj) {
                const sub = groupObj[k];
                if (sub && typeof sub === 'object') {
                  const p = sub.percentUsed !== undefined ? sub.percentUsed : sub.percent_used;
                  if (p !== undefined) {
                    if (k.toLowerCase().includes('week')) {
                      weeklyUsed = p;
                    } else if (k.toLowerCase().includes('five') || k.toLowerCase().includes('5h') || k.toLowerCase().includes('hour')) {
                      fiveHourUsed = p;
                    }
                  }
                }
              }
              
              if (weeklyUsed !== null) {
                const pct = Math.max(0, Math.min(100, Math.round((1 - weeklyUsed) * 100))) + '%';
                localStorage.setItem("quota_" + type + "_weekly", pct);
              }
              if (fiveHourUsed !== null) {
                const pct = Math.max(0, Math.min(100, Math.round((1 - fiveHourUsed) * 100))) + '%';
                localStorage.setItem("quota_" + type + "_5h", pct);
              }
            }

            deepSearch(json);
          } catch (e) {}
        }

        // Fetch Spy
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
          const url = args[0];
          const options = args[1] || {};
          const method = options.method || 'GET';
          const res = await origFetch.apply(this, args);
          try {
            if (typeof url === 'string') {
              const clone = res.clone();
              const text = await clone.text();
              logUrl(url, method, text);
              
              if (text.includes('limit') || text.includes('quota') || text.includes('percentUsed')) {
                try {
                  const json = JSON.parse(text);
                  parseAndStoreQuotaJson(json);
                } catch(e) {}
              }
            }
          } catch (e) {}
          return res;
        };

        // XMLHttpRequest Spy
        const origSend = XMLHttpRequest.prototype.send;
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this._url = url;
          this._method = method;
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[XHR_REQ] url=' + url + ' method=' + method + '\n');
            }
          } catch(e) {}
          return origOpen.apply(this, [method, url, ...args]);
        };
        XMLHttpRequest.prototype.send = function(...args) {
          const self = this;
          this.addEventListener('load', function() {
            try {
              const text = self.responseText;
              logUrl(self._url, self._method, text);
              if (text.includes('limit') || text.includes('quota') || text.includes('percentUsed')) {
                try {
                  const json = JSON.parse(text);
                  parseAndStoreQuotaJson(json);
                } catch(e) {}
              }
            } catch(e) {}
          });
          return origSend.apply(this, args);
        };

        // WebSocket Spy
        const OrigWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[WS_OPEN] url=' + url + '\n');
            }
          } catch(e) {}
          const ws = new OrigWebSocket(url, protocols);
          
          function logWs(direction, data) {
            try {
              let strData = '';
              if (typeof data === 'string') {
                strData = data;
              } else if (data instanceof ArrayBuffer) {
                strData = new TextDecoder('utf-8').decode(data);
              } else if (data instanceof Blob) {
                data.text().then(t => logWs(direction, t));
                return;
              }
              
              if (!strData) return;
              logUrl(url, direction, strData);
              
              if (strData.includes('percentUsed') || strData.includes('Limit') || strData.includes('quota') || strData.includes('weekly')) {
                try {
                  const json = JSON.parse(strData);
                  parseAndStoreQuotaJson(json);
                } catch (e) {}
              }
            } catch(e) {}
          }
          
          ws.addEventListener('message', function(event) {
            logWs('WS_RECV', event.data);
          });
          
          const origSend = ws.send;
          ws.send = function(data) {
            logWs('WS_SEND', data);
            return origSend.apply(ws, arguments);
          };
          
          return ws;
        };
        window.WebSocket.prototype = OrigWebSocket.prototype;

        // EventSource Spy
        const OrigEventSource = window.EventSource;
        window.EventSource = function(url, configuration) {
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[SSE_OPEN] url=' + url + '\n');
            }
          } catch(e) {}
          const es = new OrigEventSource(url, configuration);
          es.addEventListener('message', function(event) {
            logUrl(url, 'SSE_RECV', event.data);
            if (event.data && (event.data.includes('limit') || event.data.includes('quota') || event.data.includes('percentUsed'))) {
              try {
                const json = JSON.parse(event.data);
                parseAndStoreQuotaJson(json);
              } catch(e) {}
            }
          });
          return es;
        };
        window.EventSource.prototype = OrigEventSource.prototype;

        // Fetch Spy
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
          const url = args[0];
          const options = args[1] || {};
          const method = options.method || 'GET';
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[FETCH_REQ] url=' + url + ' method=' + method + '\n');
            }
          } catch(e) {}
          const res = await origFetch.apply(this, args);
          try {
            if (typeof url === 'string') {
              const clone = res.clone();
              const text = await clone.text();
              logUrl(url, method, text);
              
              if (text.includes('limit') || text.includes('quota') || text.includes('percentUsed')) {
                try {
                  const json = JSON.parse(text);
                  parseAndStoreQuotaJson(json);
                } catch(e) {}
              }
            }
          } catch (e) {}
          return res;
        };
      })();
    `;

    electron_1.webFrame.executeJavaScript(spyCode);
  } catch (e) {
    console.error('Network telemetry spy injection failed:', e);
  }

  const setupActivityListeners = () => {
    let lastNotify = 0;
    const notifyActive = () => {
      const now = Date.now();
      // Throttling: only send IPC message once every 3 seconds to avoid IPC flooding
      if (now - lastNotify > 3000) {
        lastNotify = now;
        electron_1.ipcRenderer.send('user-active');
      }
    };

    // User is active if they move mouse, type, or click anywhere in the window
    window.addEventListener('keydown', notifyActive, true);
    window.addEventListener('mousedown', notifyActive, true);
  };

  const setupInstantWidgetRefresh = () => {
    window.addEventListener('click', () => {
      setTimeout(injectQuotaWidget, 100);
    }, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startObserver();
      setupActivityListeners();
      setupInstantWidgetRefresh();
      setInterval(injectQuotaWidget, 2000);
      setInterval(injectQuickLogin, 1000);
      setInterval(runGrpcSniff, 30000);
      window.addEventListener('focus', runGrpcSniff);
      setupVersionUpdater();
    });
  } else {
    startObserver();
    setupActivityListeners();
    setupInstantWidgetRefresh();
    setInterval(injectQuotaWidget, 2000);
    setInterval(injectQuickLogin, 1000);
    setInterval(runGrpcSniff, 30000);
    window.addEventListener('focus', runGrpcSniff);
    setupVersionUpdater();
  }

  function setupVersionUpdater() {
      const CURRENT_VERSION = 'v1.2.4';

      function injectVersionElement() {
          let widget = document.getElementById('antigravity-version-widget');
          if (!widget) {
              const root = document.documentElement || document.body;
              if (!root) return;
              
              widget = document.createElement('div');
              widget.id = 'antigravity-version-widget';
              
              // 悬浮在右上角 window controls 按钮左侧 (右侧偏移量调整为 180px 彻底避免遮挡最小化按钮)
              widget.style.cssText = `
                  position: fixed;
                  top: 8px;
                  right: 180px;
                  z-index: 999999;
                  display: flex;
                  align-items: center;
                  font-size: 11px;
                  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
                  background: transparent;
                  padding: 2px 8px;
                  border-radius: 4px;
                  cursor: default;
                  user-select: none;
                  white-space: nowrap;
                  height: 22px;
                  box-sizing: border-box;
                  pointer-events: auto;
                  -webkit-app-region: no-drag;
                  transition: color 0.3s, border-color 0.3s;
              `;
              
              widget.innerHTML = `
                  <span class="version-label">汉化插件 ${CURRENT_VERSION}</span>
                  <span id="antigravity-patch-update-btn" style="display: none; margin-left: 8px; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; cursor: pointer; transition: all 0.2s;">有新版本</span>
              `;
              
              root.appendChild(widget);
              
              const btn = document.getElementById('antigravity-patch-update-btn');
              if (btn) {
                  btn.onmouseenter = () => {
                      btn.style.transform = 'scale(1.05)';
                      btn.style.background = '#bae6fd';
                  };
                  btn.onmouseleave = () => {
                      btn.style.transform = 'scale(1)';
                      btn.style.background = '#e0f2fe';
                  };
                  btn.onclick = (e) => {
                      e.stopPropagation();
                      handleUpdateClick(btn);
                  };
              }
          }
          
          // 动态颜色自适应：获取主面板前景色与背景色，自适应计算高对比度字色与边框色
          const theme = getNativeThemeColors();
          let fgColor = '';
          
          // 1. 尝试从常见 workbench/titlebar 容器或菜单组件中提取主色
          const targets = [
              document.querySelector('.titlebar'),
              document.querySelector('.window-title'),
              document.querySelector('.monaco-workbench'),
              document.querySelector('.menu-item'),
              document.body
          ];
          for (const el of targets) {
              if (!el) continue;
              const style = getComputedStyle(el);
              const val = style.getPropertyValue('--vscode-titleBar-activeForeground').trim();
              if (val) {
                  fgColor = val;
                  break;
              }
              const color = style.color;
              if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
                  fgColor = color;
                  break;
              }
          }
          
          // 2. 兜底策略：如果获取不到有效的颜色，或者颜色是纯透明/过淡，直接基于主题明暗判定进行黑白反转
          if (!fgColor || fgColor.includes('rgba(255, 255, 255, 0.7)') || fgColor === 'transparent') {
              fgColor = theme.isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(16, 16, 16, 0.85)';
          }
          
          widget.style.color = fgColor;
          widget.style.border = theme.isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)';
      }
      
      let updateUrl = null;
      let downloadUrl = null;
      
      setTimeout(() => {
          // 调用 IPC 到主进程进行无阻碍 GitHub 升级检测 (绕开渲染进程 CSP 限制)
          electron_1.ipcRenderer.invoke('patch:check-update')
              .then(res => {
                  if (res && res.success && res.data) {
                      const data = res.data;
                      if (data.tag_name) {
                          if (isNewerVersion(data.tag_name, CURRENT_VERSION)) {
                              updateUrl = data.html_url;
                              if (data.assets && data.assets.length > 0) {
                                  const updateAsset = data.assets.find(a => a.name && a.name.toLowerCase().includes('update.zip'));
                                  if (updateAsset) {
                                      downloadUrl = updateAsset.browser_download_url;
                                  } else {
                                      downloadUrl = data.assets[0].browser_download_url;
                                  }
                                  
                                  const interval = setInterval(() => {
                                      const btn = document.getElementById('antigravity-patch-update-btn');
                                      if (btn) {
                                          btn.style.display = 'inline-block';
                                          clearInterval(interval);
                                      }
                                  }, 1000);
                              }
                          }
                      }
                  }
              })
              .catch(err => console.error('[preload-update] check failed:', err));
      }, 5000);
      
      function isNewerVersion(latest, current) {
          const lParts = latest.replace(/^v/, '').split('.').map(Number);
          const cParts = current.replace(/^v/, '').split('.').map(Number);
          for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
              const lVal = lParts[i] || 0;
              const cVal = cParts[i] || 0;
              if (lVal > cVal) return true;
              if (lVal < cVal) return false;
          }
          return false;
      }
      
      function handleUpdateClick(btn) {
          if (!downloadUrl) return;
          btn.style.pointerEvents = 'none';
          btn.textContent = '正在下载...';
          btn.style.background = '#fef3c7';
          btn.style.color = '#d97706';
          btn.style.borderColor = '#fde68a';
          
          // 自动替换为国内高速 CDN 镜像节点以防止直连 GitHub 慢
          const acceleratedUrl = downloadUrl.replace('https://github.com/', 'https://ghproxy.net/https://github.com/');
          electron_1.ipcRenderer.invoke('patch:trigger-update', acceleratedUrl).then(res => {
              if (res && res.success) {
                  btn.textContent = '重启生效';
                  btn.style.pointerEvents = 'auto';
                  btn.style.background = '#dcfce7';
                  btn.style.color = '#15803d';
                  btn.style.borderColor = '#bbf7d0';
                  
                  btn.onmouseenter = () => {
                      btn.style.transform = 'scale(1.05)';
                      btn.style.background = '#bbf7d0';
                  };
                  btn.onmouseleave = () => {
                      btn.style.transform = 'scale(1)';
                      btn.style.background = '#dcfce7';
                  };
                  btn.onclick = (e) => {
                      e.stopPropagation();
                      btn.style.pointerEvents = 'none';
                      btn.textContent = '正在重启...';
                      electron_1.ipcRenderer.invoke('patch:restart-app', res.restartScript);
                  };
              } else {
                  btn.textContent = '更新失败';
                  btn.style.background = '#fee2e2';
                  btn.style.color = '#b91c1c';
                  btn.style.borderColor = '#fca5a5';
                  setTimeout(() => {
                      btn.textContent = '有新版本';
                      btn.style.pointerEvents = 'auto';
                      btn.style.background = '#e0f2fe';
                      btn.style.color = '#0369a1';
                      btn.style.borderColor = '#bae6fd';
                  }, 5000);
              }
          }).catch(err => {
              console.error('[preload-update] invoke update error:', err);
              btn.textContent = '网络错误';
              setTimeout(() => {
                  btn.textContent = '有新版本';
                  btn.style.pointerEvents = 'auto';
                  btn.style.background = '#e0f2fe';
                  btn.style.color = '#0369a1';
                  btn.style.borderColor = '#bae6fd';
              }, 5000);
          });
      }
      
      setInterval(injectVersionElement, 2000);
  }

})();

// ==========================================================
// Antigravity Theme Engine - persistent, hot-reloadable skin layer
// ==========================================================
if (false) {
(function AntigravityThemeEngine() {
    const themeIpc = electron_1.ipcRenderer;
    const catalog = [
        { id: 'doraemon', name: '哆啦A梦', file: 'doraemon.jpg', accent: '#38a8e8', overlay: 0.38, position: 'center center' },
        { id: 'shinchan', name: '蜡笔小新', file: 'shinchan.jpg', accent: '#f3bf45', overlay: 0.34, position: 'center center' },
        { id: 'line-dog', name: '线条小狗', file: 'line-dog.jpg', accent: '#72cf78', overlay: 0.28, position: 'center center' },
        { id: 'one-piece', name: '海贼王', file: 'one-piece.jpg', accent: '#e9a63a', overlay: 0.44, position: 'center center' },
        { id: 'fox-spirit', name: '狐妖小红娘', file: 'fox-spirit.jpg', accent: '#d98b86', overlay: 0.30, position: 'center center' }
    ];
    let lastRevision = '';
    let activeImagePath = '';

    function findThemeFile(file) {
        const candidates = [
            themePath.join(assetsDir, file),
            themePath.join(themeOs.homedir(), 'Desktop', 'antigravity换皮', file),
            themePath.join(themeOs.homedir(), 'Desktop', 'antigravity换皮', 'themes', file),
            themePath.join(__dirname, 'themes', file)
        ];
        return candidates.find(candidate => {
            try { return themeFs.existsSync(candidate); } catch (_) { return false; }
        }) || '';
    }

    function readConfig() {
        try {
            const text = themeFs.readFileSync(configFile, 'utf8');
            lastConfigText = text;
            return JSON.parse(text);
        } catch (_) {
            return { version: 1, enabled: false, id: 'native' };
        }
    }

    function writeConfig(theme) {
        themeFs.mkdirSync(assetsDir, { recursive: true });
        let imagePath = findThemeFile(theme.file);
        if (!imagePath) throw new Error(`找不到主题图片：${theme.file}`);
        const stablePath = themePath.join(assetsDir, theme.file);
        if (themePath.resolve(imagePath) !== themePath.resolve(stablePath)) {
            themeFs.copyFileSync(imagePath, stablePath);
            imagePath = stablePath;
        }
        const config = {
            version: 1,
            enabled: true,
            id: theme.id,
            name: theme.name,
            imagePath,
            accent: theme.accent,
            overlay: theme.overlay,
            backgroundPosition: theme.position,
            updatedAt: new Date().toISOString()
        };
        const temp = `${configFile}.tmp`;
        themeFs.writeFileSync(temp, JSON.stringify(config, null, 2), 'utf8');
        themeFs.renameSync(temp, configFile);
        lastConfigText = JSON.stringify(config, null, 2);
        return config;
    }

    function disableTheme() {
        themeFs.mkdirSync(configDir, { recursive: true });
        const config = { version: 1, enabled: false, id: 'native', name: '原生主题', updatedAt: new Date().toISOString() };
        themeFs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
        lastConfigText = JSON.stringify(config, null, 2);
        applyConfig(config);
    }

    function ensureStyle() {
        if (document.getElementById('agy-theme-engine-style')) return;
        const style = document.createElement('style');
        style.id = 'agy-theme-engine-style';
        style.textContent = `
          #agy-theme-wallpaper { position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0; background-size: cover; background-position: var(--agy-theme-position, center); background-repeat: no-repeat; transition: opacity .35s ease; }
          #agy-theme-wallpaper::after { 
            content: ''; 
            position: absolute; 
            inset: 0; 
            background: linear-gradient(115deg, rgba(8,10,15,var(--agy-theme-overlay-dark, 0.26)), rgba(9,11,16,var(--agy-theme-overlay-dark, 0.26)) 52%, rgba(8,10,15,var(--agy-theme-overlay-dark, 0.26)));
            transition: background 0.4s ease;
          }
          /* 空会话状态时：壁纸全清，保持高亮 */
          html.agy-theme-active.agy-chat-empty #agy-theme-wallpaper::after {
            --agy-theme-overlay-dark: 0.16 !important;
          }
          /* 存在对话内容时：壁纸显著淡化变暗，防止晃眼并凸显主文本 */
          html.agy-theme-active:not(.agy-chat-empty) #agy-theme-wallpaper::after {
            --agy-theme-overlay-dark: 0.74 !important;
          }
          html.agy-theme-active #agy-theme-wallpaper { opacity: 1; }
          html.agy-theme-active, html.agy-theme-active body { background: transparent !important; }
          
          /* 核心覆盖：让全局的页面大背景变透明以透出下方的壁纸 */
          html.agy-theme-active [class*="bg-background"],
          html.agy-theme-active [class*="bg-canvas"],
          html.agy-theme-active [class*="bg-base"],
          html.agy-theme-active [class*="bg-slate-"],
          html.agy-theme-active [class*="bg-zinc-"] {
            background-color: transparent !important;
          }
          
          /* 精准适配客户端左右侧边栏毛玻璃磨砂 */
          html.agy-theme-active aside,
          html.agy-theme-active [class*="sidebar"],
          html.agy-theme-active [class*="SideBar"],
          html.agy-theme-active [class*="left-panel"],
          html.agy-theme-active .sidebar {
            background-color: rgba(10, 14, 20, 0.45) !important;
            backdrop-filter: blur(20px) saturate(1.2) !important;
            border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
            transition: background 0.3s ease;
          }
          
          /* 主工作区设为透明以透出背景 */
          html.agy-theme-active main,
          html.agy-theme-active [class*="main-content"],
          html.agy-theme-active [class*="chat-container"],
          html.agy-theme-active [class*="workbench-container"] {
            background-color: transparent !important;
          }
          
          /* 聊天输入框微透明与磨砂 */
          html.agy-theme-active [class*="chat-input-container"],
          html.agy-theme-active [class*="input-area"] {
            background-color: rgba(16, 20, 26, 0.65) !important;
            backdrop-filter: blur(12px) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
          }
          
          /* 弹窗及弹出菜单深度保护防污染隔离 (强制还原实体背景色) */
          html.agy-theme-active [role="dialog"],
          html.agy-theme-active [class*="modal"],
          html.agy-theme-active [class*="dialog"],
          html.agy-theme-active [class*="popup"],
          html.agy-theme-active [class*="popover"],
          html.agy-theme-active .settings-container,
          html.agy-theme-active .settings-panel,
          html.agy-theme-active .dropdown-menu {
            background-color: rgba(16, 20, 25, 0.97) !important;
            backdrop-filter: blur(25px) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6) !important;
            opacity: 1 !important;
          }
          
          /* 核心防护：强制将弹层内部的子项以及设置背景保持可见，防止被上面的全局透明类名污染 */
          html.agy-theme-active [role="dialog"] [class*="bg-background"],
          html.agy-theme-active [class*="modal"] [class*="bg-background"],
          html.agy-theme-active [class*="dialog"] [class*="bg-background"],
          html.agy-theme-active [class*="popup"] [class*="bg-background"],
          html.agy-theme-active [class*="popover"] [class*="bg-background"],
          html.agy-theme-active [role="dialog"] [class*="bg-canvas"],
          html.agy-theme-active [class*="modal"] [class*="bg-canvas"] {
            background-color: rgba(16, 20, 25, 0.97) !important;
          }
          
          html.agy-theme-active [role="dialog"] *,
          html.agy-theme-active [class*="modal"] * {
            text-shadow: none !important;
          }
          
          #agy-theme-switcher { position: fixed; right: 18px; bottom: 28px; z-index: 2147483000; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif; }
          #agy-theme-switcher button { font: inherit; }
          #agy-theme-trigger { width: 38px; height: 38px; border: 1px solid color-mix(in srgb, var(--agy-theme-accent,#76d8e8) 55%, rgba(255,255,255,.2)); border-radius: 12px; color: #f7fbff; background: rgba(17,21,27,.82); box-shadow: 0 8px 26px rgba(0,0,0,.35); backdrop-filter: blur(12px); cursor: pointer; transition: transform .16s ease, background .16s ease; }
          #agy-theme-trigger:hover { transform: translateY(-2px) rotate(-4deg); background: color-mix(in srgb, var(--agy-theme-accent,#76d8e8) 25%, rgba(17,21,27,.9)); }
          #agy-theme-menu { display: none; position: absolute; right: 0; bottom: 48px; width: 210px; padding: 9px; border: 1px solid rgba(255,255,255,.14); border-radius: 14px; background: rgba(16,19,24,.94); box-shadow: 0 18px 46px rgba(0,0,0,.46); backdrop-filter: blur(18px); }
          #agy-theme-switcher.open #agy-theme-menu { display: block; animation: agyThemeIn .16s ease-out; }
          #agy-theme-menu-title { padding: 5px 8px 9px; color: #f2f6f9; font-size: 12px; font-weight: 700; }
          .agy-theme-choice { display: flex; align-items: center; width: 100%; padding: 8px 9px; border: 0; border-radius: 8px; color: #c9d2da; background: transparent; cursor: pointer; text-align: left; font-size: 12px; }
          .agy-theme-choice:hover, .agy-theme-choice.active { color: #fff; background: color-mix(in srgb, var(--choice-accent,#76d8e8) 22%, transparent); }
          .agy-theme-swatch { width: 9px; height: 9px; margin-right: 9px; border-radius: 50%; background: var(--choice-accent,#76d8e8); box-shadow: 0 0 9px color-mix(in srgb, var(--choice-accent,#76d8e8) 70%, transparent); }
          .agy-theme-native { margin-top: 5px; border-top: 1px solid rgba(255,255,255,.08) !important; border-radius: 0 0 8px 8px !important; }
          @keyframes agyThemeIn { from { opacity: 0; transform: translateY(7px) scale(.97); } to { opacity: 1; transform: none; } }
        `;
        document.head.appendChild(style);
    }

    function ensureWallpaper() {
        let wallpaper = document.getElementById('agy-theme-wallpaper');
        if (!wallpaper) {
            wallpaper = document.createElement('div');
            wallpaper.id = 'agy-theme-wallpaper';
            document.body.prepend(wallpaper);
        }
        return wallpaper;
    }

    function fileDataUrl(file) {
        const extension = themePath.extname(file).toLowerCase();
        const mime = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
        return `data:${mime};base64,${themeFs.readFileSync(file).toString('base64')}`;
    }

    function updateChoiceState(themeId) {
        document.querySelectorAll('.agy-theme-choice').forEach(button => button.classList.toggle('active', button.dataset.themeId === themeId));
    }

    function applyConfig(config) {
        if (!document.body) return;
        ensureStyle();
        const wallpaper = ensureWallpaper();
        if (!config || !config.enabled || config.id === 'native') {
            document.documentElement.classList.remove('agy-theme-active');
            wallpaper.style.backgroundImage = '';
            activeImagePath = '';
            updateChoiceState('native');
            return;
        }
        const theme = catalog.find(item => item.id === config.id);
        const imagePath = config.imagePath || config.id;
        if (!config.imageDataUrl) return;
        try {
            if (activeImagePath !== `${imagePath}:${config.revision || ''}`) {
                wallpaper.style.backgroundImage = `url("${config.imageDataUrl}")`;
                activeImagePath = `${imagePath}:${config.revision || ''}`;
            }
            document.documentElement.style.setProperty('--agy-theme-accent', config.accent || theme.accent);
            document.documentElement.style.setProperty('--agy-theme-overlay', String(config.overlay ?? theme.overlay));
            document.documentElement.style.setProperty('--agy-theme-position', config.backgroundPosition || theme.position);
            document.documentElement.classList.add('agy-theme-active');
            document.documentElement.dataset.agyTheme = config.id;
            updateChoiceState(config.id);
        } catch (error) {
            console.warn('[AGY Theme] apply failed:', error);
        }
    }

    function ensureSwitcher() {
        if (document.getElementById('agy-theme-switcher')) return;
        const switcher = document.createElement('div');
        switcher.id = 'agy-theme-switcher';
        const menu = document.createElement('div');
        menu.id = 'agy-theme-menu';
        const title = document.createElement('div');
        title.id = 'agy-theme-menu-title';
        title.textContent = 'Antigravity 主题皮肤';
        menu.appendChild(title);
        for (const theme of catalog) {
            const button = document.createElement('button');
            button.className = 'agy-theme-choice';
            button.dataset.themeId = theme.id;
            button.style.setProperty('--choice-accent', theme.accent);
            button.innerHTML = '<span class="agy-theme-swatch"></span><span></span>';
            button.lastElementChild.textContent = theme.name;
            button.addEventListener('click', async event => {
                event.stopPropagation();
                try {
                    const config = await themeIpc.invoke('agy-theme:set', theme.id);
                    lastRevision = config.revision || '';
                    applyConfig(config);
                } catch (error) { console.warn('[AGY Theme] switch failed:', error); }
                switcher.classList.remove('open');
            });
            menu.appendChild(button);
        }
        const nativeButton = document.createElement('button');
        nativeButton.className = 'agy-theme-choice agy-theme-native';
        nativeButton.dataset.themeId = 'native';
        nativeButton.innerHTML = '<span class="agy-theme-swatch" style="--choice-accent:#9aa4ad"></span><span>恢复原生主题</span>';
        nativeButton.addEventListener('click', async event => {
            event.stopPropagation();
            try {
                const config = await themeIpc.invoke('agy-theme:disable');
                lastRevision = config.revision || '';
                applyConfig(config);
            } catch (error) { console.warn('[AGY Theme] disable failed:', error); }
            switcher.classList.remove('open');
        });
        menu.appendChild(nativeButton);
        const trigger = document.createElement('button');
        trigger.id = 'agy-theme-trigger';
        trigger.type = 'button';
        trigger.title = '切换主题皮肤';
        trigger.setAttribute('aria-label', '切换主题皮肤');
        trigger.textContent = '✦';
        trigger.addEventListener('click', event => { event.stopPropagation(); switcher.classList.toggle('open'); });
        switcher.append(menu, trigger);
        document.body.appendChild(switcher);
        document.addEventListener('click', () => switcher.classList.remove('open'));
    }

    async function refreshTheme() {
        try {
            const config = await themeIpc.invoke('agy-theme:get', lastRevision);
            if (!config || config.unchanged) return;
            lastRevision = config.revision || '';
            applyConfig(config);
        } catch (error) {
            console.warn('[AGY Theme] refresh failed:', error);
        }
    }

    function detectChatState() {
        if (!document.body) return;
        // 精准识别是否存在消息泡泡、对话项等代表进入聊天的节点
        const hasMessages = document.querySelector('[class*="message-bubble"], [class*="chat-bubble"], [class*="message-item"], [class*="talk-bubble"], .bubble, .message') !== null;
        document.documentElement.classList.toggle('agy-chat-empty', !hasMessages);
    }

    function start() {
        ensureStyle();
        ensureSwitcher();
        refreshTheme();
        setInterval(refreshTheme, 900);
        
        // 挂载聊天明暗自适应轮询
        detectChatState();
        setInterval(detectChatState, 600);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
}

// ==========================================================
// Antigravity Theme Engine V2 - state aware semantic theming
// ==========================================================
(function AntigravityThemeEngineV2() {
    const themeIpc = electron_1.ipcRenderer;
    const catalog = [
        {
            id: 'doraemon', name: '哆啦A梦', accent: '#3ba5fc', accentSoft: '#d8f2fb',
            warm: '#fff1c7', app: '#edf8f8', sidebar: 'rgba(233,247,247,.91)', content: 'rgba(248,252,250,.90)',
            dialog: 'rgba(250,253,252,.985)', input: 'rgba(255,255,255,.965)', text: '#17313a',
            muted: '#526d73', border: 'rgba(59,165,252,.20)', shadow: 'rgba(21,81,103,.18)', position: 'center center'
        },
        {
            id: 'shinchan', name: '蜡笔小新', accent: '#fbd160', accentSoft: '#fff0d0',
            warm: '#ffe6a8', app: '#f3f9ec', sidebar: 'rgba(243,249,235,.90)', content: 'rgba(250,253,246,.90)',
            dialog: 'rgba(253,254,250,.985)', input: 'rgba(255,255,252,.965)', text: '#283b36',
            muted: '#5f746c', border: 'rgba(251,209,96,.20)', shadow: 'rgba(38,76,56,.17)', position: 'center center'
        },
        {
            id: 'line-dog', name: '线条小狗', accent: '#52c49c', accentSoft: '#dff6e6',
            warm: '#fff3cf', app: '#eef9f4', sidebar: 'rgba(238,249,244,.91)', content: 'rgba(250,253,251,.90)',
            dialog: 'rgba(251,254,252,.988)', input: 'rgba(255,255,255,.97)', text: '#1f3932',
            muted: '#5a746c', border: 'rgba(82,196,156,.19)', shadow: 'rgba(27,91,69,.16)', position: 'center center'
        },
        {
            id: 'one-piece', name: '海贼王', accent: '#fca240', accentSoft: '#fff0cf',
            warm: '#ffe0a0', app: '#fbf3e5', sidebar: 'rgba(250,241,223,.91)', content: 'rgba(255,251,243,.91)',
            dialog: 'rgba(255,252,247,.988)', input: 'rgba(255,253,249,.97)', text: '#3d3026',
            muted: '#77665a', border: 'rgba(252,162,64,.22)', shadow: 'rgba(94,54,25,.18)', position: 'center center'
        },
        {
            id: 'fox-spirit', name: '狐妖小红娘', accent: '#f06c8b', accentSoft: '#fbe5e7',
            warm: '#ffe4bd', app: '#faf2f1', sidebar: 'rgba(249,239,238,.92)', content: 'rgba(254,249,248,.91)',
            dialog: 'rgba(255,251,250,.99)', input: 'rgba(255,252,251,.97)', text: '#442d32',
            muted: '#7b6066', border: 'rgba(240,108,139,.21)', shadow: 'rgba(92,42,50,.18)', position: 'center center'
        }
    ];
    let lastRevision = '';
    let activeImageKey = '';
    let semanticTimer = 0;
    let observer = null;

    function ensureStyle() {
        if (document.getElementById('agy-theme-engine-v2-style')) return;
        const style = document.createElement('style');
        style.id = 'agy-theme-engine-v2-style';
        style.textContent = `
          :root {
            --agy-accent: #319b73;
            --agy-accent-soft: #dff6e6;
            --agy-warm: #fff3cf;
            --agy-app: #eef9f4;
            --agy-sidebar: rgba(238,249,244,.91);
            --agy-content: rgba(250,253,251,.945);
            --agy-dialog: rgba(251,254,252,.988);
            --agy-input: rgba(255,255,255,.97);
            --agy-text: #1f3932;
            --agy-muted: #5a746c;
            --agy-border: rgba(49,155,115,.19);
            --agy-shadow: rgba(27,91,69,.16);
            --agy-wallpaper-position: center center;
          }
          #agy-theme-wallpaper-v2 {
            position: fixed;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            opacity: 0;
            background-size: cover;
            background-position: var(--agy-wallpaper-position);
            background-repeat: no-repeat;
            transition: opacity .3s ease, filter .3s ease;
          }
          #agy-theme-wallpaper-v2::after {
            content: '';
            position: absolute;
            inset: 0;
            background: linear-gradient(105deg, rgba(246,250,248,.22) 0%, rgba(248,251,249,.08) 48%, rgba(250,252,250,.14) 100%);
            transition: background .3s ease;
          }
          html.agy-theme-active-v2 #root { position: relative; z-index: 1; }
          html.agy-theme-active-v2 #agy-theme-wallpaper-v2 { opacity: 1; }
          html.agy-theme-active-v2,
          html.agy-theme-active-v2 body,
          html.agy-theme-active-v2 [data-agy-surface="app"] { background: transparent !important; }
          html.agy-theme-active-v2,
          html.agy-theme-active-v2 body {
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            overflow: hidden !important;
          }

          html.agy-theme-active-v2[data-agy-view="new-chat"] #agy-theme-wallpaper-v2 { opacity: .96; filter: saturate(.98) brightness(1.01); }
          html.agy-theme-active-v2[data-agy-view="new-chat"] #agy-theme-wallpaper-v2::after {
            background: linear-gradient(105deg, rgba(249,252,250,.18) 0%, rgba(250,252,251,.03) 48%, rgba(250,252,251,.08) 100%);
          }
          html.agy-theme-active-v2[data-agy-view="conversation"] #agy-theme-wallpaper-v2 { opacity: .64; filter: saturate(.86) brightness(1.015); }
          html.agy-theme-active-v2[data-agy-view="conversation"] #agy-theme-wallpaper-v2::after { background: rgba(250,252,250,.10); }
          html.agy-theme-active-v2[data-agy-view="settings"] #agy-theme-wallpaper-v2 { opacity: .07; filter: saturate(.45) brightness(1.08); }
          html.agy-theme-active-v2[data-agy-view="settings"] #agy-theme-wallpaper-v2::after { background: rgba(250,252,250,.82); }
          html.agy-theme-active-v2[data-agy-view="review"] #agy-theme-wallpaper-v2 { opacity: .60; filter: saturate(.83) brightness(1.02); }
          html.agy-theme-active-v2[data-agy-view="review"] #agy-theme-wallpaper-v2::after { background: rgba(250,252,250,.12); }

          html.agy-theme-active-v2 [data-agy-surface="sidebar"] {
            color: var(--agy-text) !important;
            background: linear-gradient(155deg,
              color-mix(in srgb, var(--agy-warm) 74%, transparent) 0%,
              color-mix(in srgb, var(--agy-accent-soft) 68%, transparent) 46%,
              color-mix(in srgb, var(--agy-sidebar) 70%, transparent) 100%) !important;
            border-right: 1px solid var(--agy-border) !important;
            
            /* 霓虹发光光晕精准定位在最左侧外界边框 */
            border-left: 2.5px solid var(--agy-accent) !important;
            box-shadow: -10px 0 30px color-mix(in srgb, var(--agy-shadow) 42%, transparent) !important;
            
            backdrop-filter: blur(24px) saturate(1.12);
            transition: background .28s ease, backdrop-filter .28s ease, box-shadow .28s ease, border-color .28s ease;
          }
          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-surface="sidebar"] {
            background: linear-gradient(90deg,
              color-mix(in srgb, var(--agy-warm) 18%, transparent) 0%,
              color-mix(in srgb, var(--agy-accent-soft) 12%, transparent) 70%,
              color-mix(in srgb, var(--agy-accent) 22%, transparent) 100%) !important;
            border-left: 2.5px solid var(--agy-accent) !important;
            border-right: 1px solid var(--agy-border) !important;
            
            /* 物理镜像：内阴影改从左侧投射，外阴影改向最左侧屏幕外发光 */
            box-shadow: inset 14px 0 24px color-mix(in srgb, var(--agy-accent-soft) 46%, transparent),
              -8px 0 28px color-mix(in srgb, var(--agy-shadow) 34%, transparent) !important;
            backdrop-filter: blur(2px) saturate(.96);
          }
          html.agy-theme-active-v2[data-agy-view="conversation"] [data-agy-surface="sidebar"],
          html.agy-theme-active-v2[data-agy-view="review"] [data-agy-surface="sidebar"] {
            background: linear-gradient(90deg,
              color-mix(in srgb, var(--agy-warm) 18%, transparent) 0%,
              color-mix(in srgb, var(--agy-accent-soft) 12%, transparent) 70%,
              color-mix(in srgb, var(--agy-accent) 22%, transparent) 100%) !important;
            border-left: 2.5px solid var(--agy-accent) !important;
            border-right: 1px solid var(--agy-border) !important;
            
            /* 物理镜像：内阴影改从左侧投射，外阴影改向最左侧屏幕外发光 */
            box-shadow: inset 14px 0 24px color-mix(in srgb, var(--agy-accent-soft) 46%, transparent),
              -8px 0 28px color-mix(in srgb, var(--agy-shadow) 34%, transparent) !important;
            backdrop-filter: blur(2px) saturate(.96);
          }
          html.agy-theme-active-v2 [data-agy-surface="main"] {
            color: var(--agy-text) !important;
            transition: background .25s ease, box-shadow .25s ease;
          }
          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-surface="main"] { background: transparent !important; }
          html.agy-theme-active-v2[data-agy-view="conversation"] [data-agy-surface="main"],
          html.agy-theme-active-v2[data-agy-view="review"] [data-agy-surface="main"] {
            background: linear-gradient(105deg,
              color-mix(in srgb, var(--agy-content) 66%, transparent) 0%,
              color-mix(in srgb, var(--agy-content) 56%, transparent) 52%,
              color-mix(in srgb, var(--agy-warm) 44%, transparent) 100%) !important;
            box-shadow: inset 1px 0 0 color-mix(in srgb, var(--agy-border) 65%, transparent);
            backdrop-filter: blur(1px) saturate(.96);
          }

          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="text-foreground"],
          html.agy-theme-active-v2 [data-agy-surface="main"] [class~="text-foreground"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="text-foreground"],
          html.agy-theme-active-v2 [data-agy-component="popover"] [class~="text-foreground"] { color: var(--agy-text) !important; }
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="text-secondary-foreground"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="text-muted-foreground"],
          html.agy-theme-active-v2 [data-agy-surface="main"] [class~="text-secondary-foreground"],
          html.agy-theme-active-v2 [data-agy-surface="main"] [class~="text-muted-foreground"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="text-secondary-foreground"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="text-muted-foreground"] { color: var(--agy-muted) !important; }

          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="bg-card"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="bg-secondary"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class~="bg-muted"] {
            background-color: color-mix(in srgb, var(--agy-accent-soft) 62%, white) !important;
          }
          
          /* 侧边栏当前激活态/选中态对话卡片的专属定制高亮 */
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-active="true"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-state="active"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [aria-selected="true"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-agy-active="true"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] a[class*="active"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] button[class*="active"] {
            background-color: var(--agy-accent) !important;
            color: var(--agy-text) !important;
            font-weight: 600 !important;
            box-shadow: 0 4px 14px color-mix(in srgb, var(--agy-accent) 45%, transparent) !important;
          }
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-active="true"] *,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-state="active"] *,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [aria-selected="true"] *,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [data-agy-active="true"] *,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] a[class*="active"] *,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] button[class*="active"] * {
            color: var(--agy-text) !important;
          }

          /* 账号每周限额面板卡片的专属定制磨砂与描边 */
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class*="card"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class*="Card"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class*="profile"],
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [class*="account"] {
            background-color: color-mix(in srgb, var(--agy-input) 32%, rgba(255, 255, 255, 0.04)) !important;
            border: 1.5px solid color-mix(in srgb, var(--agy-accent) 42%, rgba(255, 255, 255, 0.08)) !important;
            box-shadow: 0 8px 24px color-mix(in srgb, var(--agy-shadow) 20%, transparent) !important;
            backdrop-filter: blur(16px) !important;
          }

          /* 免费额度进度条及数值的主题皮肤定制 */
          html.agy-theme-active-v2 [data-agy-component="quota-item"] {
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="quota-progress"] {
            background-color: color-mix(in srgb, var(--agy-accent) 15%, rgba(255, 255, 255, 0.08)) !important;
            height: 6px !important;
            border-radius: 9999px !important;
            overflow: hidden !important;
          }
          html.agy-theme-active-v2 [data-agy-component="quota-progress-indicator"],
          html.agy-theme-active-v2 [data-agy-component="quota-progress"] [class*="indicator"],
          html.agy-theme-active-v2 [data-agy-component="quota-progress"] div {
            background-color: var(--agy-accent) !important;
            box-shadow: 0 0 8px var(--agy-accent) !important;
          }

          html.agy-theme-active-v2 [data-agy-surface="sidebar"] button:hover,
          html.agy-theme-active-v2 [data-agy-surface="sidebar"] [role="button"]:hover {
            background-color: color-mix(in srgb, var(--agy-accent-soft) 78%, transparent) !important;
            color: var(--agy-text) !important;
          }

          /* 模型选择器解放宽度限制并彻底清除省略号，确保完整看清模型名称 */
          html.agy-theme-active-v2 [data-agy-component="model-picker"],
          html.agy-theme-active-v2 [data-agy-component="model-picker"] *,
          html.agy-theme-active-v2 [class*="model-picker"],
          html.agy-theme-active-v2 [class*="model-picker"] *,
          html.agy-theme-active-v2 [class*="ModelPicker"] * {
            max-width: none !important;
            width: auto !important;
            min-width: fit-content !important;
            white-space: nowrap !important;
            overflow: visible !important;
            text-overflow: clip !important;
          }

          html.agy-theme-active-v2 [data-agy-component="composer"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-input) 82%, transparent) !important;
            border: 1px solid color-mix(in srgb, var(--agy-accent) 32%, transparent) !important;
            
            /* 输入框左侧霓虹流光 */
            border-left: 3px solid var(--agy-accent) !important;
            
            box-shadow: 0 14px 38px color-mix(in srgb, var(--agy-shadow) 72%, transparent), 0 2px 8px rgba(0,0,0,.04) !important;
            backdrop-filter: blur(22px) saturate(1.08);
            transition: background .24s ease, border-color .24s ease, box-shadow .24s ease;
          }
          
          /* 输入框最右侧发送/停止按钮圆形自适应定制 */
          html.agy-theme-active-v2 [data-agy-component="composer"] button[type="submit"],
          html.agy-theme-active-v2 [data-agy-component="composer"] button[class*="bg-primary"],
          html.agy-theme-active-v2 [data-agy-component="composer"] [class*="composer-send-button"],
          html.agy-theme-active-v2 [data-agy-component="composer"] button:last-child {
            background-color: var(--agy-accent) !important;
            color: var(--agy-text) !important;
            border-radius: 9999px !important;
            width: 32px !important;
            height: 32px !important;
            padding: 0 !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 4px 10px color-mix(in srgb, var(--agy-accent) 50%, transparent) !important;
            transition: all 0.2s ease !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer"] button[type="submit"] *,
          html.agy-theme-active-v2 [data-agy-component="composer"] button[class*="bg-primary"] *,
          html.agy-theme-active-v2 [data-agy-component="composer"] [class*="composer-send-button"] *,
          html.agy-theme-active-v2 [data-agy-component="composer"] button:last-child * {
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer"] button[type="submit"]:hover,
          html.agy-theme-active-v2 [data-agy-component="composer"] button[class*="bg-primary"]:hover,
          html.agy-theme-active-v2 [data-agy-component="composer"] button:last-child:hover {
            transform: scale(1.08) !important;
            background-color: var(--agy-accent) !important;
            box-shadow: 0 6px 14px color-mix(in srgb, var(--agy-accent) 65%, transparent) !important;
          }

          /* 模型列表下拉弹出窗的高档描边定制 */
          html.agy-theme-active-v2 [data-agy-component="popover"],
          html.agy-theme-active-v2 [data-agy-component="dropdown"],
          html.agy-theme-active-v2 [class*="model-picker-menu"],
          html.agy-theme-active-v2 .dropdown-menu {
            background-color: color-mix(in srgb, var(--agy-input) 88%, rgba(10, 14, 20, 0.96)) !important;
            border: 1.5px solid var(--agy-accent) !important;
            box-shadow: 0 12px 32px color-mix(in srgb, var(--agy-shadow) 52%, transparent) !important;
            backdrop-filter: blur(20px) !important;
          }
          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-component="composer"] {
            background: linear-gradient(110deg,
              color-mix(in srgb, var(--agy-input) 76%, transparent) 0%,
              color-mix(in srgb, var(--agy-input) 72%, transparent) 58%,
              color-mix(in srgb, var(--agy-warm) 62%, transparent) 100%) !important;
            border-color: color-mix(in srgb, var(--agy-accent) 48%, transparent) !important;
            box-shadow: 0 16px 44px color-mix(in srgb, var(--agy-shadow) 60%, transparent), 0 2px 12px rgba(255,255,255,.32) inset !important;
            backdrop-filter: blur(24px) saturate(1.06);
          }
          html.agy-theme-active-v2[data-agy-view="conversation"] [data-agy-component="composer"],
          html.agy-theme-active-v2[data-agy-view="review"] [data-agy-component="composer"] {
            background: color-mix(in srgb, var(--agy-input) 86%, transparent) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer-inner"] {
            background: transparent !important;
            color: var(--agy-text) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer"] button,
          html.agy-theme-active-v2 [data-agy-component="model-picker"] {
            color: var(--agy-muted) !important;
            background: transparent !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer"] button:hover,
          html.agy-theme-active-v2 [data-agy-component="model-picker"]:hover {
            color: var(--agy-text) !important;
            background: var(--agy-accent-soft) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="composer"]:focus-within {
            border-color: color-mix(in srgb, var(--agy-accent) 65%, transparent) !important;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--agy-accent) 14%, transparent), 0 16px 42px var(--agy-shadow) !important;
          }

          html.agy-theme-active-v2 [data-agy-component="settings-backdrop"] {
            background: rgba(26,32,31,.32) !important;
            backdrop-filter: blur(7px) saturate(.75);
          }
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] {
            color: var(--agy-text) !important;
            background: var(--agy-dialog) !important;
            border: 1px solid color-mix(in srgb, var(--agy-accent) 24%, transparent) !important;
            box-shadow: 0 30px 90px rgba(18,27,25,.30), 0 4px 14px rgba(18,27,25,.10) !important;
            opacity: 1 !important;
            backdrop-filter: none !important;
          }
          html.agy-theme-active-v2 [data-agy-component="settings-sidebar"] {
            background: color-mix(in srgb, var(--agy-accent-soft) 38%, var(--agy-dialog)) !important;
            border-right: 1px solid var(--agy-border) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="bg-background"] { background: var(--agy-dialog) !important; }
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="bg-secondary"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="bg-card"],
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] [class~="bg-muted"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-accent-soft) 48%, white) !important;
          }
          html.agy-theme-active-v2 [data-agy-component="settings-dialog"] button:hover {
            color: var(--agy-text) !important;
            background-color: color-mix(in srgb, var(--agy-accent-soft) 74%, white) !important;
          }

          html.agy-theme-active-v2 [data-agy-component="popover"] {
            color: var(--agy-text) !important;
            background: var(--agy-dialog) !important;
            border: 1px solid var(--agy-border) !important;
            box-shadow: 0 18px 48px var(--agy-shadow), 0 3px 10px rgba(0,0,0,.08) !important;
            opacity: 1 !important;
            backdrop-filter: none !important;
          }
          html.agy-theme-active-v2 [data-agy-component="popover"] [class~="bg-secondary"],
          html.agy-theme-active-v2 [data-agy-component="popover"] button:hover,
          html.agy-theme-active-v2 [data-agy-component="popover"] [role="option"]:hover {
            color: var(--agy-text) !important;
            background: var(--agy-accent-soft) !important;
          }

          html.agy-theme-active-v2 [data-agy-component="agent-message"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-dialog) 74%, transparent);
            border: 1px solid color-mix(in srgb, var(--agy-border) 66%, transparent);
            border-radius: 16px;
            padding: 8px 10px;
            box-shadow: 0 5px 18px color-mix(in srgb, var(--agy-shadow) 32%, transparent);
          }
          html.agy-theme-active-v2 [data-agy-component="semantic-card"] {
            color: var(--agy-text) !important;
            background: color-mix(in srgb, var(--agy-dialog) 94%, var(--agy-accent-soft)) !important;
            border-color: var(--agy-border) !important;
            box-shadow: 0 6px 20px color-mix(in srgb, var(--agy-shadow) 28%, transparent);
          }
          html.agy-theme-active-v2 [data-agy-component="review-card"] {
            border-left: 3px solid var(--agy-accent) !important;
            background: color-mix(in srgb, var(--agy-accent-soft) 42%, var(--agy-dialog)) !important;
          }

          html.agy-theme-active-v2 *:focus-visible {
            outline: 2px solid color-mix(in srgb, var(--agy-accent) 74%, white) !important;
            outline-offset: 2px !important;
          }
          html.agy-theme-active-v2 [class~="border-border"] { border-color: var(--agy-border) !important; }
          html.agy-theme-active-v2 ::selection { background: color-mix(in srgb, var(--agy-accent) 28%, transparent); }

          #agy-theme-switcher-v2 { position: fixed; right: 18px; bottom: 24px; z-index: 2147483000; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif; }
          #agy-theme-switcher-v2 button { font: inherit; }
          #agy-theme-trigger-v2 { width: 42px; height: 42px; border: 1px solid color-mix(in srgb, var(--agy-accent) 46%, white); border-radius: 14px; color: var(--agy-text); background: var(--agy-dialog); box-shadow: 0 10px 30px var(--agy-shadow); cursor: pointer; transition: transform .16s ease, background .16s ease; }
          #agy-theme-trigger-v2:hover { transform: translateY(-2px) rotate(-3deg); background: var(--agy-accent-soft); }
          #agy-theme-menu-v2 { display: none; position: absolute; right: 0; bottom: 52px; width: 226px; padding: 10px; border: 1px solid var(--agy-border); border-radius: 16px; color: var(--agy-text); background: var(--agy-dialog); box-shadow: 0 22px 58px var(--agy-shadow); }
          #agy-theme-switcher-v2.open #agy-theme-menu-v2 { display: block; animation: agyThemeV2In .16s ease-out; }
          #agy-theme-menu-v2 strong { display: block; padding: 5px 8px 9px; font-size: 12px; }
          .agy-theme-v2-choice { display: flex; align-items: center; width: 100%; gap: 9px; padding: 9px; border: 0; border-radius: 10px; color: var(--agy-muted); background: transparent; cursor: pointer; text-align: left; font-size: 12px; }
          .agy-theme-v2-choice:hover, .agy-theme-v2-choice.active { color: var(--agy-text); background: var(--agy-accent-soft); }
          .agy-theme-v2-swatch { width: 10px; height: 10px; border-radius: 50%; background: var(--choice-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--choice-accent) 18%, transparent); }
          .agy-theme-v2-native { margin-top: 5px; border-top: 1px solid var(--agy-border); border-radius: 0 0 10px 10px; }
          @keyframes agyThemeV2In { from { opacity: 0; transform: translateY(7px) scale(.97); } to { opacity: 1; transform: none; } }
          @media (prefers-reduced-motion: reduce) { #agy-theme-wallpaper-v2, #agy-theme-switcher-v2 * { transition: none !important; animation: none !important; } }
        `;
        document.head.appendChild(style);
    }

    function ensureWallpaper() {
        let wallpaper = document.getElementById('agy-theme-wallpaper-v2');
        if (!wallpaper) {
            wallpaper = document.createElement('div');
            wallpaper.id = 'agy-theme-wallpaper-v2';
            document.body.prepend(wallpaper);
        }
        return wallpaper;
    }

    function visible(element) {
        if (!element || !element.isConnected) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }

    function compactText(element) {
        return String(element && (element.innerText || element.textContent) || '').replace(/\s+/g, ' ').trim();
    }

    function mark(element, key, value) {
        if (!element) return;
        const attribute = `data-agy-${key}`;
        if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
    }

    function ancestorMatching(start, predicate, limit = 18) {
        let current = start;
        for (let index = 0; current && index < limit; index += 1, current = current.parentElement) {
            if (predicate(current)) return current;
        }
        return null;
    }

    function detectView() {
        const settings = document.querySelector('.settings-modal-container');
        if (visible(settings)) return 'settings';
        const reviewText = Array.from(document.querySelectorAll('button')).filter(visible).map(compactText).join(' ');
        if (/审核|批准|拒绝|Approve|Reject/.test(reviewText) && document.querySelector('[role="article"]')) return 'review';
        if (/^\/c\//.test(location.pathname) || document.querySelector('[role="article"][aria="Agent response"]')) return 'conversation';
        return 'new-chat';
    }

    function annotateSemanticDom() {
        if (!document.body) return;
        const view = detectView();
        if (document.documentElement.dataset.agyView !== view) document.documentElement.dataset.agyView = view;

        const app = Array.from(document.querySelectorAll('#root *')).find(element => {
            const className = String(element.className || '');
            return className.includes('h-screen') && className.includes('w-screen') && className.includes('bg-background');
        });
        mark(app, 'surface', 'app');

        const newChatButton = Array.from(document.querySelectorAll('button')).find(element => {
            const text = compactText(element);
            return (text === '新建对话' || text === 'New Project' || text === 'New chat' || text === '新建项目') && element.getBoundingClientRect().x < 260;
        });
        const sidebarCandidates = [];
        for (let current = newChatButton; current; current = current.parentElement) {
            const rect = current.getBoundingClientRect();
            if (rect.x <= 2 && rect.width >= 210 && rect.width <= 280 && rect.height > innerHeight * .72) sidebarCandidates.push(current);
        }
        let sidebar = sidebarCandidates.sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height)[0];
        if (!sidebar) {
            /* 极致兜底：如果按钮推演失败，直接根据 aside 或 sidebar 关键字寻找可见大容器 */
            sidebar = document.querySelector('aside') || 
                      Array.from(document.querySelectorAll('div')).find(el => {
                          const rect = el.getBoundingClientRect();
                          const className = String(el.className || '').toLowerCase();
                          return (className.includes('sidebar') || className.includes('left-panel') || className.includes('sidebarcandidates')) && 
                                 rect.width >= 210 && rect.width <= 280 && rect.height > innerHeight * 0.72 && visible(el);
                      });
        }
        mark(sidebar, 'surface', 'sidebar');

        const composer = document.getElementById('antigravity.agentSidePanelInputBox');
        mark(composer, 'component', 'composer');
        if (composer) {
            const inner = Array.from(composer.children).find(child => String(child.className || '').includes('bg-card')) || composer.firstElementChild;
            mark(inner, 'component', 'composer-inner');
            const modelPicker = composer.querySelector('[aria-label*="选择模型"], [aria-label*="Select model"]');
            mark(modelPicker, 'component', 'model-picker');
            const main = ancestorMatching(composer, element => {
                const rect = element.getBoundingClientRect();
                const className = String(element.className || '');
                return rect.width > innerWidth * .62 && rect.height > innerHeight * .75 && className.includes('flex-1') && className.includes('flex-col') && className.includes('min-w-0');
            });
            mark(main, 'surface', 'main');
            const hero = ancestorMatching(composer, element => String(element.className || '').includes('pt-[30vh]'));
            mark(hero, 'component', 'new-chat-hero');
        }

        const backdrop = document.querySelector('.settings-modal-backdrop');
        const settingsDialog = document.querySelector('.settings-modal-container');
        mark(backdrop, 'component', 'settings-backdrop');
        mark(settingsDialog, 'component', 'settings-dialog');
        if (settingsDialog) {
            const dialogRect = settingsDialog.getBoundingClientRect();
            const settingSidebar = Array.from(settingsDialog.querySelectorAll('div')).filter(visible).find(element => {
                const rect = element.getBoundingClientRect();
                return rect.x <= dialogRect.x + 230 && rect.width >= 180 && rect.width <= 240 && rect.height > dialogRect.height * .78;
            });
            mark(settingSidebar, 'component', 'settings-sidebar');
        }

        document.querySelectorAll('[role="dialog"], [role="menu"], [role="listbox"]').forEach(element => {
            if (!settingsDialog || !settingsDialog.contains(element)) mark(element, 'component', 'popover');
        });

        document.querySelectorAll('[role="article"][aria="Agent response"]').forEach(element => mark(element, 'component', 'agent-message'));
        document.querySelectorAll('[role="article"] [class*="border"][class*="rounded"]').forEach(element => {
            const rect = element.getBoundingClientRect();
            if (rect.width > 180 && rect.width < 820 && rect.height > 44) mark(element, 'component', 'semantic-card');
        });
        Array.from(document.querySelectorAll('button')).filter(element => /审核|批准|拒绝|Approve|Reject/.test(compactText(element))).forEach(button => {
            const card = ancestorMatching(button, element => {
                const rect = element.getBoundingClientRect();
                return rect.width > 220 && rect.width < 900 && rect.height > 70 && String(element.className || '').includes('border');
            }, 10);
            mark(card, 'component', 'review-card');
        });

        /* 1. 动态查找并强力标注侧边栏当前激活/选中的对话项目链接 */
        /* 1. 动态查找并强力标注侧边栏当前激活/选中的对话项目链接（严格限定为 a 链接以防误染） */
        if (sidebar) {
            const activeCandidates = Array.from(sidebar.querySelectorAll('a')).filter(el => {
                const href = el.getAttribute?.('href') || '';
                if (!href || href === '#' || href === '/') return false;
                // 精准匹配当前正在打开的会话 hash 路由
                if (location.hash && location.hash.length > 2 && href.includes(location.hash)) return true;
                if (el.getAttribute?.('aria-current') === 'page') return true;
                if (el.getAttribute?.('data-state') === 'active') return true;
                if (el.getAttribute?.('data-active') === 'true') return true;
                return false;
            });
            sidebar.querySelectorAll('[data-agy-active]').forEach(el => el.removeAttribute('data-agy-active'));
            activeCandidates.forEach(el => el.setAttribute('data-agy-active', 'true'));
        }

        /* 2. 动态抓取免费额度文本以及进度条指示器进行主题美化 */
        Array.from(document.querySelectorAll('#root *')).forEach(element => {
            const text = compactText(element);
            if (text.includes('每周额度') || text.includes('5H额度') || text.includes('免费额度') || text.includes('额度：')) {
                mark(element, 'component', 'quota-item');
                const parent = element.parentElement;
                if (parent) {
                    const progress = parent.querySelector('[role="progressbar"], [class*="progress"], [class*="Progress"]');
                    if (progress) {
                        mark(progress, 'component', 'quota-progress');
                        const indicator = progress.querySelector('div');
                        if (indicator) mark(indicator, 'component', 'quota-progress-indicator');
                    }
                }
            }
        });
    }

    function scheduleSemanticUpdate() {
        clearTimeout(semanticTimer);
        semanticTimer = setTimeout(annotateSemanticDom, 70);
    }

    function setThemeVariables(theme) {
        const root = document.documentElement;
        const values = {
            '--agy-accent': theme.accent,
            '--agy-accent-soft': theme.accentSoft,
            '--agy-warm': theme.warm,
            '--agy-app': theme.app,
            '--agy-sidebar': theme.sidebar,
            '--agy-content': theme.content,
            '--agy-dialog': theme.dialog,
            '--agy-input': theme.input,
            '--agy-text': theme.text,
            '--agy-muted': theme.muted,
            '--agy-border': theme.border,
            '--agy-shadow': theme.shadow,
            '--agy-wallpaper-position': theme.position
        };
        Object.entries(values).forEach(([name, value]) => root.style.setProperty(name, value));
    }

    function updateChoiceState(themeId) {
        document.querySelectorAll('.agy-theme-v2-choice').forEach(button => button.classList.toggle('active', button.dataset.themeId === themeId));
    }

    function applyConfig(config) {
        if (!document.body) return;
        ensureStyle();
        const wallpaper = ensureWallpaper();
        if (!config || !config.enabled || config.id === 'native') {
            document.documentElement.classList.remove('agy-theme-active-v2');
            document.documentElement.removeAttribute('data-agy-theme');
            wallpaper.style.backgroundImage = '';
            activeImageKey = '';
            updateChoiceState('native');
            return;
        }
        const theme = catalog.find(item => item.id === config.id) || catalog[0];
        if (!config.imageDataUrl) return;
        const imageKey = `${config.id}:${config.revision || config.updatedAt || ''}`;
        if (activeImageKey !== imageKey) {
            wallpaper.style.backgroundImage = `url("${config.imageDataUrl}")`;
            activeImageKey = imageKey;
        }
        setThemeVariables(theme);
        document.documentElement.classList.add('agy-theme-active-v2');
        document.documentElement.dataset.agyTheme = theme.id;
        updateChoiceState(theme.id);
        scheduleSemanticUpdate();
    }

    function ensureSwitcher() {
        if (document.getElementById('agy-theme-switcher-v2')) return;
        const switcher = document.createElement('div');
        switcher.id = 'agy-theme-switcher-v2';
        const menu = document.createElement('div');
        menu.id = 'agy-theme-menu-v2';
        const title = document.createElement('strong');
        title.textContent = 'Antigravity 主题皮肤';
        menu.appendChild(title);
        catalog.forEach(theme => {
            const button = document.createElement('button');
            button.className = 'agy-theme-v2-choice';
            button.dataset.themeId = theme.id;
            button.style.setProperty('--choice-accent', theme.accent);
            button.innerHTML = '<span class="agy-theme-v2-swatch"></span><span></span>';
            button.lastElementChild.textContent = theme.name;
            button.addEventListener('click', async event => {
                event.stopPropagation();
                try {
                    const config = await themeIpc.invoke('agy-theme:set', theme.id);
                    lastRevision = config.revision || '';
                    applyConfig(config);
                } catch (error) {
                    console.warn('[AGY Theme V2] switch failed:', error);
                }
                switcher.classList.remove('open');
            });
            menu.appendChild(button);
        });
        const nativeButton = document.createElement('button');
        nativeButton.className = 'agy-theme-v2-choice agy-theme-v2-native';
        nativeButton.dataset.themeId = 'native';
        nativeButton.innerHTML = '<span class="agy-theme-v2-swatch" style="--choice-accent:#9aa4ad"></span><span>恢复原生主题</span>';
        nativeButton.addEventListener('click', async event => {
            event.stopPropagation();
            try {
                const config = await themeIpc.invoke('agy-theme:disable');
                lastRevision = config.revision || '';
                applyConfig(config);
            } catch (error) {
                console.warn('[AGY Theme V2] disable failed:', error);
            }
            switcher.classList.remove('open');
        });
        menu.appendChild(nativeButton);
        const trigger = document.createElement('button');
        trigger.id = 'agy-theme-trigger-v2';
        trigger.type = 'button';
        trigger.title = '切换主题皮肤';
        trigger.setAttribute('aria-label', '切换主题皮肤');
        trigger.textContent = '✦';
        trigger.addEventListener('click', event => {
            event.stopPropagation();
            switcher.classList.toggle('open');
        });
        switcher.append(menu, trigger);
        document.body.appendChild(switcher);
        document.addEventListener('click', () => switcher.classList.remove('open'));
    }

    async function refreshTheme() {
        try {
            const config = await themeIpc.invoke('agy-theme:get', lastRevision);
            if (!config || config.unchanged) return;
            lastRevision = config.revision || '';
            applyConfig(config);
        } catch (error) {
            console.warn('[AGY Theme V2] refresh failed:', error);
        }
    }

    function removeLegacyEngine() {
        document.getElementById('agy-theme-engine-style')?.remove();
        document.getElementById('agy-theme-wallpaper')?.remove();
        document.getElementById('agy-theme-switcher')?.remove();
        document.documentElement.classList.remove('agy-theme-active', 'agy-chat-empty');
    }

    function start() {
        removeLegacyEngine();
        ensureStyle();
        ensureWallpaper();
        ensureSwitcher();
        annotateSemanticDom();
        refreshTheme();
        setInterval(refreshTheme, 900);
        setInterval(annotateSemanticDom, 800);
        observer = new MutationObserver(scheduleSemanticUpdate);
        observer.observe(document.body, { childList: true, subtree: true });
        window.addEventListener('popstate', scheduleSemanticUpdate);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
})();
