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

// ==========================================
// Antigravity 2.0 Chinese Localization Engine
// ==========================================

(function() {
  const dictionary = {
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
    "Confirm Quit": "确认退出",
    "Are you sure you want to quit?": "您确定要退出吗？",
    "There may be agents or background tasks running.": "可能还有智能体或后台任务正在运行。",
    "Welcome to the new Antigravity!": "欢迎使用全新 Antigravity！",
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
    "Browser Actuation Rules": "浏览器操作控制规则",
    "Configure allowed and denied URLs for browser actuation.": "配置允许或禁止浏览器执行动作的 URL 列表。",
    "App Settings": "应用设置",
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
    "One Light": "One 浅色",
    "Solarized Light": "Solarized 浅色",
    "One Dark Pro": "One 深色 Pro",
    
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
    "Sort": "排序"
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
    { search: 'Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY)', replace: '提供 Google Antigravity (AGY) 的全面指南、快速参考和网站地图' },
    { search: 'including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, and customizations (skills, rules, MCP, sidecars).', replace: '包括 Antigravity 命令行界面 (agy)、Antigravity 2.0、Antigravity IDE、Python SDK、斜杠命令以及自定义项（技能、规则、MCP、挂载服务）。' },
    { search: 'Activate this skill when the user asks questions about how to use, configure, or customize Antigravity, AGY, the agy CLI, the Antigravity IDE, or Antigravity 2.0.', replace: '当用户询问如何使用、配置或自定义 Antigravity、AGY、agy 命令行、Antigravity IDE 或 Antigravity 2.0 时，激活此技能。' },
    { search: 'Search MCP servers by name', replace: '按名称搜索 MCP 服务端' },
    { search: 'Investigate and fix software issues using AI-powered root cause analysis. This MCP server connects to your Antimetal account to search issues, read', replace: '使用 AI 驱动的根因分析调查和修复软件问题。该 MCP 服务端连接到您的 Antimetal 账户以搜索问题、读取' },
    { search: 'Query and act on your marketing, analytics, CRM, e-commerce, and warehouse data', replace: '查询并处理您的营销、分析、CRM、电子商务和仓库数据' },
    { search: 'across 325+ connectors (Meta Ads, Google Ads, TikTok Ads, GA4, HubSpot,', replace: '支持 325+ 个连接器（Meta 广告、Google 广告、TikTok 广告、GA4、HubSpot' },
    { search: 'Query your GitLab SDLC as a knowledge graph.', replace: '将您的 GitLab SDLC 作为知识图谱进行查询。' },
    { search: 'Orbit indexes groups, projects, source code, merge requests, pipelines, work items, and security findings into a', replace: 'Orbit 将群组、项目、源代码、合并请求、流水线、工作项和安全发现索引到一个' },
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

    // MCP Server Description dynamic translation
    if (/^(Allows running|Allows interacting with|Allows querying|Allows accessing|Provides tools to|Provides tools for|Provides tools) (.*?)\.? This tool runs on the host system outside of any sandboxes\.?$/i.test(trimmed)) {
      const action = RegExp.$1.toLowerCase();
      const target = RegExp.$2.trim();
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
    } else if (/^You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?/, '您已消耗了部分每周限额，将在 $1 小时后完全重置。');
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
      
      if (matchPunc === '.') trailPunc = '。';
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

    // 3. Fallback to word-by-word ONLY for short strings (<= 3 words)
    if (/[\u4e00-\u9fa5]/.test(core)) {
      return text;
    }
    const wordsCount = core.split(/\s+/).filter(Boolean).length;
    if (wordsCount > 3) {
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

  // Fetch the latest dictionary in the background
  fetch('https://raw.githubusercontent.com/good9527/Antigravity-Chinese-Patch/main/dist/dictionary.json')
    .then(res => {
      if (res.ok) return res.json();
      throw new Error('Network response was not ok');
    })
    .then(data => {
      if (data && typeof data === 'object') {
        localStorage.setItem('antigravity_chinese_patch_dict', JSON.stringify(data));
        Object.assign(dictionary, data);
        console.log('Antigravity Chinese Patch: Cloud dictionary updated successfully! Total keys: ' + Object.keys(data).length);
        
        // Force refresh current body translation
        if (document.body) {
          translateNode(document.body);
        }
      }
    })
    .catch(err => {
      console.warn('Antigravity Chinese Patch: Cloud update failed or offline. Using local dictionary. Details:', err);
    });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
