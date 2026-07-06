"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Preload script 鈥?runs in every BrowserWindow before the page loads.
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
    // Tooltips
    "Your quota for this model is running low.": "璇ユā鍨嬬殑閰嶉宸蹭笉澶氥€?,
    "Select Model Ctrl+/": "閫夋嫨妯″瀷 Ctrl+/",
    "Install Antigravity IDE to run and edit your workspace scripts.": "瀹夎 Antigravity IDE 浠ヨ繍琛屽拰缂栬緫鎮ㄧ殑宸ヤ綔鍖鸿剼鏈€?,
    "Record Audio Ctrl+M": "褰曢煶 Ctrl+M",
    "Select Project Ctrl+;": "閫夋嫨椤圭洰 Ctrl+;",
    "Select Model": "閫夋嫨妯″瀷",
    "Record Audio": "褰曢煶",
    "Select Project": "閫夋嫨椤圭洰",

    // Appearance & Themes Settings
    "Conversation Width": "瀵硅瘽瀹藉害",
    "Configure the maximum width of the conversation panel.": "閰嶇疆瀵硅瘽闈㈡澘鐨勬渶澶у搴︺€?,
    "Narrow": "绐?,
    "Wide": "瀹?,
    "Catppuccin": "Catppuccin",
    "One Light": "One Light",
    "Solarized Light": "Solarized Light",
    "Dracula": "Dracula",
    "Monokai": "Monokai",
    "One Dark Pro": "One Dark Pro",
    "Tokyo Night": "Tokyo Night",
    "Solarized Dark": "Solarized Dark",

    // Top Bar & Menus
    "File": "鏂囦欢",
    "Edit": "缂栬緫",
    "View": "瑙嗗浘",
    "Selection": "閫夋嫨",
    "Find": "鏌ユ壘",
    "Help": "甯姪",
    "Docs": "鏂囨。",
    "Docs & API Reference": "鏂囨。涓?API 鍙傝€?,
    "Toggle Developer Tools": "寮€鍙戣€呭伐鍏?,
    "New Window": "鏂扮獥鍙?,
    "Quit": "閫€鍑?,
    "Cancel": "鍙栨秷",
    "Confirm Quit": "纭閫€鍑?,
    "Are you sure you want to quit?": "鎮ㄧ‘瀹氳閫€鍑哄悧锛?,
    "There may be agents or background tasks running.": "鍙兘杩樻湁鏅鸿兘浣撴垨鍚庡彴浠诲姟姝ｅ湪杩愯銆?,
    "Welcome to the new Antigravity!": "娆㈣繋浣跨敤鍏ㄦ柊 Antigravity锛?,
    "Welcome to": "娆㈣繋浣跨敤",
    "Welcome to Antigravity": "娆㈣繋浣跨敤 Antigravity",
    "Continue with Google": "浣跨敤 Google 璐﹀彿鐧诲綍",
    "Use Google Cloud project instead": "鎴栦娇鐢?Google Cloud 椤圭洰鍑嵁",
    "Antigravity has been redesigned to put agents first with new capabilities. If you'd still like a code editor, you can download it as a separate app named": "Antigravity 宸茬粡閲嶆瀯涓轰互鏅鸿兘浣撲负鏍稿績鐨勫叏鏂板钩鍙般€傚鏋滄偍浠嶉渶瑕佷唬鐮佺紪杈戝櫒锛屽彲浠ュ皢鍏朵綔涓哄悕涓轰互涓嬬殑鐙珛搴旂敤涓嬭浇锛?,
    "Antigravity IDE": "Antigravity IDE 缂栬緫鍣?,
    "Download the Antigravity IDE": "涓嬭浇 Antigravity IDE",
    "Explore the new Antigravity": "鎺㈢储鍏ㄦ柊 Antigravity",
    "Setting up鈥?: "姝ｅ湪鍚姩/璁剧疆涓?..",
    "Agent": "鏅鸿兘浣?,
    "Agents": "鏅鸿兘浣?,
    "Subagent": "瀛愭櫤鑳戒綋",
    "Subagents": "瀛愭櫤鑳戒綋",
    "Task": "浠诲姟",
    "Tasks": "浠诲姟",
    "Workspace": "宸ヤ綔鍖?,
    "Workspaces": "宸ヤ綔鍖?,
    "Command": "鍛戒护",
    "Run": "杩愯",
    "Settings": "璁剧疆",
    "Model": "妯″瀷",
    "Stop": "鍋滄",
    "Approve": "鎵瑰噯",
    "Reject": "鎷掔粷",
    "Terminal": "缁堢",
    "Output": "杈撳嚭",
    "Codebase": "浠ｇ爜搴?,
    "Error": "閿欒",
    "Success": "鎴愬姛",
    "Pending": "绛夊緟涓?,
    "Running": "杩愯涓?,
    "Completed": "宸插畬鎴?,
    "Failed": "宸插け璐?,
    "Branch": "鍒嗘敮",
    "Merge": "鍚堝苟",
    "Conflict": "鍐茬獊",
    "Generate Image": "鐢熸垚鍥惧儚",
    "Web Search": "缃戦〉鎼滅储",
    "Grep Search": "鍏ㄥ眬鎼滅储",
    "Active Agents": "娲昏穬鏅鸿兘浣?,
    "No agents running": "娌℃湁杩愯涓殑鏅鸿兘浣?,
    "active workspace": "娲诲姩宸ヤ綔鍖?,
    "Active Workspace": "娲诲姩宸ヤ綔鍖?,
    "Search": "鎼滅储",
    "Search...": "鎼滅储...",
    "Type a command...": "杈撳叆鍛戒护...",
    "Settings & Preferences": "璁剧疆涓庡亸濂?,
    "General": "閫氱敤",
    "Themes": "涓婚",
    "Language": "璇█",
    "Model Selection": "妯″瀷閫夋嫨",
    "Advanced": "楂樼骇",
    "Developer": "寮€鍙戣€?,
    "Save": "淇濆瓨",
    "Close": "鍏抽棴",
    "Status": "鐘舵€?,
    "Progress": "杩涘害",
    "Logs": "鏃ュ織",
    "Console": "鎺у埗鍙?,
    "Running task...": "浠诲姟杩愯涓?..",
    "Task completed successfully": "浠诲姟鎴愬姛瀹屾垚",
    "An error occurred": "鍙戠敓閿欒",
    "Connecting to Language Server...": "姝ｅ湪杩炴帴璇█鏈嶅姟鍣?..",
    "Language Server": "璇█鏈嶅姟鍣?,
    "Connected": "宸茶繛鎺?,
    "Disconnected": "宸叉柇寮€",
    "Select a folder": "閫夋嫨鏂囦欢澶?,
    "Open Folder": "鎵撳紑鏂囦欢澶?,
    "Create New Project": "鍒涘缓鏂伴」鐩?,
    "Antigravity": "Antigravity",
    "Antigravity 2.0": "Antigravity 2.0",
    "Google DeepMind": "璋锋瓕 DeepMind",
    "Advanced Agentic Coding": "楂樼骇鏅鸿兘浣撶紪鐮?,
    "Welcome to Antigravity": "娆㈣繋浣跨敤 Antigravity",
    "Get Started": "寮€濮嬩娇鐢?,
    "Create an agent to get started": "鍒涘缓涓€涓櫤鑳戒綋浠ュ紑濮?,
    "New Agent": "鏂板缓鏅鸿兘浣?,
    "Agent Name": "鏅鸿兘浣撳悕绉?,
    "System Prompt": "绯荤粺鎻愮ず璇?,
    "Description": "鎻忚堪",
    "Capabilities": "鑳藉姏",
    "Write Files": "鍐欏叆鏂囦欢",
    "Run Commands": "杩愯鍛戒护",
    "Web Browsing": "缃戦〉娴忚",
    "Define Subagents": "瀹氫箟瀛愭櫤鑳戒綋",
    "Call MCP Tools": "璋冪敤 MCP 宸ュ叿",
    "Inherit Workspace": "缁ф壙宸ヤ綔鍖?,
    "Branch Workspace": "鍒嗘敮闅旂宸ヤ綔鍖?,
    "Share Workspace": "鍏变韩宸ヤ綔鍖?,
    "timer": "瀹氭椂鍣?,
    "Timers": "瀹氭椂鍣?,
    "Cron Jobs": "璁″垝浠诲姟",
    "Schedule": "璋冨害",
    "Directory analysis": "鐩綍鍒嗘瀽",
    "Web search": "缃戦〉鎼滅储",
    "File edit": "鏂囦欢缂栬緫",
    "Command execution": "鍛戒护鎵ц",
    "Semantic search": "璇箟鎼滅储",

    // Added sentences & refined for user experience
    "Permissions": "鏉冮檺",
    "Configure global allowed and denied resource permissions. Learn more.": "閰嶇疆鍏ㄥ眬鍏佽涓庢嫆缁濈殑璧勬簮璁块棶鏉冮檺銆備簡瑙ｆ洿澶氥€?,
    "Configure global allowed and denied resource permissions.": "閰嶇疆鍏ㄥ眬鍏佽涓庢嫆缁濈殑璧勬簮璁块棶鏉冮檺銆?,
    "Learn more.": "浜嗚В鏇村銆?,
    "Learn more": "浜嗚В鏇村",
    "Project-Specific Settings": "椤圭洰涓撳睘璁剧疆",
    "Project-Specific": "椤圭洰涓撳睘",
    "Modify scoped permissions, folders, and Agent settings like Sandbox and Terminal command execution.": "淇敼椤圭洰涓撳睘璁块棶鏉冮檺銆佸伐浣滄枃浠跺す浠ュ強鏅鸿兘浣撹缃紙渚嬪娌欑洅鍜岀粓绔懡浠ゆ墽琛岋級銆?,
    "Modify scoped permissions, folders, and Agent settings": "淇敼椤圭洰涓撳睘璁块棶鏉冮檺銆佸伐浣滄枃浠跺す浠ュ強鏅鸿兘浣撹缃?,
    "like Sandbox and Terminal command execution.": "渚嬪娌欑洅涓庣粓绔懡浠ゆ墽琛屻€?,
    "Go to Projects": "杞埌椤圭洰",
    "File Permissions": "鏂囦欢鏉冮檺",
    "File Access Rules": "鏂囦欢璁块棶瑙勫垯",
    "Configure allowed and denied paths for file reads and writes.": "閰嶇疆鏂囦欢璇诲啓鐨勫厑璁镐笌鎷掔粷璺緞銆?,
    "Network Permissions": "缃戠粶鏉冮檺",
    "Network Access Rules": "缃戠粶璁块棶瑙勫垯",
    "Configure allowed and denied URLs for reading.": "閰嶇疆鍏佽鎴栫姝㈣鍙栫殑 URL銆?,
    "Terminal & Tooling Permissions": "缁堢鍜屽伐鍏锋潈闄?,
    "Terminal Commands": "缁堢鍛戒护",
    "Configure allowed terminal commands.": "閰嶇疆鍏佽鎵ц鐨勭粓绔懡浠ゃ€?,
    "Commands Outside Sandbox": "娌欑洅澶栧懡浠?,
    "Configure allowed commands outside the sandbox.": "閰嶇疆鍏佽鍦ㄦ矙鐩掑鎵ц鐨勭粓绔懡浠ゃ€?,
    "MCP Tools": "MCP 宸ュ叿",
    "Configure external tools via Model Context Protocol.": "閫氳繃妯″瀷涓婁笅鏂囧崗璁?(MCP) 閰嶇疆澶栭儴宸ュ叿銆?,
    "Global": "鍏ㄥ眬",
    "Sandbox": "娌欑洅",
    "Sandbox enabled": "娌欑洅宸插惎鐢?,
    "Sandbox disabled": "娌欑洅宸茬鐢?,
    "Allowed": "宸插厑璁?,
    "Denied": "宸叉嫆缁?,
    "Paths": "璺緞",
    "URLs": "URL",
    "Tools": "宸ュ叿",

    // Appearance & Settings
    "Appearance": "澶栬",
    "Configure the Agent's visual theme and display preferences.": "閰嶇疆鏅鸿兘浣撶殑瑙嗚涓婚涓庢樉绀哄亸濂姐€?,
    "Chat Settings": "鑱婂ぉ璁剧疆",
    "Verbose Agent Chat": "鏄剧ず鏅鸿兘浣撹缁嗚緭鍑?,
    "Display and preserve intermediate thinking steps": "鏄剧ず骞朵繚鐣欐櫤鑳戒綋涓棿鎬濊€冭繃绋?,
    "Choose light, dark, or inherit system settings.": "閫夋嫨娴呰壊銆佹繁鑹诧紝鎴栫户鎵跨郴缁熻缃€?,
    "Dark": "娣辫壊",
    "Light": "娴呰壊",
    "Light Theme": "娴呰壊涓婚",
    "Preset": "棰勮",
    "Default Light": "榛樿娴呰壊",
    "Background": "鑳屾櫙鑹?,
    "Foreground": "鍓嶆櫙鑹?,
    "Accent": "寮鸿皟鑹?,
    "Dark Theme": "娣辫壊涓婚",
    "Default Dark": "榛樿娣辫壊",
    
    // Customizations
    "Customizations": "鑷畾涔?,
    "Skills & Customizations": "鎶€鑳戒笌瀹氬埗",
    "Configure default behaviors, skills, and MCP servers.": "閰嶇疆榛樿琛屼负銆佹妧鑳戒互鍙?MCP 鏈嶅姟鍣ㄣ€?,
    "Token Usage": "Token 浣跨敤璇︽儏",
    "The breakdown below shows token usage from customizations like skills, rules, and MCP. If the budget is exceeded, large customizations will be truncated automatically.": "浠ヤ笅璇︽儏灞曠ず浜嗘潵鑷妧鑳姐€佽鍒欏拰 MCP 绛夎嚜瀹氫箟椤?of the Token 浣跨敤鎯呭喌銆傚鏋滈搴﹁秴闄愶紝澶у瀷鑷畾涔夊唴瀹瑰皢琚嚜鍔ㄦ埅鏂€?,
    "of the customization budget is available.": "鐨勮嚜瀹氫箟棰濆害鍙敤銆?,
    "100.0% of the customization budget is available.": "100.0% 鐨勮嚜瀹氫箟棰濆害鍙敤銆?,
    "No customizations found for this workspace.": "鏈壘鍒版宸ヤ綔鍖虹殑鑷畾涔夐」銆?,
    "Installed MCP Servers": "宸插畨瑁呯殑 MCP 鏈嶅姟鍣?,
    "No MCP Servers": "鏃犲凡瀹夎鐨?MCP 鏈嶅姟鍣?,
    "You currently don't have any MCP Servers installed.": "鎮ㄥ綋鍓嶆湭瀹夎浠讳綍 MCP 鏈嶅姟鍣ㄣ€?,
    "Add an MCP server above": "鍦ㄤ笂鏂规坊鍔犱竴涓?MCP 鏈嶅姟鍣?,
    "Search MCP servers...": "鎼滅储 MCP 鏈嶅姟鍣?..",
    "Available MCP Servers": "鍙敤鐨?MCP 鏈嶅姟鍣?,
    "Enable": "鍚敤",
    "Disable": "绂佺敤",
    "Build With Google Plugins": "浣跨敤 Google 鎻掍欢鏋勫缓",
    "Build with Antigravity Plugins": "鍩轰簬 Antigravity 鎻掍欢鏋勫缓",
    "Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products. You can always change your choices in Settings.": "鎻掍欢鏄寘鍚妧鑳藉拰 MCP 鏈嶅姟灏佽鐨勮祫婧愬寘锛屾棬鍦ㄥ崗鍔?Antigravity 鏅鸿兘浣撹皟鐢?Google 寮€鍙戣€呬骇鍝併€傛偍闅忔椂鍙互鍦ㄨ缃腑鏇存敼閫夋嫨銆?,
    "Android": "Android 绉诲姩寮€鍙?,
    "Core tools and knowledge required to develop for Android": "閫傜敤浜庡紑鍙?Android 搴旂敤绋嬪簭鐨勬牳蹇冨伐鍏蜂笌鏀寔鐭ヨ瘑搴?,
    "Modern Web Guidance": "鐜颁唬 Web 寮€鍙戞寚鍗?,
    "Keep your coding agent up to date with the latest web best practices.": "璁╂偍鐨勭紪绋嬫櫤鑳戒綋鎺屾彙鐜颁唬 Web 寮€鍙戠殑鏈€浣冲疄璺靛拰璁捐瑙勮寖銆?,
    "Google Antigravity SDK": "Google Antigravity 寮€鍙戝浠?,
    "Using the Antigravity Python SDK to build AI agents": "浣跨敤 Antigravity Python SDK 蹇€熸瀯寤哄拰鎵╁睍鑷畾涔?AI 鏅鸿兘浣?,
    "Science": "绉戝鐮旂┒涓庡鏈?,
    "Curated collection of agent skills for science.": "绮鹃€夌殑閫傜敤浜庣瀛﹁绠椼€佸鏈垎鏋愮殑鏅鸿兘浣撳伐鍏蜂笌鎶€鑳藉簱銆?,
    "Firebase": "Firebase 寮€鍙戣€呭浠?,
    "Prototype, build & run modern apps users love with Firebase's backend, AI, and operational infrastructure.": "鍒╃敤 Firebase 鐨勫悗绔湇鍔°€丄I 涓庡熀纭€杩愯璁炬柦锛屽揩閫熸瀯寤哄苟杩愯惀鐢ㄦ埛鍠滅埍鐨勭幇浠ｅ寲搴旂敤銆?,
    "Chrome DevTools": "Chrome DevTools 宸ュ叿绠?,
    "Reliable automation, in-depth debugging, and performance analysis in Chrome using Chrome DevTools": "鍦?Chrome 娴忚鍣ㄤ腑鍒╃敤 DevTools 璋冭瘯鍗忚瀹炵幇楂樺彲闈犳€ц嚜鍔ㄥ寲銆佹繁搴﹁皟璇曞強鎬ц兘鍓栨瀽",
    
    // Account
    "Account": "璐﹀彿",
    "Manage your plan, credentials, and general preferences.": "绠＄悊鎮ㄧ殑璁″垝銆佸嚟鎹拰甯歌鍋忓ソ銆?,
    "Enable Telemetry": "鍚敤閬ユ祴",
    "When toggled on, Antigravity collects usage data to help Google enhance performance and features.": "寮€鍚悗锛孉ntigravity 浼氭敹闆嗗尶鍚嶄娇鐢ㄦ暟鎹紝浠ュ府鍔?Google 鎸佺画鏀硅繘鎬ц兘鍜屽姛鑳姐€?,
    "Marketing Emails": "钀ラ攢鐢靛瓙閭欢",
    "Receive product updates, tips, and promotions from Google Antigravity via email.": "閫氳繃鐢靛瓙閭欢鎺ユ敹鏉ヨ嚜 Google Antigravity 鐨勪骇鍝佹洿鏂般€佹妧宸т笌淇冮攢淇℃伅銆?,
    "Your Plan:": "鎮ㄧ殑璁″垝锛?,
    "Your Plan: Google AI Pro": "鎮ㄧ殑璁″垝锛欸oogle AI Pro",
    "You can upgrade to a Google AI Ultra plan to receive the highest rate limits.": "鎮ㄥ彲浠ュ崌绾у埌 Google AI Ultra 璁″垝浠ヨ幏寰楁洿楂橀鐨勪娇鐢ㄩ€熺巼闄愬埗銆?,
    "Email": "鐢靛瓙閭欢",
    
    // Browser & App Settings
    "Browser Settings": "娴忚鍣ㄨ缃?,
    "Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.": "閰嶇疆娴忚鍣ㄥ瓙鏅鸿兘浣撱€傝繖闇€瑕佸畨瑁?Google Chrome銆傚彲浠ュ湪瀵硅瘽杈撳叆妗嗕腑杈撳叆 /browser 鏉ヨ皟鐢ㄦ祻瑙堝櫒瀛愭櫤鑳戒綋銆?,
    "Configure the browser agent. Running this feature requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.": "閰嶇疆娴忚鍣ㄦ櫤鑳戒綋銆傝繍琛屾鍔熻兘闇€瑕佸畨瑁?Google Chrome 娴忚鍣ㄣ€傚彲浠ラ€氳繃鍦ㄥ璇濊緭鍏ユ涓緭鍏?/browser 鏉ヨ皟鐢ㄦ祻瑙堝櫒鏅鸿兘浣撱€?,
    "Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing": "閰嶇疆娴忚鍣ㄥ瓙鏅鸿兘浣撱€傝繖闇€瑕佸畨瑁?Google Chrome銆傚彲浠ラ€氳繃杈撳叆",
    "in the conversation input box.": "鍦ㄥ璇濊緭鍏ユ涓皟鐢ㄨ瀛愭櫤鑳戒綋銆?,
    "Browser Javascript Execution Policy": "娴忚鍣?JavaScript 鎵ц绛栫暐",
    "Controls whether the agent can run custom JavaScript to automate complex browser actions.": "鎺у埗鏅鸿兘浣撴槸鍚﹀彲浠ヨ繍琛岃嚜瀹氫箟 JavaScript 浠ヨ嚜鍔ㄥ寲澶嶆潅鐨勬祻瑙堝櫒鎿嶄綔銆?,
    "Request Review": "闇€瑕佷汉宸ュ鏍?,
    "Disabled": "宸茬鐢?,
    "Block all browser JavaScript execution.": "绂佹鎵ц鎵€鏈夋祻瑙堝櫒 JavaScript銆?,
    "Prompt for approval before running browser scripts.": "鍦ㄨ繍琛屾祻瑙堝櫒鑴氭湰鍓嶉渶浜哄伐鎵瑰噯銆?,
    "Allow full browser script execution without prompting.": "鍏佽鎵ц鎵€鏈夋祻瑙堝櫒鑴氭湰锛堟棤闇€鎻愮ず锛夈€?,
    "Actuation Permissions": "鍔ㄤ綔鎵ц鏉冮檺",
    "Browser Actuation Permissions": "娴忚鍣ㄥ姩浣滄墽琛屾潈闄?,
    "Execute URLs": "鍔ㄤ綔鎵ц URL 瑙勫垯",
    "Allow/deny agent browser actuation access to specific URLs.": "鍏佽鎴栭樆姝㈡櫤鑳戒綋鍦ㄦ祻瑙堝櫒涓搷浣滆闂壒瀹氱殑 URL 鍦板潃鍒楄〃銆?,
    "Browser Actuation Rules": "娴忚鍣ㄦ搷浣滄帶鍒惰鍒?,
    "Configure allowed and denied URLs for browser actuation.": "閰嶇疆鍏佽鎴栫姝㈡祻瑙堝櫒鎵ц鍔ㄤ綔鐨?URL 鍒楄〃銆?,
    "App Settings": "搴旂敤璁剧疆",
    "Automatic Check for Updates": "鑷姩妫€鏌ユ洿鏂?,
    "When enabled, you will be automatically prompted to restart the app when there is a new update available. When disabled, you can check for updates manually from the app menu.": "寮€鍚悗锛屽綋鏈夋柊鐗堟湰鍙敤鏃讹紝绯荤粺浼氳嚜鍔ㄦ彁绀烘偍閲嶅惎搴旂敤浠ュ簲鐢ㄦ洿鏂般€傚叧闂悗锛屾偍鍙互閫氳繃搴旂敤鑿滃崟鎵嬪姩妫€鏌ユ洿鏂般€?,
    "Prevent Sleep": "闃叉璁＄畻鏈轰紤鐪?,
    "Prevent the computer from sleeping while the app is running.": "鍦ㄥ簲鐢ㄨ繍琛屾椂闃叉璁＄畻鏈鸿繘鍏ヤ紤鐪犵姸鎬併€?,
    "Keep In Menu Bar": "甯搁┗绯荤粺鎵樼洏",
    "The app will be accessible from the menu bar and will keep running in the background when all windows are closed.": "鍏抽棴鎵€鏈夌獥鍙ｅ悗锛屽簲鐢ㄥ皢甯搁┗鑿滃崟鏍忓苟鍦ㄥ悗鍙颁繚鎸佽繍琛屻€?,
    "Notifications": "閫氱煡",
    "Notification Settings": "閫氱煡璁剧疆",
    "To modify notification settings, open your operating system's system preferences.": "濡傞渶淇敼閫氱煡璁剧疆锛岃鎵撳紑鎮ㄦ搷浣滅郴缁熺殑绯荤粺鍋忓ソ璁剧疆銆?,

    // Agent Settings
    "Agent Settings": "鏅鸿兘浣撹缃?,
    "Security Preset": "瀹夊叏棰勮",
    "Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.": "涓烘櫤鑳戒綋閫夋嫨棰勫畾涔夌殑瀹夊叏棰勮銆傝繖灏嗘帶鍒剁粓绔嚜鍔ㄦ墽琛岀瓥鐣ュ拰鏂囦欢璁块棶绛栫暐銆?,
    "Choose a predefined security preset for the agent.": "涓烘櫤鑳戒綋閫夋嫨棰勫畾涔夌殑瀹夊叏棰勮銆?,
    "This controls terminal auto-execution policy, and file access policy.": "杩欏皢鎺у埗缁堢鑷姩鎵ц绛栫暐鍜屾枃浠惰闂瓥鐣ャ€?,
    "Learn more about Default": "浜嗚В鍏充簬榛樿棰勮鐨勬洿澶氫俊鎭?,
    "Default": "榛樿",
    "Agent Behavior": "鏅鸿兘浣撹涓?,
    "Artifact Review Policy": "宸ヤ欢瀹℃牳绛栫暐",
    "Specifies agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.": "璁剧疆鏅鸿兘浣撳湪璇锋眰瀹℃牳宸ヤ欢鏃剁殑琛屼负鏂瑰紡銆傚伐浠舵槸鍏朵负鎻愪緵鏇翠赴瀵屽璇濅綋楠岃€屽垱寤虹殑鏂囨。銆?,
    "Always Ask": "濮嬬粓璇㈤棶",
    "Local Permissions": "椤圭洰涓撳睘鏉冮檺",
    "Inherits from global settings. Local permissions have higher priority.": "缁ф壙鑷叏灞€璁剧疆銆傞」鐩笓灞炴潈闄愬叿鏈夋洿楂樼殑浼樺厛绾с€?,
    "Inherits from global settings.": "缁ф壙鑷叏灞€璁剧疆銆?,
    "Local permissions have higher priority.": "椤圭洰涓撳睘鏉冮檺鍏锋湁鏇撮珮鐨勪紭鍏堢骇銆?,
    "Danger Zone": "鍗遍櫓鍖哄煙",
    "Delete Project": "鍒犻櫎椤圭洰",
    "Permanently delete this project and all of its conversations.": "姘镐箙鍒犻櫎褰撳墠椤圭洰鍙婂叾鍖呭惈鐨勬墍鏈夊巻鍙插璇濄€?,
    
    // Additional Agent Settings & Context Menu
    "Custom": "鑷畾涔?,
    "Outside of folders file access policy": "鏂囦欢澶瑰鏂囦欢璁块棶绛栫暐",
    "Configures how the agent tries to access files outside of its working folders.": "閰嶇疆鏅鸿兘浣撳浣曞皾璇曡闂叾宸ヤ綔鏂囦欢澶瑰閮ㄧ殑鏂囦欢銆?,
    "Terminal command Auto execution": "缁堢鍛戒护鑷姩鎵ц",
    "Controls whether terminal commands require your approval before running.": "鎺у埗缁堢鍛戒护鍦ㄨ繍琛屽墠鏄惁闇€瑕佹偍鎵瑰噯銆?,
    "Require Review": "闇€瑕佸鏍?,
    "Add Context": "娣诲姞涓婁笅鏂?,
    "Media": "濯掍綋",
    "Mentions": "鎻愬強",
    "Actions": "鎿嶄綔",
    "Browser": "娴忚鍣?,
    "Worktree": "宸ヤ綔鏍?,
    "Projects": "椤圭洰",
    "Review Changes": "瀹℃牳鏇存敼",
    "Ask anything, @ to mention, / for actions": "杈撳叆浠讳綍闂锛岃緭鍏?@ 鎻愬強锛? 瑙﹀彂鎿嶄綔",
    "Ask anything, @to mention, /for actions": "杈撳叆浠讳綍闂锛岃緭鍏?@ 鎻愬強锛? 瑙﹀彂鎿嶄綔",
    "Ask anything, @ to mention, / for commands": "杈撳叆浠讳綍闂锛岃緭鍏?@ 鎻愬強锛? 瑙﹀彂鍛戒护",
    "Ask anything, @to mention, /for commands": "杈撳叆浠讳綍闂锛岃緭鍏?@ 鎻愬強锛? 瑙﹀彂鍛戒护",
    "Overview": "姒傝",
    "Artifacts": "宸ヤ欢",
    "Conversations": "瀵硅瘽",
    "Agent settings and permissions for conversations outside of projects.": "椤圭洰澶栭儴瀵硅瘽鐨勬櫤鑳戒綋璁剧疆鍜屾潈闄愰厤缃€?,
    "Not in Project": "涓嶅湪椤圭洰涓?,
    "Manage project folders, agent settings, and permissions.": "绠＄悊椤圭洰鏂囦欢澶广€佹櫤鑳戒綋璁剧疆鍜屼笓灞炴潈闄愩€?,

    // Security Presets
    "Requires manual review for all terminal commands and file accesses outside of the working folders.": "杩愯缁堢鍛戒护浠ュ強璁块棶宸ヤ綔鍖哄鐨勬枃浠舵椂锛屽潎闇€鎵嬪姩浜哄伐瀹℃牳銆?,
    "Full Machine": "瀹屾暣鏈満璁块棶",
    "All terminal commands require review. The agent can read or write to any file in the machine.": "鎵€鏈夌粓绔懡浠ゅ潎闇€瀹℃牳锛屾櫤鑳戒綋鍙鍐欐湰鏈轰笂鐨勪换鎰忔枃浠躲€?,
    "Unrestricted": "鏃犻檺鍒舵ā寮?,
    "Disables all safety barriers for maximal iteration velocity.": "绂佺敤鎵€鏈夊畨鍏ㄥ睆闅滀互鑾峰緱鏋佽嚧鐨勮凯浠ｆ晥鐜囥€?,
    "Manually customize individual settings.": "鎵嬪姩鑷畾涔夊悇椤瑰叿浣撹缃€?,
    "Always Proceed": "鑷姩缁х画",

    // Themes
    "One Light": "One Light",
    "Solarized Light": "Solarized Light",
    "One Dark Pro": "One Dark Pro",
    
    // Models
    "Configure AI models and view your quota.": "閰嶇疆 AI 妯″瀷骞舵煡鐪嬫偍鐨勯厤棰濅笌鍙敤鐐规暟銆?,
    "Refresh": "鍒锋柊",
    "Model Credits": "妯″瀷棰濆害",
    "Enable AI Credit Overages": "鍏佽 AI 棰濆害瓒呴檺浣跨敤",
    "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.": "寮€鍚悗锛屽綋鎮ㄧ殑鍏嶈垂閰嶉鑰楀敖鏃讹紝Antigravity 灏嗕娇鐢ㄦ偍鐨?AI 鐐规暟鏉ユ弧瓒宠姹傘€傜郴缁熶細浼樺厛鎵ｉ櫎鍏嶈垂妯″瀷閰嶉锛岄厤棰濅笉瓒虫椂鍐嶄娇鐢ㄧ偣鏁般€?,
    "Model Quota": "妯″瀷閰嶉",
    "View your available model quota and AI credits. Model quota refreshes periodically based on your plan. Enable AI Credit Overages to continue using models when your quota is exhausted.": "鏌ョ湅鎮ㄧ殑鍙敤妯″瀷閰嶉涓?AI 璐︽埛棰濆害銆傛ā鍨嬮厤棰濅細鏍规嵁鎮ㄧ殑璁㈤槄璁″垝瀹氭湡鍒锋柊銆傞搴﹁€楀敖鍚庯紝鍙紑鍚?AI 棰濆害瓒呴檺浣跨敤浠ョ户缁綋楠屻€?,

    // Shortcuts & UI
    "Shortcuts": "蹇嵎閿?,
    "Keyboard shortcuts for quick navigation and control.": "鐢ㄤ簬蹇€熷鑸笌鎺у埗鐨勯敭鐩樺揩鎹烽敭銆?,
    "Recommended": "鎺ㄨ崘",
    "Open Conversation Picker": "鎵撳紑瀵硅瘽閫夋嫨鍣?,
    "Open File Search": "鎵撳紑鏂囦欢鎼滅储",
    "Focus Input": "鑱氱劍杈撳叆妗?,
    "New Conversation": "鏂板缓瀵硅瘽",
    "Navigation": "瀵艰埅",
    "Go Back": "鍚庨€€",
    "Go Forward": "鍓嶈繘",
    "File Picker": "鏂囦欢閫夋嫨鍣?,
    "Scheduled Tasks": "璁″垝浠诲姟",
    "Select Previous Conversation": "閫夋嫨涓婁竴涓璇?,
    "Select Next Conversation": "閫夋嫨涓嬩竴涓璇?,
    "Open Settings": "鎵撳紑璁剧疆",
    "Conversation": "瀵硅瘽",
    "Conversation History": "鍘嗗彶瀵硅瘽",
    "Conversation history": "鍘嗗彶瀵硅瘽",
    "Toggle Model Selector": "鍒囨崲妯″瀷閫夋嫨鍣?,
    "Toggle Voice Recording": "鍒囨崲褰曢煶",
    "Find in Pane": "鍦ㄧ獥鏍间腑鏌ユ壘",
    "Layout Controls": "甯冨眬鎺у埗",
    "Toggle Sidebar": "鍒囨崲渚ц竟鏍?,
    "Toggle Auxiliary Pane": "鍒囨崲杈呭姪绐楁牸",
    "Zoom In": "鏀惧ぇ",
    "Zoom Out": "缂╁皬",
    "Reset Zoom": "閲嶇疆缂╂斁",

    // Feedback
    "Provide Feedback": "鎻愪緵鍙嶉",
    "Feedback Type": "鍙嶉绫诲瀷",
    "Bug Report": "Bug 鎶ュ憡",
    "Feature Request": "鍔熻兘璇锋眰",
    "Auth and Billing": "璐﹀彿涓庤璐?,
    "General Feedback": "甯歌鍙嶉",
    "Please describe the feature you'd like to see. The more detailed the requirements, the easier it will be for our team to incorporate your ideas. Some helpful information includes:": "璇锋弿杩版偍甯屾湜鑾峰緱鐨勬柊鍔熻兘銆傞渶姹傛弿杩拌秺璇﹀敖锛屾垜浠殑鍥㈤槦灏辫秺瀹规槗閲囩撼鎮ㄧ殑鎯虫硶銆備互涓嬫槸涓€浜涘缓璁彁渚涚殑淇℃伅锛?,
    "What is missing in your workflow": "鎮ㄧ殑宸ヤ綔娴佷腑缂哄皯浜嗕粈涔?,
    "What you would like to see to address this gap in your workflow": "鎮ㄥ笇鏈涢€氳繃浠€涔堝姛鑳芥潵瑙ｅ喅杩欎竴闇€姹?,
    "How this feature would help you and other users": "姝ゅ姛鑳藉浣曞府鍔╂偍鍜屽叾浠栫敤鎴?,
    "Describe the feature you would like to see...": "璇锋弿杩版偍甯屾湜鑾峰緱鐨勬柊鍔熻兘...",
    "Attach a screenshot (optional)": "娣诲姞灞忓箷鎴浘锛堝彲閫夛級",
    "Attach Antigravity server logs": "闄勫甫 Antigravity 鏈嶅姟鍣ㄦ棩蹇?,
    "Send feedback as": "鍙戦€佸弽棣堣韩浠?,
    "We recommend attaching logs. Attaching logs will help the Antigravity team act on and prioritize your feedback.": "鎴戜滑寤鸿闄勫甫鏃ュ織銆傝繖灏嗘湁鍔╀簬 Antigravity 鍥㈤槦鏇村揩閫熴€佹洿鏈夐拡瀵规€у湴澶勭悊鎮ㄧ殑闂銆?,

    // Automatic Update Menus
    "Checking for Updates...": "姝ｅ湪妫€鏌ユ洿鏂?..",
    "Downloading Update...": "姝ｅ湪涓嬭浇鏇存柊...",
    "Restart to Update": "閲嶅惎浠ュ簲鐢ㄦ洿鏂?,
    "Check for Updates": "妫€鏌ユ洿鏂?,
    "No updates available": "褰撳墠宸叉槸鏈€鏂扮増鏈?,
    "Update available": "鍙戠幇鏂扮増鏈?,
    "Downloading...": "姝ｅ湪涓嬭浇...",
    "Update downloaded": "鏇存柊宸蹭笅杞藉畬鎴?,
    "Error checking for updates": "妫€鏌ユ洿鏂板け璐?,

    // Native sidebar items and UI
    "Global Settings": "鍏ㄥ眬璁剧疆",
    "Project-Level Settings": "椤圭洰绾ц缃?,
    "Model Selection": "妯″瀷閫夋嫨",
    "Tool Execution Policy": "宸ュ叿鎵ц绛栫暐",
    "Terminal Sandbox": "缁堢娌欑",
    "Non-Workspace File Access": "闈炲伐浣滃尯鏂囦欢璁块棶",
    "Internet Access Policy": "缃戠粶璁块棶绛栫暐",
    "Permission Grants": "鎺堟潈璁稿彲",
    "Command Allowlist / Denylist": "鍛戒护鐧藉悕鍗?榛戝悕鍗?,
    "Browser Allowlist": "娴忚鍣ㄧ櫧鍚嶅崟",
    "Artifact Review Mode": "鍒跺搧璇勫妯″紡",
    "Notifications": "绯荤粺閫氱煡",
    "App Settings": "搴旂敤璁剧疆",
    "File Access Policy": "鏂囦欢璁块棶绛栫暐",
    "Sandbox Mode": "娌欑妯″紡",
    "Auto-Execution Policy": "鑷姩鎵ц绛栫暐",
    "always-proceed": "鎬绘槸鍏佽 (涓嶆彁绀?",
    "request-review": "璇锋眰瀹℃煡 (姣忔鎻愮ず)",
    "strict": "涓ユ牸闄愬埗 (绂佹鎵ц)",
    "proceed-in-sandbox": "鍦ㄦ矙绠变腑鎵ц",
    "allow": "鍏佽",
    "ask": "璇㈤棶",
    "deny": "鎷掔粷",
    "THEME_MODE_LIGHT": "娴呰壊妯″紡",
    "THEME_MODE_DARK": "娣辫壊妯″紡",
    "THEME_MODE_INHERIT": "璺熼殢绯荤粺",
    "Theme Mode": "涓婚妯″紡",
    "Keep computer awake": "闃叉鐢佃剳浼戠湢",
    "Run in background": "鍚庡彴杩愯",
    "Auto-check for updates": "鑷姩妫€鏌ユ洿鏂?,
    "Ask Antigravity...": "鍚?Antigravity 鎻愰棶...",
    "Type a message...": "杈撳叆娑堟伅...",
    "Ask anything, @ to mention, / for actions": "杈撳叆闂锛岃緭鍏?@ 鎻愬強锛? 鎵ц鍔ㄤ綔",
    "Approved": "宸叉壒鍑?,
    "Proceed": "缁х画",
    "Wait": "绛夊緟",
    "Done": "瀹屾垚",
    "Show logs": "鏄剧ず鏃ュ織",
    "Clear": "娓呯┖",
    "Reset": "閲嶇疆",
    "Apply": "搴旂敤",
    "Create": "鍒涘缓",
    "Add": "娣诲姞",
    "Remove": "绉婚櫎",
    "View": "鏌ョ湅",
    "Folders": "鏂囦欢澶?,
    "Subagents": "瀛愭櫤鑳戒綋",
    "Background Tasks": "鍚庡彴浠诲姟",
    "Files Changed": "鏂囦欢鍙樻洿",
    "Terminals": "缁堢鍒楄〃",
    "Create New Task": "鍒涘缓鏂颁换鍔?,
    "Cron Expression": "Cron 琛ㄨ揪寮?,
    "Duration (Seconds)": "鏃堕暱 (绉?",
    "Task Prompt": "浠诲姟鎻愮ず璇?,
    "Active Tasks": "娲诲姩涓殑浠诲姟",
    "Task History": "浠诲姟鍘嗗彶",
    "No active tasks": "娌℃湁杩愯涓殑浠诲姟",
    "No scheduled tasks": "娌℃湁璁″垝涓殑浠诲姟",
    "Delete Task": "鍒犻櫎浠诲姟",
    "Skills": "鎶€鑳?(Skills)",
    "Rules": "瑙勫垯 (Rules)",
    "Plugins": "鎻掍欢 (Plugins)",
    "MCP Servers": "MCP 鏈嶅姟绔?,
    "Add MCP Server": "娣诲姞 MCP 鏈嶅姟绔?,
    "Name": "鍚嶇О",
    "Type": "绫诲瀷",
    "Arguments": "鍙傛暟",
    "Environment Variables": "鐜鍙橀噺",
    "Active": "娲昏穬",
    "Inactive": "鏈椿璺?,
    "Select Workspace": "閫夋嫨宸ヤ綔鍖?,
    "Please visit the following URL to authorize.": "璇疯闂互涓嬬綉鍧€杩涜鎺堟潈銆?,
    "After authorizing, paste the authorization code below.": "鎺堟潈鍚庯紝鍦ㄤ笅鏂圭矘璐存巿鏉冪爜銆?,
    "Install IDE": "瀹夎 IDE",
    "Recent Conversations": "鏈€杩戠殑瀵硅瘽",
    "Clear Chat History": "娓呯┖鑱婂ぉ璁板綍",
    "Show Less": "鏀惰捣",
    "Show More": "灞曞紑",
    "Copied!": "宸插鍒讹紒",
    "Selected": "宸查€夋嫨",
    "Select...": "閫夋嫨...",
    "Submit": "鍙戦€?,
    "Back": "杩斿洖",
    "Next": "涓嬩竴姝?,
    "Finish": "瀹屾垚",
    "Loading...": "鍔犺浇涓?..",
    "No items found": "鏈壘鍒伴」",
    // Model quota page translations
    "Weekly Limit": "姣忓懆棰濆害闄愰",
    "Five Hour Limit": "浜斿皬鏃堕搴﹂檺棰?,
    "Claude and GPT models": "Claude 涓?GPT 妯″瀷",
    "Within each group, models share a weekly limit and a 5-hour limit. Quota is consumed proportionally to the cost of the tokens. Thus, limits will last longer with shorter tasks or using more cost-effective models. The 5-hour limit smooths out aggregate demand to fairly distribute global capacity across all users, while your weekly limit is tied directly to your individual tier.": "鍦ㄦ瘡涓粍鍐咃紝妯″瀷鍏变韩姣忓懆闄愰鍜?5 灏忔椂闄愰銆傞搴︽秷鑰楁瘮渚嬪彇鍐充簬 Token 鐨勬垚鏈€傚洜姝わ紝瀵逛簬杈冪煭鐨勪换鍔℃垨浣跨敤鏇村叿鎬т环姣旂殑妯″瀷锛岄搴︽寔缁椂闂存洿闀裤€? 灏忔椂闄愰鍙钩婊戞€讳綋闇€姹傦紝浠ュ叕骞冲湴鍦ㄦ墍鏈夌敤鎴蜂箣闂村垎閰嶅叏灞€瀹归噺锛岃€屾偍鐨勬瘡鍛ㄩ檺棰濆垯鐩存帴涓庢偍鐨勪釜浜虹骇鍒寕閽┿€?,
    // Display options popover menu translations
    "Display Options": "鏄剧ず閫夐」",
    "Group By": "鍒嗙粍鏂瑰紡",
    "Project": "椤圭洰",
    "Environment": "鐜",
    "Sort Conversations": "瀵硅瘽鎺掑簭",
    "Last Updated": "鏈€杩戞洿鏂?,
    "Alphabetical (A-Z)": "瀛楁瘝椤哄簭 (A-Z)",
    "Date Added": "娣诲姞鏃ユ湡",
    "Subtitles": "鍓爣棰?,
    "No Subtitle": "涓嶆樉绀哄壇鏍囬",
    "Scheduled": "宸茶鍒?,
    "None": "鏃?,
    "Sort": "鎺掑簭",
    
    // Comprehensive Community MCP Server Catalog Translations
    "Interact with your BigQuery data using natural language. This MCP server allows you to securely connect to your datasets to search the datasets, inspect table metadata, execute SQL queries, generate time-series forecasts, and perform contribution analysis directly from your AI tools.": "浣跨敤鑷劧璇█涓庢偍鐨?BigQuery 鏁版嵁杩涜浜や簰銆傝 MCP 鏈嶅姟绔厑璁告偍瀹夊叏鍦拌繛鎺ュ埌鏁版嵁闆嗕互鎼滅储鏁版嵁闆嗐€佹鏌ユ暟鎹〃鍏冩暟鎹€佹墽琛?SQL 鏌ヨ銆佺敓鎴愭椂闂村簭鍒楅娴嬪苟鐩存帴浠庢偍鐨?AI 宸ュ叿涓繘琛岃础鐚垎鏋愩€?,
    "The AlloyDB for PostgreSQL remote MCP server lets you access and run AlloyDB tools to manage AlloyDB clusters and instances, manage users, create and restore backups, administer users, import and export data, and run SQL queries from your AI-enabled development environments and AI agent platforms.": "AlloyDB for PostgreSQL 杩滅▼ MCP 鏈嶅姟绔紝鍏佽鎮ㄨ闂拰杩愯 AlloyDB 宸ュ叿锛屼互渚夸粠鎮ㄧ殑 AI 杈呭姪寮€鍙戠幆澧冨拰 AI 鏅鸿兘浣撳钩鍙颁腑绠＄悊 AlloyDB 闆嗙兢鍜屽疄渚嬨€佺鐞嗙敤鎴枫€佸垱寤哄拰鎭㈠澶囦唤銆佺鐞嗙敤鎴枫€佸鍏ュ拰瀵煎嚭鏁版嵁骞惰繍琛?SQL 鏌ヨ銆?,
    "The Bigtable Admin remote MCP server lets you manage Bigtable resources.": "Bigtable Admin 杩滅▼ MCP 鏈嶅姟绔紝鍏佽鎮ㄧ鐞?Bigtable 璧勬簮銆?,
    "The Cloud SQL remote MCP server lets you access and run Cloud SQL tools to manage Cloud SQL instances, manage users, create and restore backups, administer users, import and export data, and run SQL queries from your AI-enabled development environments and AI agent platforms.": "Cloud SQL 杩滅▼ MCP 鏈嶅姟绔紝鍏佽鎮ㄨ闂拰杩愯 Cloud SQL 宸ュ叿锛屼互渚夸粠鎮ㄧ殑 AI 杈呭姪寮€鍙戠幆澧冨拰 AI 鏅鸿兘浣撳钩鍙颁腑绠＄悊 Cloud SQL 瀹炰緥銆佺鐞嗙敤鎴枫€佸垱寤哄拰鎭㈠澶囦唤銆佺鐞嗙敤鎴枫€佸鍏ュ拰瀵煎嚭鏁版嵁骞惰繍琛?SQL 鏌ヨ銆?,
    "The Spanner remote MCP server lets you access and run Spanner tools to create, manage, and query Spanner resources from your AI-enabled development environments and AI agent platforms.": "Spanner 杩滅▼ MCP 鏈嶅姟绔紝鍏佽鎮ㄨ闂?and 杩愯 Spanner 宸ュ叿锛屼互渚夸粠鎮ㄧ殑 AI 杈呭姪寮€鍙戠幆澧冨拰 AI 鏅鸿兘浣撳钩鍙颁腑鍒涘缓銆佺鐞嗗拰鏌ヨ Spanner 璧勬簮銆?,
    "Connect your AI assistants to Looker business intelligence. This MCP server enables data exploration and content management by allowing you to execute natural language queries, run saved Looks, create and manage dashboards, and perform instance health checks within your Looker environment.": "灏嗘偍鐨?AI 鍔╂墜杩炴帴鍒?Looker 鍟嗕笟鏅鸿兘銆傝 MCP 鏈嶅姟绔€氳繃鍏佽鎮ㄥ湪 Looker 鐜涓墽琛岃嚜鐒惰瑷€鏌ヨ銆佽繍琛屽凡瀛樼殑 Looks銆佸垱寤哄拰绠＄悊浠〃鏉夸互鍙婃墽琛屽疄渚嬪仴搴锋鏌ワ紝鏉ュ疄鐜版暟鎹帰绱笌鍐呭绠＄悊銆?,
    "Connect your AI assistants to the Knowledge Catalog (formerly known as Dataplex). This MCP server enables data discovery and governance by allowing you to search for data assets, retrieve detailed metadata such as schemas and ownership, and explore aspect types across your distributed data.": "灏嗘偍鐨?AI 鍔╂墜杩炴帴鍒扮煡璇嗙洰褰?(Knowledge Catalog锛屽墠韬负 Dataplex)銆傝 MCP 鏈嶅姟绔€氳繃鍏佽鎮ㄦ悳绱㈡暟鎹祫浜с€佹绱㈣缁嗗厓鏁版嵁锛堝 Schema 鍜屾墍鏈夋潈锛変互鍙婃帰绱㈠垎甯冨紡鏁版嵁涓殑鍒囬潰绫诲瀷锛屾潵鍚敤鏁版嵁鍙戠幇涓庢暟鎹不鐞嗐€?,
    "Interact with your Oracle Database data using natural language. This MCP server allows you to securely connect to your databases for executing SQL queries, inspecting table schemas, and troubleshooting database performance issues directly from your AI tools.": "浣跨敤鑷劧璇█涓庢偍鐨?Oracle 鏁版嵁搴撴暟鎹繘琛屼氦浜掋€傝 MCP 鏈嶅姟绔厑璁告偍瀹夊叏鍦拌繛鎺ュ埌鏁版嵁搴擄紝浠ヤ究鐩存帴浠庢偍鐨?AI 宸ュ叿涓墽琛?SQL 鏌ヨ銆佹鏌ユ暟鎹〃 Schema 骞舵帓鏌ユ暟鎹簱鎬ц兘闂銆?,
    "The Dev Mode MCP Server brings Figma directly into your workflow by providing important design information and context to AI agents generating code from Figma design files.": "Dev Mode MCP 鏈嶅姟绔€氳繃鍚戞牴鎹?Figma 璁捐鏂囦欢鐢熸垚浠ｇ爜鐨?AI 鏅鸿兘浣撴彁渚涘叧閿殑璁捐淇℃伅鍜屼笂涓嬫枃锛屽皢 Figma 鐩存帴寮曞叆鎮ㄧ殑宸ヤ綔娴併€?,
    "The GitHub MCP Server is a Model Context Protocol (MCP) server that provides seamless integration with GitHub APIs, enabling advanced automation and interaction capabilities for developers and tools.": "GitHub MCP 鏈嶅姟绔槸涓€涓ā鍨嬩笂涓嬫枃鍗忚 (MCP) 鏈嶅姟绔紝鎻愪緵涓?GitHub API 鐨勬棤缂濋泦鎴愶紝涓哄紑鍙戜汉鍛樺拰宸ュ叿鍚敤楂樼骇鑷姩鍖栦笌浜や簰鑳藉姏銆?,
    "Neon MCP Server is an open-source tool that lets you interact with your Neon Postgres databases in natural language.": "Neon MCP 鏈嶅姟绔槸涓€涓紑婧愬伐鍏凤紝鍏佽鎮ㄤ娇鐢ㄨ嚜鐒惰瑷€涓庢偍鐨?Neon Postgres 鏁版嵁搴撹繘琛屼氦浜掋€?,
    "The Stripe Model Context Protocol server allows you to integrate with Stripe APIs through function calling. This protocol supports various tools to interact with different Stripe services.": "Stripe 妯″瀷涓婁笅鏂囧崗璁?(MCP) 鏈嶅姟绔厑璁告偍閫氳繃鍑芥暟璋冪敤涓?Stripe API 闆嗘垚銆傝鍗忚鏀寔澶氱宸ュ叿鏉ヤ笌涓嶅悓鐨?Stripe 鏈嶅姟杩涜浜や簰銆?,
    "Interact with Redis key-value stores": "涓?Redis 閿€煎瓨鍌ㄨ繘琛屼氦浜?,
    "A Model Context Protocol server for interacting with MongoDB Atlas.": "鐢ㄤ簬涓?MongoDB Atlas 杩涜浜や簰鐨勬ā鍨嬩笂涓嬫枃鍗忚 (MCP) 鏈嶅姟绔€?,
    "Official Notion MCP Server that allows interaction with Notion workspaces, pages, databases, and comments via the Notion API.": "瀹樻柟 Notion MCP 鏈嶅姟绔紝鍏佽閫氳繃 Notion API 涓?Notion 宸ヤ綔鍖恒€侀〉闈€佹暟鎹簱鍜岃瘎璁鸿繘琛屼氦浜掋€?,
    "Official Linear.app MCP Server for interacting with Linear projects, issues, and workflows.": "瀹樻柟 Linear.app MCP 鏈嶅姟绔紝鐢ㄤ簬涓?Linear 椤圭洰銆佷簨鍔?(Issues) 鍜屽伐浣滄祦杩涜浜や簰銆?,
    "An MCP server implementation that integrates the Perplexity Sonar API to provide real-time, web-wide research capabilities.": "闆嗘垚浜?Perplexity Sonar API 鐨?MCP 鏈嶅姟绔疄鐜帮紝鎻愪緵瀹炴椂鐨勫叏缃戞悳绱笌璋冪爺鑳藉姏銆?,
    "Official PayPal MCP Server that allows integration with PayPal APIs for payment processing, transaction management, and account operations.": "瀹樻柟 PayPal MCP 鏈嶅姟绔紝鍏佽涓?PayPal API 闆嗘垚锛岀敤浜庝粯娆惧鐞嗐€佷氦鏄撶鐞嗗拰璐︽埛鎿嶄綔銆?,
    "The Heroku Platform MCP Server enables seamless interaction with Heroku Platform resources, allowing LLMs to read, manage, and operate applications, add-ons, databases, and more.": "Heroku 骞冲彴 MCP 鏈嶅姟绔紝鎻愪緵涓?Heroku 骞冲彴璧勬簮鐨勬棤缂濅氦浜掞紝鍏佽澶ц瑷€妯″瀷 (LLM) 璇诲彇銆佺鐞嗗拰杩愯搴旂敤绋嬪簭銆佹彃浠躲€佹暟鎹簱绛夈€?,
    "The Pinecone MCP Server enables AI tools to search Pinecone documentation, configure indexes, generate code informed by your index configuration, and upsert/search data in your Pinecone indexes.": "Pinecone MCP 鏈嶅姟绔紝鍏佽 AI 宸ュ叿鎼滅储 Pinecone 鏂囨。銆侀厤缃储寮曘€佹牴鎹偍鐨勭储寮曢厤缃敓鎴愮浉鍏充唬鐮侊紝浠ュ強鍦?Pinecone 绱㈠紩涓洿鏂?(Upsert)/鎼滅储鏁版嵁銆?,
    "Connect your Supabase projects to AI assistants. This MCP server allows managing tables, fetching config, executing SQL queries, managing edge functions, and working with database schema in your Supabase projects.": "灏嗘偍鐨?Supabase 椤圭洰杩炴帴鍒?AI 鍔╂墜銆傝 MCP 鏈嶅姟绔厑璁稿湪鎮ㄧ殑 Supabase 椤圭洰涓鐞嗚〃銆佽幏鍙栭厤缃€佹墽琛?SQL 鏌ヨ銆佺鐞?Edge 鍑芥暟浠ュ強澶勭悊鏁版嵁搴?Schema銆?,
    "The Prisma MCP Server enables AI tools to interact with Prisma for creating and managing Postgres databases easily.": "Prisma MCP 鏈嶅姟绔紝鍏佽 AI 宸ュ叿涓?Prisma 杩涜浜や簰锛屼互杞绘澗鍒涘缓鍜岀鐞?Postgres 鏁版嵁搴撱€?,
    "The Locofy MCP Server enables Locofy.ai code to be integrated and extended with your IDE.": "Locofy MCP 鏈嶅姟绔紝鍏佽 Locofy.ai 浠ｇ爜涓庢偍鐨?IDE 杩涜闆嗘垚鍜屾墿灞曘€?,
    "Airweave lets agents search any app.": "Airweave 鍏佽鏅鸿兘浣撴悳绱换浣曞簲鐢ㄧ▼搴忋€?,
    "Atlassian MCP Server for interacting with Atlassian products.": "Atlassian MCP 鏈嶅姟绔紝鐢ㄤ簬涓?Atlassian 浜у搧杩涜浜や簰銆?,
    "Interact with your Harness account using natural language. This MCP server lets AI agents inspect and manage CI/CD pipelines, executions, services, environments, connectors, feature flags, cloud costs, security findings, chaos experiments, and other Harness platform resources.": "浣跨敤鑷劧璇█涓庢偍鐨?Harness 璐︽埛杩涜浜や簰銆傝 MCP 鏈嶅姟绔厑璁?AI 鏅鸿兘浣撴鏌ュ拰绠＄悊 CI/CD 娴佹按绾裤€佹墽琛屻€佹湇鍔°€佺幆澧冦€佽繛鎺ュ櫒銆佺壒鎬ф爣蹇椼€佷簯鎴愭湰銆佸畨鍏ㄥ彂鐜般€佹贩娌屽疄楠屼互鍙婂叾浠?Harness 骞冲彴璧勬簮銆?,
    "SonarQube MCP Server enables AI assistants to interact with SonarQube instances for code quality analysis, project management, and quality gate operations.": "SonarQube MCP 鏈嶅姟绔紝鍏佽 AI 鍔╂墜涓?SonarQube 瀹炰緥杩涜浜や簰锛岃繘琛屼唬鐮佽川閲忓垎鏋愩€侀」鐩鐞嗗拰璐ㄩ噺闃€闂?(Quality Gate) 鎿嶄綔銆?,
    "Netlify MCP Server enables AI assistants to interact with Netlify's platform for managing sites, deployments, domains, and other web development workflows.": "Netlify MCP 鏈嶅姟绔紝鍏佽 AI 鍔╂墜涓?Netlify 骞冲彴杩涜浜や簰锛岀鐞嗙珯鐐广€侀儴缃层€佸煙鍚嶅強鍏朵粬 Web 寮€鍙戝伐浣滄祦銆?,
    "A Model Context Protocol server that provides structured thinking and reasoning capabilities for LLM conversations.": "涓哄ぇ璇█妯″瀷 (LLM) 瀵硅瘽鎻愪緵缁撴瀯鍖栨€濊€冧笌鎺ㄧ悊鑳藉姏鐨勬ā鍨嬩笂涓嬫枃鍗忚 (MCP) 鏈嶅姟绔€?,
    "Sonatype MCP server for interacting with our dependency management and security intelligence platform.": "Sonatype MCP 鏈嶅姟绔紝鐢ㄤ簬涓庢垜浠殑渚濊禆椤圭鐞嗗拰瀹夊叏鎯呮姤骞冲彴杩涜浜や簰銆?,
    "The Google Maps Platform Code Assist MCP server provides your favorite AI coding assistant with up-to-date, official Google Maps Platform documentation, code samples, and best practices. By grounding your AI assistant in our official resources, it can generate more accurate, reliable, and useful code.": "Google Maps Platform Code Assist MCP 鏈嶅姟绔紝涓烘偍鍠滅埍鐨?AI 缂栫爜鍔╂墜鎻愪緵鏈€鏂般€佸畼鏂圭殑 Google 鍦板浘骞冲彴鏂囨。銆佷唬鐮佺ず渚嬪拰鏈€浣冲疄璺点€傞€氳繃璁?AI 鍔╂墜鍩轰簬瀹樻柟璧勬簮寮€灞曞伐浣滐紝瀹冭兘鐢熸垚鏇寸簿纭€佸彲闈犲拰瀹炵敤鐨勪唬鐮併€?,
    "This MCP server provides your LLM with docs and examples to instrument your AI apps with Arize AX. It also provides access to Arize support. Connect it to your IDE or LLM and get curated tracing examples, best practices and Arize support!": "姝?MCP 鏈嶅姟绔负鎮ㄧ殑 LLM 鎻愪緵鏂囨。鍜岀ず渚嬶紝浠ヤ究浣跨敤 Arize AX 鎻掓々鎮ㄧ殑 AI 搴旂敤銆傚畠杩樻彁渚涗簡鑾峰彇 Arize 鏀寔鐨勯€氶亾銆傚皢鍏惰繛鎺ュ埌鎮ㄧ殑 IDE 鎴?LLM锛岃幏鍙栫簿閫夌殑杩借釜绀轰緥銆佹渶浣冲疄璺靛拰 Arize 鎶€鏈敮鎸侊紒",
    "The Postman MCP Server connects Postman to AI tools, giving AI agents and assistants the ability to access workspaces, manage collections and environments, evaluate APIs, and automate workflows through natural language interactions.": "Postman MCP 鏈嶅姟绔皢 Postman 杩炴帴鍒?AI 宸ュ叿锛屼负 AI 鏅鸿兘浣撳拰鍔╂墜鎻愪緵璁块棶宸ヤ綔鍖恒€佺鐞嗛泦鍚?(Collections) 鍜岀幆澧冦€佽瘎浼?API 浠ュ強閫氳繃鑷劧璇█浜や簰瀹炵幇宸ヤ綔娴佽嚜鍔ㄥ寲鐨勮兘鍔涖€?,
    "The Stitch MCP server enables AI assistants to interact with Stitch for vibe design: generating UI designs from text and images, and accessing project and screen details. See https://stitch.withgoogle.com/docs for more details.": "Stitch MCP 鏈嶅姟绔紝鍏佽 AI 鍔╂墜涓?Stitch 浜や簰浠ヨ繘琛岃瑙夎璁★細鏍规嵁鏂囨湰鍜屽浘鍍忕敓鎴?UI 璁捐锛屼互鍙婅闂」鐩笌灞忓箷璇︽儏銆傝瑙?https://stitch.withgoogle.com/docs銆?,
    "The Google Developer Knowledge MCP server gives AI-powered development tools the ability to search Google's official developer documentation and retrieve information for Google's products such as Firebase, Google Cloud, Android, Maps, and more. By connecting your AI application straight to our official library of documentation, it ensures the code and guidance you receive are up-to-date and based on authoritative context.": "Google Developer Knowledge MCP 鏈嶅姟绔紝涓?AI 杈呭姪寮€鍙戝伐鍏锋彁渚涙悳绱?Google 瀹樻柟寮€鍙戣€呮枃妗ｅ苟妫€绱?Google 浜у搧锛堝 Firebase銆丟oogle Cloud銆丄ndroid銆丮aps 绛夛級淇℃伅鐨勮兘鍔涖€傞€氳繃灏嗘偍鐨?AI 搴旂敤鐩存帴杩炴帴鍒版垜浠殑瀹樻柟鏂囨。搴擄紝纭繚鎮ㄦ敹鍒扮殑浠ｇ爜鍜屾寚瀵兼槸鏈€鏂颁笖鏉冨▉鐨勩€?,
    "The ClickHouse MCP server enables agents to securely interact with ClickHouse databases. It provides a universal interface to execute SQL, explore data, and view backup & billing details, allowing agentic tooling to leverage ClickHouse's high-performance analytical capabilities.": "ClickHouse MCP 鏈嶅姟绔紝鍏佽鏅鸿兘浣撳畨鍏ㄥ湴涓?ClickHouse 鏁版嵁搴撹繘琛屼氦浜掋€傚畠鎻愪緵浜嗕竴涓€氱敤鐨勬帴鍙ｆ潵鎵ц SQL銆佹帰绱㈡暟鎹互鍙婃煡鐪嬪浠戒笌璁¤垂淇℃伅锛屼娇鏅鸿兘浣撳伐鍏疯兘澶熷厖鍒嗗埄鐢?ClickHouse 楂樻€ц兘鐨勫垎鏋愯兘鍔涖€?,
    "Perform a range of infrastructure management tasks, including: manage virtual machine (VM) instances, manage instance group managers and instance templates, manage disks and snapshots, retrieve information about reservations and commitments.": "鎵ц涓€绯诲垪鍩虹璁炬柦绠＄悊浠诲姟锛屽寘鎷細绠＄悊铏氭嫙鏈?(VM) 瀹炰緥銆佺鐞嗗疄渚嬬粍绠＄悊鍣ㄥ拰瀹炰緥妯℃澘銆佺鐞嗙鐩樹笌蹇収銆佹绱㈡湁鍏抽鐣欏拰鎵胯鐨勪俊鎭€?,
    "Access enterprise mobility data using natural language queries about device fleets, automated auditing of policy compliance, and the integration of device management data into broader automated workflows.": "浣跨敤鑷劧璇█鏌ヨ鍏充簬璁惧缇ゃ€佽嚜鍔ㄥ鏍告斂绛栧悎瑙勬€э紝骞跺皢璁惧绠＄悊鏁版嵁闆嗘垚鍒版洿骞挎硾鐨勮嚜鍔ㄥ寲宸ヤ綔娴佷腑锛屼互璁块棶浼佷笟绉诲姩鏁版嵁銆?,
    "Search your Google Cloud projects using natural language.": "浣跨敤鑷劧璇█鎼滅储鎮ㄧ殑 Google Cloud 椤圭洰銆?,
    "Perform searches on ingested data in Google-owned data stores.": "瀵?Google 鎷ユ湁鐨勬暟鎹瓨鍌ㄤ腑鎽勫彇鐨勬暟鎹墽琛屾悳绱€?,
    "Interact with documents stored in a Firestore database using natural language.": "浣跨敤鑷劧璇█涓?Firestore 鏁版嵁搴撲腑瀛樺偍鐨勬枃妗ｈ繘琛屼氦浜掋€?,
    "Access resources in the Cloud Logging platform using natural language.": "浣跨敤鑷劧璇█璁块棶 Cloud Logging 骞冲彴涓殑璧勬簮銆?,
    "Manage clusters for Managed Service for Apache Kafka and Kafka Connect using natural language.": "浣跨敤鑷劧璇█绠＄悊 Managed Service for Apache Kafka 鍜?Kafka Connect 鐨勯泦缇ゃ€?,
    "Access resources in the Cloud Monitoring platform using natural language.": "浣跨敤鑷劧璇█璁块棶 Cloud Monitoring 骞冲彴涓殑璧勬簮銆?,
    "Manage Pub/Sub resources and publish messages. Create, list, get, update, and delete Pub/Sub topics, subscriptions, and snapshots, as well as publish messages to topics.": "绠＄悊 Pub/Sub 璧勬簮骞跺彂甯冩秷鎭€傚垱寤恒€佸垪鍑恒€佽幏鍙栥€佹洿鏂板拰鍒犻櫎 Pub/Sub 涓婚銆佽闃呭強蹇収锛屼互鍙婂悜涓婚鍙戝竷娑堟伅銆?,
    "Enable Antigravity to control and inspect a live Chrome browser, with access to the full power of Chrome DevTools for reliable automation, in-depth debugging, and performance analysis.": "鍏佽 Antigravity 鎺у埗骞舵鏌ユ鍦ㄨ繍琛岀殑 Chrome 娴忚鍣紝璁块棶瀹屾暣鐨?Chrome 寮€鍙戣€呭伐鍏凤紝浠ュ疄鐜板彲闈犵殑鑷姩鍖栥€佹繁搴︾殑璋冭瘯鍜屾€ц兘鍒嗘瀽銆?
  };

  const coreWords = {
    "create": "鍒涘缓", "delete": "鍒犻櫎", "new": "鏂板缓", "edit": "缂栬緫", "save": "淇濆瓨", "cancel": "鍙栨秷", "confirm": "纭",
    "close": "鍏抽棴", "open": "鎵撳紑", "stop": "鍋滄", "start": "鍚姩", "run": "杩愯", "add": "娣诲姞", "remove": "绉婚櫎",
    "update": "鏇存柊", "select": "閫夋嫨", "clear": "娓呴櫎", "search": "鎼滅储", "find": "鏌ユ壘", "view": "鏌ョ湅", "show": "鏄剧ず", "hide": "闅愯棌",
    "agent": "鏅鸿兘浣?, "agents": "鏅鸿兘浣?, "subagent": "瀛愭櫤鑳戒綋", "subagents": "瀛愭櫤鑳戒綋", "task": "浠诲姟", "tasks": "浠诲姟",
    "workspace": "宸ヤ綔鍖?, "workspaces": "宸ヤ綔鍖?, "directory": "鐩綍", "folder": "鏂囦欢澶?, "file": "鏂囦欢", "files": "鏂囦欢",
    "command": "鍛戒护", "commands": "鍛戒护", "terminal": "缁堢", "console": "鎺у埗鍙?, "output": "杈撳嚭", "input": "杈撳叆",
    "log": "鏃ュ織", "logs": "鏃ュ織", "setting": "璁剧疆", "settings": "璁剧疆", "preference": "鍋忓ソ", "preferences": "鍋忓ソ",
    "theme": "涓婚", "themes": "涓婚", "model": "妯″瀷", "models": "妯″瀷", "capability": "鑳藉姏", "capabilities": "鑳藉姏",
    "running": "杩愯涓?, "completed": "宸插畬鎴?, "failed": "宸插け璐?, "pending": "绛夊緟涓?, "success": "鎴愬姛", "error": "閿欒",
    "system": "绯荤粺", "prompt": "鎻愮ず璇?, "instructions": "鎸囦护", "description": "鎻忚堪", "name": "鍚嶇О", "version": "鐗堟湰",
    "active": "娲昏穬", "background": "鍚庡彴", "parent": "鐖剁骇", "child": "瀛愮骇", "branch": "鍒嗘敮", "share": "鍏变韩", "inherit": "缁ф壙",
    "original": "鍘熷", "backup": "澶囦唤", "duration": "鎸佺画鏃堕棿", "seconds": "绉?, "timer": "瀹氭椂鍣?, "timers": "瀹氭椂鍣?,
    "schedule": "璋冨害", "cron": "瀹氭椂浠诲姟", "tools": "宸ュ叿", "tool": "宸ュ叿", "execute": "鎵ц", "execution": "鎵ц", "plan": "璁″垝",
    "chat": "鑱婂ぉ", "message": "娑堟伅", "messages": "娑堟伅", "history": "鍘嗗彶", "clear history": "娓呴櫎鍘嗗彶",
    "worked": "宸ヤ綔浜?, "changed": "宸叉洿鏀?, "review": "瀹℃牳", "reviewing": "瀹℃牳涓?, "reviewed": "宸插鏍?, "for": "鎸佺画",
    "thought": "鎬濊€冧簡", "edited": "缂栬緫浜?, "canceled": "宸插彇娑?, "js": "Js",
    "explore": "鎺㈢储", "explored": "娴忚浜?, "change": "鏇存敼", "changes": "鏇存敼",
    "turn": "鍥炲悎", "turns": "鍥炲悎"
  };

  const combinedDict = Object.assign({}, coreWords, dictionary);

  const substringReplacements = [
    { search: 'Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products. You can always change your choices in Settings.', replace: '鎻掍欢鏄寘鍚妧鑳藉拰 MCP 鏈嶅姟灏佽鐨勮祫婧愬寘锛屾棬鍦ㄥ崗鍔?Antigravity 鏅鸿兘浣撹皟鐢?Google 寮€鍙戣€呬骇鍝併€傛偍闅忔椂鍙互鍦ㄨ缃腑鏇存敼閫夋嫨銆? },
    { search: 'Plugins are packaged collections of skills and MCPs to help the Agent', replace: '鎻掍欢鏄寘鍚妧鑳藉拰 MCP 鏈嶅姟灏佽鐨勮祫婧愬寘锛屾棬鍦ㄥ崗鍔╂櫤鑳戒綋' },
    { search: 'in Antigravity', replace: '鍦?Antigravity 涓? },
    { search: 'work with Google', replace: '璋冪敤 Google' },
    { search: 'developer products.', replace: '寮€鍙戣€呬骇鍝併€? },
    { search: 'Developer products.', replace: '寮€鍙戣€呬骇鍝併€? },
    { search: 'You can always change your choices in Settings.', replace: '鎮ㄩ殢鏃跺彲浠ュ湪璁剧疆涓洿鏀归€夋嫨銆? },
    { search: 'Reliable automation, in-depth debugging, and performance analysis in Chrome using Chrome DevTools and Puppeteer', replace: '鍦?Chrome 娴忚鍣ㄤ腑鍒╃敤 DevTools 璋冭瘯鍗忚涓?Puppeteer 瀹炵幇楂樺彲闈犳€ц嚜鍔ㄥ寲銆佹繁搴﹁皟璇曞強鎬ц兘鍓栨瀽' },
    { search: 'Dart and Flutter', replace: 'Dart & Flutter' },
    { search: 'Skills providing tailored instructions for happy path Dart & Flutter development workflows.', replace: '閽堝 Dart & Flutter 鍩虹鍙婂父鐢ㄥ紑鍙戝伐浣滄祦鎻愪緵瀹氬埗鍖栫殑鏅鸿兘浣撴寚浠ら泦鏀寔銆? },
    { search: 'Configure the browser subagent. Running this feature requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.', replace: '閰嶇疆娴忚鍣ㄥ瓙鏅鸿兘浣撱€傝繍琛屾鍔熻兘闇€瑕佸畨瑁?Google Chrome 娴忚鍣ㄣ€傚彲浠ラ€氳繃鍦ㄥ璇濊緭鍏ユ涓緭鍏?/browser 鏉ヨ皟鐢ㄦ祻瑙堝櫒瀛愭櫤鑳戒綋銆? },
    { search: 'Configure the browser subagent. Running this feature requires', replace: '閰嶇疆娴忚鍣ㄥ瓙鏅鸿兘浣撱€傝繍琛屾鍔熻兘闇€瑕佸畨瑁? },
    { search: 'to be installed', replace: '鍗冲彲' },
    { search: 'The browser subagent can be invoked by typing', replace: '鍙互閫氳繃鍦ㄥ璇濊緭鍏ユ涓緭鍏? },
    { search: 'in the conversation input box.', replace: '鏉ヨ皟鐢ㄦ祻瑙堝櫒鏅鸿兘浣撱€? },
    { search: 'Browser Actuation Permissions', replace: '娴忚鍣ㄥ姩浣滄墽琛屾潈闄? },
    { search: 'Allow/deny agent browser actuation access to specific URLs.', replace: '鍏佽鎴栭樆姝㈡櫤鑳戒綋鍦ㄦ祻瑙堝櫒涓搷浣滆闂壒瀹氱殑 URL 鍦板潃鍒楄〃銆? },
    { search: 'Download', replace: '涓嬭浇' },
    { search: 'Search MCP servers by name', replace: '鎸夊悕绉版悳绱?MCP 鏈嶅姟绔? },
    { search: 'Interact with the Dux platform using natural language. This MCP server enables agentic capabilities for account clients.', replace: '浣跨敤鑷劧璇█涓?Dux 骞冲彴杩涜浜や簰銆傝 MCP 鏈嶅姟绔负璐︽埛瀹㈡埛绔惎鐢ㄤ簡鏅鸿兘浣撳姛鑳姐€? },
    { search: 'Connect your AI assistant to Firebase. Exposes tools for database, auth, and analytics to build and deploy app projects.', replace: '灏嗘偍鐨?AI 鍔╂墜杩炴帴鍒?Firebase銆傛彁渚涚敤浜庢暟鎹簱銆佽韩浠介獙璇佸拰鍒嗘瀽鐨勫伐鍏凤紝浠ユ瀯寤哄拰閮ㄧ讲搴旂敤椤圭洰銆? },
    { search: 'The go-pls (Go Language Server) MCP server provides tools for semantic code navigation, refactoring, and code completion in your Go projects.', replace: 'go-pls (Go 璇█鏈嶅姟鍣? MCP 鏈嶅姟绔彁渚涚敤浜?Go 椤圭洰涓涔変唬鐮佸鑸€侀噸鏋勫拰浠ｇ爜琛ュ叏鐨勫伐鍏枫€? },
    { search: 'Interact with BigQuery data using natural language. This MCP server lists datasets, runs queries, and inspects database schemas.', replace: '浣跨敤鑷劧璇█涓?BigQuery 鏁版嵁杩涜浜や簰銆傝 MCP 鏈嶅姟绔彲浠ュ垪鍑烘暟鎹泦銆佽繍琛屾煡璇㈠苟妫€鏌ユ暟鎹簱 Schema銆? },
    { search: 'The AlloyDB for PostgreSQL server MCP exposes a schema and a set of tools to manage AlloyDB clusters and resources, manage users, create and restore backups', replace: 'AlloyDB for PostgreSQL MCP 鏈嶅姟绔叕寮€浜?Schema 鍜屼竴缁勫伐鍏凤紝鐢ㄤ簬绠＄悊 AlloyDB 闆嗙兢鍜岃祫婧愩€佺鐞嗙敤鎴枫€佸垱寤哄拰鎭㈠澶囦唤' },
    { search: 'The Google Cloud Bigtable Admin MCP server lets you manage Bigtable resources.', replace: 'Google Cloud Bigtable Admin MCP 鏈嶅姟绔厑璁告偍绠＄悊 Bigtable 璧勬簮銆? },
    { search: 'The Cloud SQL template MCP server lets you create and run Cloud SQL tools to examine database performance, configure instances, view logs, and more.', replace: 'Cloud SQL 妯℃澘 MCP 鏈嶅姟绔厑璁告偍鍒涘缓鍜岃繍琛?Cloud SQL 宸ュ叿锛屼互妫€鏌ユ暟鎹簱鎬ц兘銆侀厤缃疄渚嬨€佹煡鐪嬫棩蹇楃瓑銆? },
    { search: 'The Spanner template MCP server lets you create and run Spanner tools to create, querying, and query Spanner resources.', replace: 'Spanner 妯℃澘 MCP 鏈嶅姟绔厑璁告偍鍒涘缓鍜岃繍琛?Spanner 宸ュ叿锛屼互鍒涘缓銆佹煡璇㈠拰绠＄悊 Spanner 璧勬簮銆? },
    { search: 'Connect your AI assistant to Looker business intelligence. This MCP server enables data exploration and content management by allowing agents to execute runs', replace: '灏嗘偍鐨?AI 鍔╂墜杩炴帴鍒?Looker 鍟嗕笟鏅鸿兘銆傝 MCP 鏈嶅姟绔厑璁告櫤鑳戒綋鎵ц鏁版嵁鎺㈢储鍜屽唴瀹圭鐞? },
    { search: 'Connect your AI assistant to the Knowledge Sharing (formerly known as Dataplex)', replace: '灏嗘偍鐨?AI 鍔╂墜杩炴帴鍒扮煡璇嗗叡浜紙鍓嶈韩涓?Dataplex锛? },
    { search: 'The MCP Toolbox for Databases is an open-source MCP server designed to simplify and secure the development of tools for interacting with databases.', replace: 'MCP Toolbox for Databases 鏄竴涓紑婧愮殑 MCP 鏈嶅姟绔紝鏃ㄥ湪绠€鍖栧苟淇濇姢涓庢暟鎹簱浜や簰鐨勫伐鍏峰紑鍙戙€? },
    { search: 'Interact with your Oracle Database using natural language. The MCP server allows you to safely connect to your database for execution, sql querying,', replace: '浣跨敤鑷劧璇█涓庢偍鐨?Oracle 鏁版嵁搴撹繘琛屼氦浜掋€傝 MCP 鏈嶅姟绔厑璁告偍瀹夊叏鍦拌繛鎺ュ埌鏁版嵁搴撲互鎵ц SQL 鏌ヨ绛? },
    { search: 'The Figma Dev Mode MCP Server helps developers understand design layouts by converting design layout information to structural layout annotations', replace: 'Figma Dev Mode MCP 鏈嶅姟绔€氳繃灏嗚璁″竷灞€淇℃伅杞崲涓虹粨鏋勫寲甯冨眬娉ㄩ噴锛屽府鍔╁紑鍙戜汉鍛樼悊瑙ｈ璁″竷灞€' },
    { search: 'The standard GitHub Server for interacting with GitHub API', replace: '鐢ㄤ簬涓?GitHub API 浜や簰鐨勫畼鏂规爣鍑?GitHub 鏈嶅姟绔? },
    { search: 'Allows AI Agents to interact with the Glean API, searching for items, reading documents, and conducting search queries.', replace: '鍏佽 AI 鏅鸿兘浣撲笌 Glean API 杩涜浜や簰锛屼互鎼滅储椤圭洰銆侀槄璇绘枃妗ｅ苟鎵ц鎼滅储鏌ヨ銆? },
    { search: 'The official Model Context Protocol server allows you to integrate with Stripe APIs to perform user billing, files and support issues lookup, and transaction lookup.', replace: '瀹樻柟妯″瀷涓婁笅鏂囧崗璁?(MCP) 鏈嶅姟绔厑璁告偍涓?Stripe API 闆嗘垚锛屼互鎵ц鐢ㄦ埛璁¤垂銆佹枃浠跺拰鏀寔闂鏌ユ壘浠ュ強浜ゆ槗鏌ヨ銆? },
    { search: 'Interact with Sentry issues and events.', replace: '涓?Sentry 鐨勯棶棰?(Issues) 鍜屼簨浠?(Events) 杩涜浜や簰銆? },
    { search: 'Official Slack MCP Server for interacting with Slack channels, users, and sending messages.', replace: '瀹樻柟 Slack MCP 鏈嶅姟绔紝鐢ㄤ簬涓?Slack 棰戦亾銆佺敤鎴疯繘琛屼氦浜掑苟鍙戦€佹秷鎭€? },
    { search: 'Official Linear MCP Server for interacting with Linear projects, issues, and teams.', replace: '瀹樻柟 Linear MCP 鏈嶅姟绔紝鐢ㄤ簬涓?Linear 椤圭洰銆侀棶棰樺拰鍥㈤槦杩涜浜や簰銆? },
    { search: 'An MCP server implementation that integrates the Puppeteer library to provide agents with web research capabilities.', replace: '闆嗘垚浜?Puppeteer 搴撶殑 MCP 鏈嶅姟绔疄鐜帮紝涓烘櫤鑳戒綋鎻愪緵缃戦〉璋冪爺鑳藉姏銆? },
    { search: 'Official Figma MCP Server allows integration with Figma APIs for file review, code generation, and assets assets search.', replace: '瀹樻柟 Figma MCP 鏈嶅姟绔紝鍏佽涓?Figma API 闆嗘垚浠ヨ繘琛屾枃浠惰瘎瀹°€佷唬鐮佺敓鎴愬拰璧勬簮鎼滅储銆? },
    { search: 'The Heroku Platform API server provides seamless access to Heroku resources including apps, config vars, deploy keys, manage application, add-ons', replace: 'Heroku 骞冲彴 API 鏈嶅姟绔彁渚涘 Heroku 璧勬簮锛堝寘鎷簲鐢ㄣ€侀厤缃彉閲忋€侀儴缃插瘑閽ャ€佸簲鐢ㄧ鐞嗐€佹彃浠剁瓑锛夌殑鏃犵紳璁块棶' },
    { search: 'The Pinecone MCP server enables AI assistants to perform vector search, database index creation, generate code context to coordinate configuration, and', replace: 'Pinecone MCP 鏈嶅姟绔厑璁?AI 鍔╂墜鎵ц鍚戦噺鎼滅储銆佹暟鎹簱绱㈠紩鍒涘缓銆佺敓鎴愪唬鐮佷笂涓嬫枃浠ュ崗璋冮厤缃瓑' },
    { search: 'Connect your Supabase projects to AI assistants. This MCP server handles managing tables, executing queries, database schema querying, checking connection logs, and', replace: '灏嗘偍鐨?Supabase 椤圭洰杩炴帴 to AI 鍔╂墜銆傝 MCP 鏈嶅姟绔礋璐ｇ鐞嗚〃銆佹墽琛屾煡璇€佹暟鎹簱 Schema 鏌ヨ銆佹鏌ヨ繛鎺ユ棩蹇楃瓑' },
    { search: 'The Prisma MCP Server exposes API endpoints for database schema querying and migration execution.', replace: 'Prisma MCP 鏈嶅姟绔叕寮€浜嗙敤浜庢暟鎹簱 Schema 鏌ヨ鍜岃縼绉绘墽琛岀殑 API 绔偣銆? },
    { search: 'Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY)', replace: '鎻愪緵 Google Antigravity (AGY) 鐨勫叏闈㈡寚鍗椼€佸揩閫熷弬鑰冨拰缃戠珯鍦板浘' },
    { search: 'including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations.', replace: '鍖呮嫭 Antigravity 鍛戒护琛岀晫闈?(agy)銆丄ntigravity 2.0銆丄ntigravity IDE銆丳ython SDK銆佹枩鏉犲懡浠ゃ€佸揩鎹烽敭浠ュ強鑷畾涔夎缃€? },
    { search: 'Activate this skill when the user asks questions about how to use, configure, or customize Antigravity, AGY, the agy CLI, the Antigravity IDE, or Antigravity 2.0.', replace: '褰撶敤鎴疯闂浣曚娇鐢ㄣ€侀厤缃垨鑷畾涔?Antigravity銆丄GY銆乤gy 鍛戒护琛屻€丄ntigravity IDE 鎴?Antigravity 2.0 鏃讹紝婵€娲绘鎶€鑳姐€? },
    { search: 'Search MCP servers by name', replace: '鎸夊悕绉版悳绱?MCP 鏈嶅姟绔? },
    { search: 'Investigate and fix software issues using AI-powered root cause analysis. This MCP server connects to your Antimetal account to search issues, read', replace: '浣跨敤 AI 椹卞姩鐨勬牴鍥犲垎鏋愯皟鏌ュ拰淇杞欢闂銆傝 MCP 鏈嶅姟绔繛鎺ュ埌鎮ㄧ殑 Antimetal 璐︽埛浠ユ悳绱㈤棶棰樸€佽鍙? },
    { search: 'Query and act on your marketing, analytics, CRM, e-commerce, and warehouse data', replace: '鏌ヨ骞跺鐞嗘偍鐨勮惀閿€銆佸垎鏋愩€丆RM銆佺數瀛愬晢鍔″拰浠撳簱鏁版嵁' },
    { search: 'across 325+ connectors (Meta Ads, Google Ads, TikTok Ads, GA4, HubSpot,', replace: '鏀寔 325+ 涓繛鎺ュ櫒锛圡eta 骞垮憡銆丟oogle 骞垮憡銆乀ikTok 骞垮憡銆丟A4銆丠ubSpot' },
    { search: 'Query your GitLab SDLC as a knowledge graph.', replace: '灏嗘偍鐨?GitLab SDLC 浣滀负鐭ヨ瘑鍥捐氨杩涜鏌ヨ銆? },
    { search: 'Orbit indexes groups, projects, source code, merge requests, pipelines, work items, and security findings into a single graph so agents can answer blast radius', replace: 'Orbit 灏嗙兢缁勩€侀」鐩€佹簮浠ｇ爜銆佸悎骞惰姹傘€佹祦姘寸嚎銆佸伐浣滈」鍜屽畨鍏ㄥ彂鐜扮储寮曞埌鍗曚釜鍥捐氨涓紝浠ヤ究鏅鸿兘浣撹兘澶熷洖绛斿奖鍝嶈寖鍥? },
    { search: 'Enable Antigravity to deploy apps to Google Cloud Run.', replace: '鍏佽 Antigravity 灏嗗簲鐢ㄩ儴缃插埌 Google Cloud Run銆? },
    { search: 'Interact directly with the PostHog product analytics platform using natural language.', replace: '浣跨敤鑷劧璇█鐩存帴涓?PostHog 浜у搧鍒嗘瀽骞冲彴杩涜浜や簰銆? },
    { search: 'Run queries, manage feature flags, track errors, and manage projects.', replace: '杩愯鏌ヨ銆佺鐞嗙壒鎬ф爣蹇椼€佽窡韪敊璇苟绠＄悊椤圭洰銆? },
    { search: 'Allows interacting with Google Kubernetes Engine (GKE) clusters on Google Cloud Platform (GCP).', replace: '鍏佽鍦?Google Cloud Platform (GCP) 涓婁笌 Google Kubernetes Engine (GKE) 闆嗙兢杩涜浜や簰銆? },
    { search: 'Toggle Developer Tools', replace: '鍒囨崲寮€鍙戣€呭伐鍏? },
    { search: 'Full Machine', replace: '鏁存満鎺堟潈' },
    { search: 'Turbo Mode', replace: '鏋侀€熸ā寮? },
    { search: 'Turbo mode', replace: '鏋侀€熸ā寮? },
    { search: 'Learn more about ', replace: '浜嗚В鏇村鍏充簬 ' },
    { search: 'Learn more about', replace: '浜嗚В鏇村鍏充簬' },
    { search: 'Enable Telemetry', replace: '鍏佽鏀堕泦鍖垮悕浣跨敤鏁版嵁' },
    { search: 'Manually customize individual settings.', replace: '鎵嬪姩閰嶇疆鍏蜂綋鐨勬潈闄愯鍒欍€? },
    { search: 'Working..', replace: '姝ｅ湪澶勭悊..' },
    { search: 'Working...', replace: '姝ｅ湪澶勭悊...' },
    { search: 'Working.', replace: '姝ｅ湪澶勭悊...' },
    { search: 'Thinking..', replace: '姝ｅ湪鎬濊€?.' },
    { search: 'Thinking...', replace: '姝ｅ湪鎬濊€?..' },
    { search: 'Analyzing..', replace: '姝ｅ湪鍒嗘瀽..' },
    { search: 'Analyzing...', replace: '姝ｅ湪鍒嗘瀽...' },
    { search: 'Danger Zone', replace: '鍗遍櫓鍖哄煙' },
    { search: 'Delete Project', replace: '鍒犻櫎椤圭洰' },
    { search: 'Permanently delete this project and all of its conversations', replace: '姘镐箙鍒犻櫎姝ら」鐩強鍏舵墍鏈夌殑瀵硅瘽璁板綍' },
    { search: 'Add Context', replace: '娣诲姞涓婁笅鏂? },
    { search: 'Media', replace: '濯掍綋鏂囦欢 (鍥剧墖/瑙嗛)' },
    { search: 'Mentions', replace: '鎻愬強椤?(@ 绗﹀彿)' },
    { search: 'Actions', replace: '鍔ㄤ綔鎸囦护 (/ 绗﹀彿)' },
    { search: 'Toggle Model Selector', replace: '鍒囨崲妯″瀷閫夋嫨鍣? },
    { search: 'Toggle Voice Recording', replace: '寮€鍚?鍏抽棴璇煶褰曞埗' },
    { search: 'Find in Pane', replace: '鍦ㄧ獥鏍间腑鏌ユ壘' },
    { search: 'LAYOUT CONTROLS', replace: '甯冨眬鎺у埗' },
    { search: 'Toggle Sidebar', replace: '寮€鍚?鍏抽棴渚ц竟鏍? },
    { search: 'Toggle Auxiliary Pane', replace: '寮€鍚?鍏抽棴杈呭姪绐楁牸' },
    { search: 'Zoom In', replace: '鏀惧ぇ' },
    { search: 'Zoom Out', replace: '缂╁皬' },
    { search: 'Reset Zoom', replace: '閲嶇疆缂╂斁' },
    { search: 'Go To Projects', replace: '鍓嶅線椤圭洰绠＄悊涓績' },
    { search: 'Light Theme', replace: '娴呰壊涓婚' },
    { search: 'Dark Theme', replace: '娣辫壊涓婚' }
  ];

  const punctuationMap = {
    '.': '銆?,
    ':': '锛?,
    '?': '锛?,
    '!': '锛?,
    ',': '锛?
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
    const matchEnable = trimmed.match(/^Enable Antigravity to (interact with|deploy apps to) (.*?)\.?$/i);
    if (matchEnable) {
      const act = matchEnable[1];
      const target = matchEnable[2];
      if (act === 'interact with') {
        dynamicMatch = `鍏佽 Antigravity 涓?${target} 杩涜浜や簰銆俙;
      } else {
        dynamicMatch = `鍏佽 Antigravity 灏嗗簲鐢ㄩ儴缃插埌 ${target}銆俙;
      }
      isDynamic = true;
    }
    
    const matchExposes = trimmed.match(/^The (.*?) MCP server exposes (.*?) development tool actions to compatible AI-assistant clients\.?$/i);
    if (!isDynamic && matchExposes) {
      const name = matchExposes[1];
      const target = matchExposes[2];
      dynamicMatch = `${name} MCP 鏈嶅姟绔紝鍚戝吋瀹圭殑 AI 鍔╂墜瀹㈡埛绔叕寮€ ${target} 寮€鍙戝伐鍏锋搷浣溿€俙;
      isDynamic = true;
    }

    const matchGives = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) (Server|server) gives AI-powered development tools the ability to (.*?)\.?$/i);
    if (!isDynamic && matchGives) {
      const name = matchGives[1];
      let action = matchGives[3];
      action = action.replace(/work with your (.*?) projects and your app's codebase/i, '鍗忓悓澶勭悊鎮ㄧ殑 $1 椤圭洰鍙婂簲鐢ㄤ唬鐮佸簱');
      action = action.replace(/build, debug and inspect your (.*?) app/i, '鏋勫缓銆佽皟璇曚笌妫€鏌ユ偍鐨?$1 搴旂敤');
      action = action.replace(/build, debug and inspect your (.*)/i, '鏋勫缓銆佽皟璇曚笌妫€鏌ユ偍鐨?$1');
      dynamicMatch = `閽堝 ${name} 鐨勬ā鍨嬩笂涓嬫枃鍗忚 (MCP) 鏈嶅姟绔紝涓?AI 杈呭姪寮€鍙戝伐鍏锋彁渚?{action}鐨勮兘鍔涖€俙;
      isDynamic = true;
    }

    const matchProvides = trimmed.match(/^The (.*?) Model Context Protocol \(MCP\) server provides tools for (.*?)\.?$/i);
    if (!isDynamic && matchProvides) {
      const name = matchProvides[1];
      let action = matchProvides[2];
      action = action.replace(/semantic code analysis, live diagnostics, and transformation of your non-google3 Go codebase/i, '璇箟浠ｇ爜鍒嗘瀽銆佸疄鏃惰瘖鏂拰闈?google3 Go 浠ｇ爜搴撶殑杞崲');
      dynamicMatch = `${name} 妯″瀷涓婁笅鏂囧崗璁?(MCP) 鏈嶅姟绔紝鎻愪緵鐢ㄤ簬 ${action} 鐨勫伐鍏枫€俙;
      isDynamic = true;
    }

    // 5. Interact with your ... data...
    const matchInteractData = trimmed.match(/^Interact with your (.*?) data using natural language\. This MCP server (.*?)\.?$/i);
    if (!isDynamic && matchInteractData) {
      const target = matchInteractData[1];
      let action = matchInteractData[2];
      action = action.replace(/allows you to securely connect to your datasets to search the datasets, inspect table.*/i, '鍏佽鎮ㄥ畨鍏ㄥ湴杩炴帴鍒版暟鎹泦浠ユ悳绱㈡暟鎹泦銆佹鏌ユ暟鎹〃骞惰幏鍙栫粨鏋勪俊鎭€?);
      dynamicMatch = `浣跨敤鑷劧璇█涓庢偍鐨?${target} 鏁版嵁杩涜浜や簰銆傝 MCP 鏈嶅姟绔?{action}`;
      isDynamic = true;
    }

    // 6. Connect your AI assistant(s) to ...
    const matchConnectAI = trimmed.match(/^Connect your AI assistant(?:s)? to (.*?)(?:\. This MCP server|,)(?:\s+)?(enables|enabling) (.*?)\.?$/i);
    if (!isDynamic && matchConnectAI) {
      const target = matchConnectAI[1];
      let action = matchConnectAI[3];
      action = action.replace(/data exploration and content management by allowing you to execute.*/i, '閫氳繃鍏佽鎮ㄦ墽琛岃嚜鐒惰瑷€鏌ヨ锛屾潵瀹炵幇鏁版嵁鎺㈢储涓庡唴瀹圭鐞嗐€?);
      action = action.replace(/data discovery and governance by allowing you to.*/i, '閫氳繃鍏佽鎮ㄦ墽琛屾暟鎹帰绱㈠拰娌荤悊锛屾潵瀹炵幇鏁版嵁鍙戠幇涓庢暟鎹不鐞嗐€?);
      dynamicMatch = `灏嗘偍鐨?AI 鍔╂墜杩炴帴鍒?${target}銆傝 MCP 鏈嶅姟绔?{action}`;
      isDynamic = true;
    }

    // 7. The ... remote MCP server lets you ... (Bigtable Admin, Cloud SQL, Spanner)
    const matchRemoteMCP = trimmed.match(/^The (.*?) (?:remote )?MCP server lets you (.*?)\.?$/i);
    if (!isDynamic && matchRemoteMCP) {
      const name = matchRemoteMCP[1];
      let action = matchRemoteMCP[2];
      action = action.replace(/manage (.*?) resources/i, '绠＄悊 $1 璧勬簮');
      action = action.replace(/access and run (.*?) tools to (.*)/i, '璁块棶鍜岃繍琛?$1 宸ュ叿浠ワ細$2');
      action = action.replace(/manage Cloud SQL instances, manage users, create and restore backups.*/i, '绠＄悊 Cloud SQL 瀹炰緥銆佺鐞嗙敤鎴枫€佸垱寤哄拰鎭㈠澶囦唤绛?);
      action = action.replace(/manage AlloyDB clusters and instances, manage users, create and restore.*/i, '绠＄悊 AlloyDB 闆嗙兢鍜屽疄渚嬨€佺鐞嗙敤鎴枫€佸垱寤哄拰鎭㈠澶囦唤绛?);
      action = action.replace(/create, manage, and query Spanner resources from your AI-enabled development.*/i, '浠庢偍鐨?AI 杈呭姪寮€鍙戠幆澧冧腑鍒涘缓銆佺鐞嗗拰鏌ヨ Spanner 璧勬簮');
      dynamicMatch = `${name} 杩滅▼ MCP 鏈嶅姟绔紝鍏佽鎮?{action}銆俙;
      isDynamic = true;
    }

    // MCP Server Description dynamic translation
    const matchAllows = trimmed.match(/^(Allows running|Allows interacting with|Allows querying|Allows accessing|Provides tools to|Provides tools for|Provides tools) (.*?)\.? This tool runs on the host system outside of any sandboxes\.?$/i);
    if (!isDynamic && matchAllows) {
      const action = matchAllows[1].toLowerCase();
      const target = matchAllows[2].trim();
      let actionZh = '';
      if (action.includes('running')) {
        actionZh = '鍏佽杩愯';
      } else if (action.includes('interacting')) {
        actionZh = '鍏佽涓?;
      } else if (action.includes('querying')) {
        actionZh = '鍏佽鏌ヨ';
      } else if (action.includes('accessing')) {
        actionZh = '鍏佽璁块棶';
      } else if (action.includes('tools for') || action.includes('tools to') || action.includes('provides tools')) {
        actionZh = '鎻愪緵鐢ㄤ簬';
      }
      
      let targetZh = target;
      const targetLower = target.toLowerCase();
      if (targetLower === 'cmd.exe commands on windows') targetZh = 'Windows 涓婄殑 cmd.exe 鍛戒护';
      else if (targetLower === 'ipconfig to inspect network settings on the host machine') targetZh = 'ipconfig 浠ユ鏌ュ涓绘満鐨勭綉缁滆缃?;
      else if (targetLower === 'querying active directory domain services on windows') targetZh = '鍦?Windows 涓婃煡璇㈡椿鍔ㄧ洰褰?(Active Directory) 鍩熸湇鍔?;
      else if (targetLower === 'bash shell commands') targetZh = 'bash Shell 鍛戒护';
      else if (targetLower === 'cmd shell commands') targetZh = 'cmd Shell 鍛戒护';
      else if (targetLower === 'the docker daemon') targetZh = 'Docker 瀹堟姢杩涚▼';
      else if (targetLower === 'git repositories') targetZh = 'Git 浠撳簱';
      else if (targetLower === 'search files using grep') targetZh = '浣跨敤 grep 鎼滅储鏂囦欢';
      else if (targetLower === 'managing homebrew packages') targetZh = '绠＄悊 Homebrew 杞欢鍖?;
      else if (targetLower === 'interacting with a kubernetes cluster' || targetLower === 'a kubernetes cluster') targetZh = 'Kubernetes 闆嗙兢';
      else if (targetLower === 'the npm package manager') targetZh = 'npm 鍖呯鐞嗗櫒';
      else if (targetLower === 'the pip package manager') targetZh = 'pip 鍖呯鐞嗗櫒';
      else if (targetLower === 'running python scripts and modules' || targetLower === 'python scripts and modules') targetZh = '杩愯 Python 鑴氭湰鍜屾ā鍧?;
      else if (targetLower === 'searching files using ripgrep') targetZh = '浣跨敤 ripgrep 鎼滅储鏂囦欢';
      else if (targetLower === 'a sqlite database') targetZh = 'SQLite 鏁版嵁搴?;
      else if (targetLower === 'the command line tool curl') targetZh = '鍛戒护琛屽伐鍏?curl';
      else if (targetLower === 'the google cloud cli') targetZh = 'Google Cloud CLI';
      else if (targetLower === 'google cloud pub/sub') targetZh = 'Google Cloud Pub/Sub';
      else if (targetLower === 'google cloud storage') targetZh = 'Google Cloud Storage';
      else if (targetLower === 'google cloud spanner') targetZh = 'Google Cloud Spanner';
      else if (targetLower === 'google cloud secret manager') targetZh = 'Google Cloud Secret Manager';
      else if (targetLower === 'google cloud kms') targetZh = 'Google Cloud KMS';
      else if (targetLower === 'github repositories') targetZh = 'GitHub 浠撳簱';
      else if (targetLower === 'gitlab repositories') targetZh = 'GitLab 浠撳簱';
      else if (targetLower === 'gmail messages and drafts') targetZh = 'Gmail 閭欢涓庤崏绋?;
      else if (targetLower === 'google calendar events') targetZh = 'Google 鏃ュ巻浜嬩欢';
      else if (targetLower === 'google docs documents') targetZh = 'Google 鏂囨。';
      else if (targetLower === 'google drive files and folders') targetZh = 'Google 浜戠纭洏鏂囦欢涓庢枃浠跺す';
      else if (targetLower === 'google sheets spreadsheets') targetZh = 'Google 琛ㄦ牸';
      else if (targetLower === 'jira issues') targetZh = 'Jira 浜嬪姟';
      else if (targetLower === 'confluence pages') targetZh = 'Confluence 椤甸潰';
      else if (targetLower === 'slack channels and messages') targetZh = 'Slack 棰戦亾涓庢秷鎭?;
      else if (targetLower === 'linear issues') targetZh = 'Linear 浜嬪姟';
      else if (targetLower === 'notion pages and databases') targetZh = 'Notion 椤甸潰涓庢暟鎹簱';
      else if (targetLower === 'a postgresql database') targetZh = 'PostgreSQL 鏁版嵁搴?;
      else if (targetLower === 'a mysql database') targetZh = 'MySQL 鏁版嵁搴?;
      else if (targetLower === 'a redis cache') targetZh = 'Redis 缂撳瓨';
      else if (targetLower === 'an elasticsearch cluster') targetZh = 'Elasticsearch 闆嗙兢';
      else if (targetLower === 'a mongodb database') targetZh = 'MongoDB 鏁版嵁搴?;
      else if (targetLower === 'sentry projects and issues') targetZh = 'Sentry 椤圭洰涓庨棶棰?;
      else if (targetLower === 'datadog services') targetZh = 'Datadog 鏈嶅姟';
      else if (targetLower === 'aws services') targetZh = 'AWS 鏈嶅姟';
      else if (targetLower === 'azure services') targetZh = 'Azure 鏈嶅姟';
      else if (targetLower === 'cloudflare services') targetZh = 'Cloudflare 鏈嶅姟';
      else if (targetLower === 'vercel services') targetZh = 'Vercel 鏈嶅姟';
      else if (targetLower === 'heroku services') targetZh = 'Heroku 鏈嶅姟';
      else if (targetLower === 'netlify services') targetZh = 'Netlify 鏈嶅姟';
      else if (targetLower === 'github copilot services') targetZh = 'GitHub Copilot 鏈嶅姟';
      else if (targetLower === 'openai services') targetZh = 'OpenAI 鏈嶅姟';
      else if (targetLower === 'anthropic services') targetZh = 'Anthropic 鏈嶅姟';
      else if (targetLower === 'google gemini services') targetZh = 'Google Gemini 鏈嶅姟';
      else if (targetLower === 'google vertex ai services') targetZh = 'Google Vertex AI 鏈嶅姟';

      if (action.includes('tools for') || action.includes('tools to') || action.includes('provides tools')) {
        dynamicMatch = `${actionZh}${targetZh}鐨勫伐鍏枫€傝宸ュ叿杩愯鍦ㄦ矙鐩掑鐨勫涓荤郴缁熶笂銆俙;
      } else if (action.includes('interacting')) {
        dynamicMatch = `${actionZh}${targetZh}杩涜浜や簰銆傝宸ュ叿杩愯鍦ㄦ矙鐩掑鐨勫涓荤郴缁熶笂銆俙;
      } else {
        dynamicMatch = `${actionZh}${targetZh}銆傝宸ュ叿杩愯鍦ㄦ矙鐩掑鐨勫涓荤郴缁熶笂銆俙;
      }
      isDynamic = true;
    }

    // Weekly limit dynamic text
    if (/^You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) days?, (\d+) hours?\.?/, '鎮ㄥ凡娑堣€椾簡閮ㄥ垎姣忓懆闄愰锛屽皢鍦?$1 澶?$2 灏忔椂鍚庡畬鍏ㄩ噸缃€?);
      isDynamic = true;
    } else if (/^You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your weekly limit, it will fully refresh in (\d+) hours?\.?/, '鎮ㄥ凡娑堣€椾簡閮ㄥ垎姣忓懆闄愰锛屽皢鍦?$1 灏忔椂鍚庡畬鍏ㄩ噸缃€?);
      isDynamic = true;
    }

    // 5-hour limit dynamic text
    if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) hours?, (\d+) minutes?\.?/, '鎮ㄥ凡娑堣€椾簡閮ㄥ垎 5 灏忔椂闄愰锛屽皢鍦?$1 灏忔椂 $2 鍒嗛挓鍚庡畬鍏ㄩ噸缃€?);
      isDynamic = true;
    } else if (/^You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?\.?$/.test(trimmed)) {
      dynamicMatch = trimmed.replace(/You have used some of your 5-hour limit, it will fully refresh in (\d+) minutes?\.?/, '鎮ㄥ凡娑堣€椾簡閮ㄥ垎 5 灏忔椂闄愰锛屽皢鍦?$1 鍒嗛挓鍚庡畬鍏ㄩ噸缃€?);
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

    const puncRegex = /(\.\.\.|鈥\.|\?|!|:|锛殀锛焲锛亅銆?$/;
    const match = core.match(puncRegex);
    if (match) {
      matchPunc = match[0];
      core = core.slice(0, -matchPunc.length).trim();
      
      if (matchPunc === '.') trailPunc = '.';
      else if (matchPunc === '?') trailPunc = '锛?;
      else if (matchPunc === '!') trailPunc = '锛?;
      else if (matchPunc === ':') trailPunc = '锛?;
      else if (matchPunc === '锛?) trailPunc = '锛?;
      else if (matchPunc === '锛?) trailPunc = '锛?;
      else if (matchPunc === '锛?) trailPunc = '锛?;
      else if (matchPunc === '銆?) trailPunc = '銆?;
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
        if (text.includes('姣忓懆棰戝害闄愰') || text.includes('Weekly Limit')) {
          const val = findPercentageNearby(el);
          const resetTime = findResetTimeNearby(el);
          if (val) {
            const group = checkModelGroup(el);
            if (group === 'gemini') {
              localStorage.setItem('quota_gemini_weekly', val);
              if (resetTime) localStorage.setItem('quota_gemini_weekly_reset', resetTime);
            } else if (group === 'claude') {
              localStorage.setItem('quota_claude_weekly', val);
              if (resetTime) localStorage.setItem('quota_claude_weekly_reset', resetTime);
            }
          }
        }
        else if (text.includes('5灏忔椂棰濆害闄愰') || text.includes('浜斿皬鏃堕搴﹂檺棰?) || text.includes('Five Hour Limit') || text.includes('5-hour limit')) {
          const val = findPercentageNearby(el);
          const resetTime = findResetTimeNearby(el);
          if (val) {
            const group = checkModelGroup(el);
            if (group === 'gemini') {
              localStorage.setItem('quota_gemini_5h', val);
              if (resetTime) localStorage.setItem('quota_gemini_5h_reset', resetTime);
            } else if (group === 'claude') {
              localStorage.setItem('quota_claude_5h', val);
              if (resetTime) localStorage.setItem('quota_claude_5h_reset', resetTime);
            }
          }
        }
      }
    } catch (e) {
      console.error('Quota scraper error:', e);
    }
  }

  function findResetTimeNearby(element) {
    let parent = element.parentElement;
    if (!parent) return null;
    const text = parent.textContent || '';
    
    // 鍖归厤涓枃鎴栬嫳鏂囬噸缃墿浣欐椂闂?
    const matchZh = text.match(/灏嗗湪\s*([\d\s\u4e00-\u9fa5\w]+?)\s*鍚庡畬鍏ㄩ噸缃?);
    if (matchZh) return matchZh[1].trim();
    
    const matchEn = text.match(/fully refresh in\s*([\d\s\w,]+)/i);
    if (matchEn) {
      let t = matchEn[1].trim();
      t = t.replace(/days?,?/gi, '澶?)
           .replace(/hours?,?/gi, '灏忔椂')
           .replace(/minutes?,?/gi, '鍒嗛挓')
           .replace(/\s+/g, '');
      return t;
    }
    
    let grandParent = parent.parentElement;
    if (grandParent) {
      const text2 = grandParent.textContent || '';
      const matchZh2 = text2.match(/灏嗗湪\s*([\d\s\u4e00-\u9fa5\w]+?)\s*鍚庡畬鍏ㄩ噸缃?);
      if (matchZh2) return matchZh2[1].trim();
      
      const matchEn2 = text2.match(/fully refresh in\s*([\d\s\w,]+)/i);
      if (matchEn2) {
        let t = matchEn2[1].trim();
        t = t.replace(/days?,?/gi, '澶?)
             .replace(/hours?,?/gi, '灏忔椂')
             .replace(/minutes?,?/gi, '鍒嗛挓')
             .replace(/\s+/g, '');
        return t;
      }
    }
    return null;
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

  function showBeautifulConfirm(title, message, confirmText = '纭畾', cancelText = '鍙栨秷') {
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
      overlay.style.zIndex = '999999';
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
        if (txt.includes('Continue with Google') || txt.includes('浣跨敤 Google 璐﹀彿鐧诲綍')) {
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
        title.textContent = '鈥?蹇嵎鐧诲綍宸插瓨璐﹀彿 鈥?;
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
            btn.textContent = '姝ｅ湪蹇嵎鐧诲綍骞堕噸鍚?..';
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

  function injectQuotaWidget() {
    try {
      // 1. 寮傛杞藉叆澶氳处鍙峰垪琛ㄥ苟缂撳瓨浜?window 瀵硅薄涓紙澧炲姞鍗虫椂閲嶇粯涓庡嚟鎹梾鎺級
      if (window.antigravityAccounts === undefined) {
        window.antigravityAccounts = null;
        try {
          electron_1.ipcRenderer.invoke('accounts:list').then(res => {
            window.antigravityAccounts = res.accounts || [];
            window.antigravityCurrentAccount = res.currentAccountId || '';
            // 寮傛鏁版嵁涓€钀藉湴锛岀珛鍗冲己琛岄噸缁樻寕浠讹紝褰诲簳娑堢伃 2 绉掔殑鏄剧ず绛夊緟寤惰繜
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
        if (text === '璁剧疆' || text === 'Settings' || text === 'Global Settings' || text === '鍏ㄥ眬璁剧疆') {
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
            white-space: nowrap;
            font-size: 10.5px;
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
        `;
        root.appendChild(style);
        
        const card = document.createElement('div');
        card.className = 'widget-card';
        card.innerHTML = `
          <div class="quota-title"></div>
          <div class="weekly-row">
            <span>姣忓懆棰濆害锛?/span>
            <span class="quota-weekly">--</span>
          </div>
          <div class="hourly-row">
            <span>5H棰濆害锛?/span>
            <span class="quota-5h">--</span>
          </div>
          <div class="accounts-container"></div>
        `;
        root.appendChild(card);
        
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

      const gWeeklyReset = localStorage.getItem('quota_gemini_weekly_reset') || '';
      const g5hReset = localStorage.getItem('quota_gemini_5h_reset') || '';
      const cWeeklyReset = localStorage.getItem('quota_claude_weekly_reset') || '';
      const c5hReset = localStorage.getItem('quota_claude_5h_reset') || '';

      const getDisplayVal = (val, resetVal) => {
        const cleaned = (val || '').trim();
        if (cleaned === '0%' || cleaned === '0' || cleaned === '0.0%') {
          return resetVal ? resetVal : '0%';
        }
        return val;
      };

      const gWeeklyShow = getDisplayVal(gWeekly, gWeeklyReset);
      const g5hShow = getDisplayVal(g5h, g5hReset);
      const cWeeklyShow = getDisplayVal(cWeekly, cWeeklyReset);
      const c5hShow = getDisplayVal(c5h, c5hReset);

      // BUG FIX: 妫€娴嬪綋鍓?UI 閲岀湡瀹為€変腑鐨勬ā鍨嬶紙浠ュ簳閮ㄦā鍨嬮€夋嫨鍣ㄧ殑鏂囨湰涓哄噯锛?
      // 闃叉鍚庡彴 Gemini 鎺㈤拡鍝嶅簲姹℃煋褰撳墠 Claude/GPT 棰濆害鏄剧ず
      function getCurrentModel() {
        try {
          // 浼樺厛璇诲彇搴曢儴妯″瀷閫夋嫨鍣紙鏈€鍑嗙‘锛?
          const modelSelectors = [
            '.model-selector', '.model-select', '[data-model]',
            'button[aria-label*="model" i]', 'button[aria-label*="Model" i]',
          ];
          for (const sel of modelSelectors) {
            const el = document.querySelector(sel);
            if (el) {
              const text = el.textContent.trim();
              const m = text.match(/\b(Gemini|Claude|GPT-OSS|GPT)\b/i);
              if (m) return m[1];
            }
          }
          // 娆￠€夛細閬嶅巻搴曢儴宸ュ叿鏍忕殑 interactive 鍏冪礌锛堜絾涓嶉亶鍘嗗璇濇皵娉″尯鍩燂級
          const bottomBar = document.querySelector('.bottom-bar, .input-area, .composer, footer, form');
          const searchRoot = bottomBar || document;
          const interactives = searchRoot.querySelectorAll('button, [role="button"], .select, .trigger, .dropdown');
          for (let i = 0; i < interactives.length; i++) {
            const el = interactives[i];
            const text = el.textContent ? el.textContent.trim() : '';
            if (text.length > 100) continue; // 璺宠繃闀挎枃鏈殑瀵硅瘽姘旀场鎸夐挳
            const m = text.match(/\b(Gemini|Claude|GPT-OSS|GPT)\b/i);
            if (m) return m[1];
          }
        } catch (e) {}
        return 'Gemini'; // 榛樿鍏滃簳
      }


      const currentModel = getCurrentModel().toLowerCase();
      const isGemini = currentModel.includes('gemini');

      // BUG FIX: 鑾峰彇鍚勬ā鍨?quota 鏁版嵁鐨勬渶鍚庡啓鍏ユ椂闂达紝鐢ㄤ簬闃叉"鍚庡彴鎺㈤拡"姹℃煋鏄剧ず
      const geminiTs = parseInt(localStorage.getItem('quota_gemini_ts') || '0', 10);
      const claudeTs = parseInt(localStorage.getItem('quota_claude_ts') || '0', 10);
      // 褰撳墠妯″瀷搴旀樉绀哄摢涓?quota锛?褰撳墠妯″瀷鐨?quota 鏁版嵁鏄惁姣斿绔嬫ā鍨嬬殑鏇存柊"
      // 濡傛灉姝ｅ湪鐢?Claude锛屼絾 Gemini 鐨?ts 姣?Claude 鏇存柊锛堝悗鍙版帰閽堝垰瑙﹀彂锛夛紝涓嶅簲鍒囨崲鏄剧ず
      const shouldShowGemini = isGemini
        ? true
        : geminiTs > claudeTs + 5000; // 濡傛灉 Gemini 鏁版嵁姣?Claude 鏂拌秴杩?5 绉掓墠鍒囨崲锛堟甯镐笉璇ュ彂鐢燂級

      const titleEl = root.querySelector('.quota-title');
      const weeklyEl = root.querySelector('.quota-weekly');
      const hourlyEl = root.querySelector('.quota-5h');
      const accountsContainer = root.querySelector('.accounts-container');

      // 澧為噺鍒锋柊閰嶉鏂囨湰鏁板€硷紝涓嶉噸缁樻暣涓?DOM 鏍?
      if (isGemini || shouldShowGemini) {
        if (!isGemini) {
          // 褰撳墠鏄?Claude/GPT 浣?Gemini 鎺㈤拡鏁版嵁鏇存柊锛氫粎闈欓粯瀛樺偍锛屼笉鏇存柊鏍囬
          if (weeklyEl.textContent !== gWeeklyShow && gWeeklyShow !== '--') weeklyEl.textContent = gWeeklyShow;
          if (hourlyEl.textContent !== g5hShow && g5hShow !== '--') hourlyEl.textContent = g5hShow;
        } else {
          if (titleEl.textContent !== 'gemini') {
            titleEl.textContent = 'gemini';
            titleEl.style.color = '#3b82f6';
          }
          if (weeklyEl.textContent !== gWeeklyShow) weeklyEl.textContent = gWeeklyShow;
          if (hourlyEl.textContent !== g5hShow) hourlyEl.textContent = g5hShow;
        }
      } else {
        const isGpt = currentModel.includes('gpt');
        const titleText = isGpt ? 'gpt' : 'claude';
        const color = isGpt ? '#f59e0b' : '#10b981';
        if (titleEl.textContent !== titleText) {
          titleEl.textContent = titleText;
          titleEl.style.color = color;
        }
        if (weeklyEl.textContent !== cWeeklyShow) weeklyEl.textContent = cWeeklyShow;
        if (hourlyEl.textContent !== c5hShow) hourlyEl.textContent = c5hShow;
      }

      // 浠呭湪 trigger 鑺傜偣涓嶅瓨鍦ㄦ椂锛堟垨鑰呭垵濮嬪寲鑾峰彇鍒版柊璐﹀彿鍒楄〃鏃讹級锛屾墠杩涜璐﹀彿鍒囨崲鍖哄煙 of HTML 鏋勫缓
      let trigger = accountsContainer.querySelector('#antigravity-account-select-trigger');
      if (!trigger && window.antigravityAccounts && window.antigravityAccounts.length > 0) {
        const currentAcc = window.antigravityAccounts.find(a => a.id === window.antigravityCurrentAccount);
        const triggerLabel = currentAcc ? `${currentAcc.name} (${currentAcc.email})` : '鏈櫥褰曟垨閫夋嫨璐﹀彿';

        accountsContainer.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 4px; position: relative;" onclick="event.stopPropagation();">
            <div class="switcher-header">
              <span class="switcher-title">鍒囨崲璐﹀彿</span>
              <span id="antigravity-add-account" class="add-link">娣诲姞璐﹀彿</span>
            </div>
            
            <div id="antigravity-account-select-trigger" class="select-trigger">
              <span class="trigger-label">${triggerLabel}</span>
              <span class="arrow-icon">鈻?/span>
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
                <span class="delete-btn" data-id="${acc.id}" title="鍒犻櫎姝よ处鍙?>脳</span>
              </div>
            `;
          }).join('') + `
            <div class="add-new-item" data-id="__add_new_account__">
              + 鐧诲綍鏂拌处鍙?..
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
                showBeautifulConfirm('鐧诲綍鏂拌处鍙?, '鏄惁瑕佹竻绌哄綋鍓嶇櫥褰曠姸鎬佸苟閲嶅惎瀹㈡埛绔互鐧诲綍鏂拌处鍙凤紵', '纭畾', '鍙栨秷').then(confirmed => {
                  if (confirmed) {
                    electron_1.ipcRenderer.invoke('accounts:clear-keyring');
                  }
                });
              } else if (!isCurrent) {
                const triggerLabelEl = trigger.querySelector('.trigger-label');
                if (triggerLabelEl) triggerLabelEl.textContent = '姝ｅ湪鍒囨崲...';
                trigger.style.opacity = '0.5';
                
                electron_1.ipcRenderer.invoke('accounts:switch', itemId).then(res => {
                  if (!res.success) {
                    alert('鍒囨崲璐﹀彿澶辫触: ' + res.error);
                    trigger.style.opacity = '1';
                    injectQuotaWidget();
                  }
                }).catch(err => {
                  alert('鍒囨崲璐﹀彿鍙戠敓閿欒: ' + err.message);
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
                  ? `纭畾瑕佸垹闄ゅ綋鍓嶆鍦ㄤ娇鐢ㄧ殑璐﹀彿 ${targetAcc ? targetAcc.email : 'Unknown'} 鍚楋紵\\n鍒犻櫎鍚庝細娓呴櫎绯荤粺鍑嵁骞惰嚜鍔ㄩ噸鍚鎴风銆俙
                  : `纭畾瑕佸垹闄よ处鍙?${targetAcc ? targetAcc.email : 'Unknown'} 鍚楋紵\\n鍒犻櫎鍚庡闇€鍐嶆浣跨敤锛屽繀椤婚噸鏂扮櫥褰曘€俙;
                showBeautifulConfirm('鍒犻櫎璐﹀彿', deleteMessage, '纭畾鍒犻櫎', '鍙栨秷').then(confirmed => {
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
                        showBeautifulConfirm('閿欒鎻愮ず', '鍒犻櫎璐﹀彿澶辫触: ' + res.error, '濂界殑', '鍏抽棴');
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
            showBeautifulConfirm('鐧诲綍鏂拌处鍙?, '鏄惁瑕佹竻绌哄綋鍓嶇櫥褰曠姸鎬佸苟閲嶅惎瀹㈡埛绔互鐧诲綍鏂拌处鍙凤紵', '纭畾', '鍙栨秷').then(confirmed => {
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
          const currentText = currentAcc ? `${currentAcc.name} (${currentAcc.email})` : '鏈櫥褰曟垨閫夋嫨璐﹀彿';
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
                localStorage.setItem("quota_" + type + "_ts", Date.now()); // BUG FIX: 璁板綍鍐欏叆鏃堕棿鎴?
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
      const CURRENT_VERSION = 'v1.2.2';

      function injectVersionElement() {
          let widget = document.getElementById('antigravity-version-widget');
          if (!widget) {
              const root = document.documentElement || document.body;
              if (!root) return;
              
              widget = document.createElement('div');
              widget.id = 'antigravity-version-widget';
              
              // 鎮诞鍦ㄥ彸涓婅 window controls 鎸夐挳宸︿晶 (鍙充晶鍋忕Щ閲忚皟鏁翠负 180px 褰诲簳閬垮厤閬尅鏈€灏忓寲鎸夐挳)
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
                  <span class="version-label">姹夊寲鎻掍欢 ${CURRENT_VERSION}</span>
                  <span id="antigravity-patch-update-btn" style="display: none; margin-left: 8px; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; cursor: pointer; transition: all 0.2s;">鏈夋柊鐗堟湰</span>
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
          
          // 鍔ㄦ€侀鑹茶嚜閫傚簲锛氳幏鍙栦富闈㈡澘鍓嶆櫙鑹蹭笌鑳屾櫙鑹诧紝鑷€傚簲璁＄畻楂樺姣斿害瀛楄壊涓庤竟妗嗚壊
          const theme = getNativeThemeColors();
          let fgColor = '';
          
          // 1. 灏濊瘯浠庡父瑙?workbench/titlebar 瀹瑰櫒鎴栬彍鍗曠粍浠朵腑鎻愬彇涓昏壊
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
          
          // 2. 鍏滃簳绛栫暐锛氬鏋滆幏鍙栦笉鍒版湁鏁堢殑棰滆壊锛屾垨鑰呴鑹叉槸绾€忔槑/杩囨贰锛岀洿鎺ュ熀浜庝富棰樻槑鏆楀垽瀹氳繘琛岄粦鐧藉弽杞?
          if (!fgColor || fgColor.includes('rgba(255, 255, 255, 0.7)') || fgColor === 'transparent') {
              fgColor = theme.isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(16, 16, 16, 0.85)';
          }
          
          widget.style.color = fgColor;
          widget.style.border = theme.isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)';
      }
      
      let updateUrl = null;
      let downloadUrl = null;
      
      setTimeout(() => {
          // 璋冪敤 IPC 鍒颁富杩涚▼杩涜鏃犻樆纰?GitHub 鍗囩骇妫€娴?(缁曞紑娓叉煋杩涚▼ CSP 闄愬埗)
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
          btn.textContent = '姝ｅ湪涓嬭浇...';
          btn.style.background = '#fef3c7';
          btn.style.color = '#d97706';
          btn.style.borderColor = '#fde68a';
          
          electron_1.ipcRenderer.invoke('patch:trigger-update', downloadUrl).then(res => {
              if (res && res.success) {
                  btn.textContent = '閲嶅惎鐢熸晥';
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
                      btn.textContent = '姝ｅ湪閲嶅惎...';
                      electron_1.ipcRenderer.invoke('patch:restart-app', res.restartScript);
                  };
              } else {
                  btn.textContent = '鏇存柊澶辫触';
                  btn.style.background = '#fee2e2';
                  btn.style.color = '#b91c1c';
                  btn.style.borderColor = '#fca5a5';
                  setTimeout(() => {
                      btn.textContent = '鏈夋柊鐗堟湰';
                      btn.style.pointerEvents = 'auto';
                      btn.style.background = '#e0f2fe';
                      btn.style.color = '#0369a1';
                      btn.style.borderColor = '#bae6fd';
                  }, 5000);
              }
          }).catch(err => {
              console.error('[preload-update] invoke update error:', err);
              btn.textContent = '缃戠粶閿欒';
              setTimeout(() => {
                  btn.textContent = '鏈夋柊鐗堟湰';
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
