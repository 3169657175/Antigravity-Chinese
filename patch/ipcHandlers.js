"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerIpcHandlers = registerIpcHandlers;
const electron_1 = require("electron");

function getLogPath(filename) {
    try {
        const fs = require('fs');
        const path = require('path');
        const dir = path.join(require('os').homedir(), '.gemini', 'antigravity', 'scratch');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return path.join(dir, filename);
    } catch(e) {
        return filename;
    }
}

const DEBUG_QUOTA_LOGS = process.env.ANTIGRAVITY_DEBUG_QUOTA === '1';
function appendQuotaDebugLog(text) {
    if (!DEBUG_QUOTA_LOGS) {
        return;
    }
    try {
        const fs = require('fs');
        fs.appendFileSync(getLogPath('mcp_spy.txt'), text, 'utf-8');
    } catch (e) {}
}

// Helper to read JSON with retries to resolve write race conditions
async function readJsonWithRetry(filePath, retries = 5, delay = 50) {
    const fs = require('fs/promises');
    for (let i = 0; i < retries; i++) {
        try {
            const raw = await fs.readFile(filePath, 'utf-8');
            if (!raw && retries > 1) {
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            return JSON.parse(raw);
        } catch (e) {
            if (e.code === 'ENOENT') {
                throw e;
            }
            if (i === retries - 1) {
                throw e;
            }
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

// Helper to write JSON atomically (using temp file and rename) to prevent corruption
async function writeJsonAtomic(filePath, data, retries = 5, delay = 50) {
    const fs = require('fs/promises');
    const path = require('path');
    const dir = path.dirname(filePath);
    const tmpPath = path.join(dir, path.basename(filePath) + '.' + Math.random().toString(36).substring(2) + '.tmp');
    
    await fs.mkdir(dir, { recursive: true });
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(tmpPath, content, 'utf-8');
    
    for (let i = 0; i < retries; i++) {
        try {
            await fs.rename(tmpPath, filePath);
            return;
        } catch (e) {
            if (i === retries - 1) {
                try {
                    await fs.writeFile(filePath, content, 'utf-8');
                    await fs.unlink(tmpPath).catch(() => {});
                    return;
                } catch (writeErr) {
                    throw writeErr;
                }
            }
            await new Promise(r => setTimeout(r, delay));
        }
    }
}
const electron_updater_1 = require("electron-updater");
const updater_1 = require("./updater");
const main_1 = __importDefault(require("electron-log/main"));
const fs = __importStar(require("fs/promises"));
const customScheme_1 = require("./customScheme");
const tray_1 = require("./tray");
const constants_1 = require("./ideInstall/constants");
/**
 * Registers all IPC handlers for the main process.
 */
function registerIpcHandlers(storageManager) {
    // Dialog
    electron_1.ipcMain.handle('dialog:open-workspace', async () => {
        const result = await electron_1.dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory'],
            title: 'Open workspace',
        });
        if (result.canceled || result.filePaths.length === 0) {
            return undefined;
        }
        return result.filePaths[0];
    });
    // Auto-updater
    electron_1.ipcMain.handle('updater:apply', async () => {
        (0, updater_1.broadcastState)({ type: 'ready' });
    });
    electron_1.ipcMain.handle('updater:quit-and-install', () => {
        if (!electron_1.app.isPackaged) {
            console.log('[AutoUpdater] Skipping quitAndInstall (requires a packaged app).');
            return;
        }
        electron_updater_1.autoUpdater.quitAndInstall();
    });
    electron_1.ipcMain.handle('updater:get-state', () => {
        return (0, updater_1.getLastState)();
    });
    // Notifications
    electron_1.ipcMain.handle('notification:send', (_, options) => {
        const notification = new electron_1.Notification({
            title: options.title,
            body: options.body,
            silent: options.silent ?? false,
        });
        notification.on('click', () => {
            const win = electron_1.BrowserWindow.getAllWindows()[0];
            if (win) {
                if (win.isMinimized()) {
                    win.restore();
                }
                win.show();
                win.focus();
                if (options.payload) {
                    win.webContents.send('notification:clicked', options.payload);
                }
            }
        });
        notification.show();
    });
    // Note: copied from our desktop AGY implementation:
    // vs/platform/nativeNotification/electron-main/electronNotificationService.ts
    electron_1.ipcMain.handle('notification:open-system-preferences', async () => {
        if (process.platform === 'darwin') {
            void electron_1.shell.openExternal('x-apple.systempreferences:com.apple.preference.notifications');
        }
        else if (process.platform === 'win32') {
            void electron_1.shell.openExternal('ms-settings:notifications');
        }
        else if (process.platform === 'linux') {
            const { exec } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const commands = [
                'gnome-control-center notifications',
                'systemsettings kcm_notifications',
                'xfce4-notifyd-config',
                'gnome-control-center',
                'systemsettings',
            ];
            for (const command of commands) {
                try {
                    exec(command);
                    return; // If one command executes without immediate error, assume success for now
                }
                catch {
                    // Try next
                }
            }
        }
    });
    // Storage
    electron_1.ipcMain.handle('storage:get-items', async () => {
        return storageManager.getItems();
    });
    electron_1.ipcMain.handle('storage:update-items', async (_event, changes) => {
        await storageManager.updateItems(changes);
    });
    // Logs
    electron_1.ipcMain.handle('logs:electron', async () => {
        try {
            const logPath = main_1.default.transports.file.getFile().path;
            const contents = await fs.readFile(logPath, 'utf-8');
            return contents;
        }
        catch (err) {
            return `Failed to read logs: ${String(err)}`;
        }
    });
    // Sidecar extension custom scheme
    electron_1.ipcMain.handle('extensions:send-authorities', async (_event, authorities) => {
        customScheme_1.extensionAuthorities.clear();
        for (const [key, value] of Object.entries(authorities)) {
            customScheme_1.extensionAuthorities.set(key, value);
        }
    });
    // Agent
    electron_1.ipcMain.handle('agent:update-active-count', async (_event, count) => {
        (0, tray_1.updateTrayAgentCount)(count);
    });
    // Window
    electron_1.ipcMain.handle('window:set-title-bar-overlay', async (_event, options) => {
        const win = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0];
        if (win && process.platform === 'win32') {
            win.setTitleBarOverlay({
                color: options.color,
                symbolColor: options.symbolColor,
                height: 30,
            });
        }
    });
    electron_1.ipcMain.handle('window:minimize', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0];
        if (win) {
            win.minimize();
        }
    });
    electron_1.ipcMain.handle('window:maximize', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0];
        if (win) {
            win.maximize();
        }
    });
    electron_1.ipcMain.handle('window:unmaximize', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0];
        if (win) {
            win.unmaximize();
        }
    });
    electron_1.ipcMain.handle('window:is-maximized', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0];
        return win ? win.isMaximized() : false;
    });
    electron_1.ipcMain.handle('window:close', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0];
        if (win) {
            win.close();
        }
    });
    electron_1.ipcMain.handle('window:toggle-devtools', async () => {
        const win = electron_1.BrowserWindow.getFocusedWindow() || electron_1.BrowserWindow.getAllWindows()[0];
        if (win) {
            win.webContents.toggleDevTools();
        }
    });
    // Auto-updater manual check
    electron_1.ipcMain.handle('updater:check-for-updates', () => {
        (0, updater_1.checkForUpdates)(true);
    });
    // Safe external shell launch
    electron_1.ipcMain.handle('shell:open-external', async (_event, url) => {
        if (url.startsWith('https://') ||
            url.startsWith('http://') ||
            url.startsWith('antigravity-ide://')) {
            await electron_1.shell.openExternal(url);
        }
    });
    // IDE installation check
    electron_1.ipcMain.handle('ide:is-installed', async () => {
        try {
            // Check standard installation path (works even if the app has never been launched).
            await fs.stat((0, constants_1.getIdeInstallPath)());
            return true;
        }
        catch {
            return false;
        }
    });

    // Custom telemetry logger for Antigravity Quota
    electron_1.ipcMain.handle('mcp:write-log', async (_event, text) => {
        try {
            const nodeFs = require('fs');
            nodeFs.appendFileSync(getLogPath('mcp_spy.txt'), text, 'utf-8');
        } catch (e) {
            console.error('mcp:write-log error:', e);
        }
    });

    // Custom IPC to return local language server port and CSRF token
    electron_1.ipcMain.handle('mcp:get-ls-info', async () => {
        try {
            const languageServer = require("./languageServer");
            return {
                port: languageServer.getLsPort(),
                csrf: languageServer.getLsCsrf()
            };
        } catch (e) {
            console.error('mcp:get-ls-info error:', e);
            return { port: 0, csrf: '' };
        }
    });

    let lastUserActiveTime = Date.now();
    let lastPollTime = 0;

    // Receive active signal from renderer window
    electron_1.ipcMain.on('user-active', () => {
        lastUserActiveTime = Date.now();
    });

    function startRegularQuotaScheduler() {
        // Dynamic heartbeat scheduler: check every 5 seconds
        setInterval(() => {
            const now = Date.now();
            const isActive = now - lastUserActiveTime < 15000; // Active if user interacted in the last 15 seconds
            
            if (isActive) {
                // In active mode, poll every 5 seconds
                if (now - lastPollTime >= 5000) {
                    lastPollTime = now;
                    pollLocalQuota();
                }
            } else {
                // In idle mode, poll every 30 seconds
                if (now - lastPollTime >= 30000) {
                    lastPollTime = now;
                    pollLocalQuota();
                }
            }
        }, 5000);
    }

    let startupQuotaPolled = false;
    let startupTries = 0;
    let startupPollInterval = setInterval(async () => {
        startupTries++;
        try {
            const languageServer = require("./languageServer");
            const port = languageServer.getLsPort();
            const csrf = languageServer.getLsCsrf();
            if (port && csrf) {
                const forceRefreshPayload = Buffer.from([0, 0, 0, 0, 2, 16, 1]);
                const data = await requestGrpc(port, csrf, '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary', forceRefreshPayload);
                if (data && data.length > 0) {
                    const quotas = parseProtoQuota(data);
                    if (quotas && Object.keys(quotas).length > 0) {
                        // Success! Update local storage
                        const windows = electron_1.BrowserWindow.getAllWindows();
                        for (const win of windows) {
                            if (win.webContents) {
                                win.webContents.executeJavaScript(`
                                    localStorage.setItem("quota_gemini_weekly", "${quotas.gemini_weekly || '0%'}");
                                    localStorage.setItem("quota_gemini_5h", "${quotas.gemini_5h || '0%'}");
                                    localStorage.setItem("quota_claude_weekly", "${quotas.claude_weekly || '0%'}");
                                    localStorage.setItem("quota_claude_5h", "${quotas.claude_5h || '0%'}");
                                `).catch(()=>{});
                            }
                        }
                        clearInterval(startupPollInterval);
                        startupQuotaPolled = true;
                        startRegularQuotaScheduler();
                    }
                }
            }
        } catch (e) {
            console.error('Startup quota poll error:', e);
        }
        if (startupTries >= 15) {
            clearInterval(startupPollInterval);
            if (!startupQuotaPolled) {
                startRegularQuotaScheduler();
            }
        }
    }, 2000);

    // Accounts list handler
    electron_1.ipcMain.handle('accounts:list', async () => {
        try {
            const os = require('os');
            const path = require('path');
            const fs = require('fs/promises');
            const userHome = os.homedir();
            const accountsPath = path.join(userHome, '.antigravity_tools', 'accounts.json');
            let data;
            try {
                data = await readJsonWithRetry(accountsPath);
            } catch (e) {
                if (e.code === 'ENOENT') {
                    data = { version: "2.0", accounts: [], current_account_id: "" };
                } else {
                    throw e;
                }
            }
            return {
                accounts: (data.accounts || []).map(acc => ({
                    id: acc.id,
                    email: acc.email,
                    name: acc.name
                })),
                currentAccountId: data.current_account_id || ''
            };
        } catch (e) {
            console.error('[ipcHandlers] accounts:list error:', e);
            return { accounts: [], currentAccountId: '' };
        }
    });

    // Accounts switch handler
    electron_1.ipcMain.handle('accounts:switch', async (_event, accountId) => {
        try {
            const os = require('os');
            const path = require('path');
            const fs = require('fs/promises');
            const { execSync } = require('child_process');
            const userHome = os.homedir();
            
            const accountsPath = path.join(userHome, '.antigravity_tools', 'accounts.json');
            const data = await readJsonWithRetry(accountsPath);
            
            const acc = (data.accounts || []).find(a => a.id === accountId);
            if (!acc) throw new Error('Account not found in registry');
            
            const detailPath = path.join(userHome, '.antigravity_tools', 'accounts', `${accountId}.json`);
            const detail = await readJsonWithRetry(detailPath);
            
            if (!detail.token) throw new Error('Token structure missing in account details');
            
            // Format to exact Windows credentials format required by native LS
            const credentialObj = {
                token: {
                    access_token: detail.token.access_token,
                    token_type: detail.token.token_type || 'Bearer',
                    refresh_token: detail.token.refresh_token,
                    expiry: new Date(detail.token.expiry_timestamp * 1000).toISOString().replace('.000Z', '.000000Z')
                },
                auth_method: 'consumer'
            };
            const credentialStr = JSON.stringify(credentialObj);
            
            // Write to Windows Credential Manager (Generic Credentials) as raw UTF-8 bytes to match keyring-rs
            if (process.platform === 'win32') {
                const nodeFs = require('fs');
                const tempPsFile = path.join(os.tmpdir(), `agy_switch_cred_${Date.now()}.ps1`);
                
                const writeScript = `
                    try {
                        ` + '$definition = @"' + `
                        using System;
                        using System.Text;
                        using System.Runtime.InteropServices;

                        [StructLayout(LayoutKind.Sequential)]
                        public struct CREDENTIAL {
                            public uint Flags;
                            public uint Type;
                            public IntPtr TargetName;
                            public IntPtr Comment;
                            public long LastWritten;
                            public int CredentialBlobSize;
                            public IntPtr CredentialBlob;
                            public uint Persist;
                            public uint AttributeCount;
                            public IntPtr Attributes;
                            public IntPtr TargetAlias;
                            public IntPtr UserName;
                        }

                        public class CredWriter {
                            [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
                            public static extern bool CredWrite(IntPtr credential, int flags);

                            public static bool WriteGenericCred(string targetName, string userName, string passwordUtf8) {
                                byte[] blob = Encoding.UTF8.GetBytes(passwordUtf8);
                                IntPtr pBlob = Marshal.AllocHGlobal(blob.Length);
                                IntPtr pTarget = Marshal.StringToHGlobalUni(targetName);
                                IntPtr pUser = Marshal.StringToHGlobalUni(userName);

                                int structSize = Marshal.SizeOf(typeof(CREDENTIAL));
                                IntPtr pCredStruct = Marshal.AllocHGlobal(structSize);

                                try {
                                    Marshal.Copy(blob, 0, pBlob, blob.Length);
                                    
                                    CREDENTIAL cred = new CREDENTIAL();
                                    cred.Flags = 0;
                                    cred.Type = 1; // Generic Credential (Type = 1)
                                    cred.TargetName = pTarget;
                                    cred.Comment = IntPtr.Zero;
                                    cred.LastWritten = 0;
                                    cred.CredentialBlobSize = blob.Length;
                                    cred.CredentialBlob = pBlob;
                                    cred.Persist = 2; // Local Machine persist
                                    cred.AttributeCount = 0;
                                    cred.Attributes = IntPtr.Zero;
                                    cred.TargetAlias = IntPtr.Zero;
                                    cred.UserName = pUser;

                                    Marshal.StructureToPtr(cred, pCredStruct, false);
                                    return CredWrite(pCredStruct, 0);
                                } finally {
                                    Marshal.FreeHGlobal(pBlob);
                                    Marshal.FreeHGlobal(pTarget);
                                    Marshal.FreeHGlobal(pUser);
                                    Marshal.FreeHGlobal(pCredStruct);
                                }
                            }
                        }
"@
                        Add-Type -TypeDefinition $definition -ErrorAction SilentlyContinue
                        $res = [CredWriter]::WriteGenericCred("gemini:antigravity", "antigravity", '${credentialStr.replace(/'/g, "''")}')
                        Write-Host "RESULT: $res"
                    } catch {
                        Write-Host "ERROR: $($_.Exception.Message)"
                    }
                `;
                
                // Write with UTF-16 LE BOM to temp file
                const bom = Buffer.from([0xFF, 0xFE]);
                const buf = Buffer.from(writeScript, 'utf16le');
                nodeFs.writeFileSync(tempPsFile, Buffer.concat([bom, buf]));
                
                try {
                    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPsFile}"`, { encoding: 'utf-8', timeout: 5000 });
                    console.log('[ipcHandlers] Write generic credential result:', out.trim());
                    if (!out.includes('RESULT: True')) {
                        throw new Error('System keyring write failed: ' + out.trim());
                    }
                } finally {
                    if (nodeFs.existsSync(tempPsFile)) {
                        nodeFs.unlinkSync(tempPsFile);
                    }
                }
                console.log('[ipcHandlers] Successfully updated credentials for account:', acc.email);
            }
            
            // Sync current_account_id back to index file
            data.current_account_id = accountId;
            await writeJsonAtomic(accountsPath, data);
            
            // Kill old language_server.exe immediately to free up gRPC ports before relaunch
            if (process.platform === 'win32') {
                try {
                    execSync('taskkill /F /IM language_server.exe');
                } catch (e) {}
            }

            // Trigger client restart (snappy 50ms delay)
            setTimeout(() => {
                electron_1.app.relaunch();
                electron_1.app.exit(0);
            }, 50);
            
            return { success: true };
        } catch (e) {
            console.error('[ipcHandlers] accounts:switch error:', e);
            return { success: false, error: e.message };
        }
    });

    // Debug logging helper
    electron_1.ipcMain.handle('debug:log', async (_event, msg) => {
        try {
            const fs = require('fs');
            fs.appendFileSync(getLogPath('sniff_combined.log'), '[' + new Date().toISOString() + '] ' + msg + '\n', 'utf-8');
        } catch(e) {}
    });

    // Accounts sniff handler - highly optimized local gRPC check (2ms)
    electron_1.ipcMain.handle('accounts:sniff', async () => {
        try {
            const fs = require('fs');
            const path = require('path');
            const log = (msg) => {
                try {
                    fs.appendFileSync(getLogPath('sniff_combined.log'), '[' + new Date().toISOString() + '] [ipc] ' + msg + '\n', 'utf-8');
                } catch(e) {}
            };

            log('accounts:sniff called');
            const languageServer = require("./languageServer");
            const port = languageServer.getLsPort();
            const csrf = languageServer.getLsCsrf();
            log('LS port=' + port + ', csrf=' + csrf);
            if (!port || !csrf) {
                log('No LS port or CSRF');
                return { success: false, error: 'No LS port/csrf' };
            }

            const data = await requestGrpc(port, csrf, '/exa.language_server_pb.LanguageServerService/GetUserStatus', Buffer.from([0, 0, 0, 0, 0]));
            log('LS GetUserStatus response length: ' + (data ? data.length : 0));
            if (!data || data.length === 0) {
                log('Empty LS response');
                return { success: false, error: 'Empty LS response' };
            }

            // 直接扫描 Buffer 字节寻找邮箱，绕过 Protobuf 二进制乱码干扰 UTF-8 解码
            let email = null;
            const AT = 0x40; // '@'
            const VALID_CHARS = new Set('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-_+'.split('').map(c => c.charCodeAt(0)));
            const DOT = 0x2E; // '.'
            for (let i = 0; i < data.length; i++) {
                if (data[i] === AT) {
                    // 向前找用户名
                    let start = i - 1;
                    while (start >= 0 && VALID_CHARS.has(data[start])) start--;
                    start++;
                    if (start >= i) continue; // 没有用户名
                    // 向后找域名（只到下一个非 ASCII 字母/数字/点为止）
                    let end = i + 1;
                    while (end < data.length && (VALID_CHARS.has(data[end]) || data[end] === DOT)) end++;
                    const rawCandidate = data.slice(start, end).toString('ascii');
                    // 用正则提取首个合法邮箱（截断末尾多余字节如 jm 等 Protobuf 残留）
                    const m = /^([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})/.exec(rawCandidate);
                    if (m) {
                        email = m[1];
                        break;
                    }
                }
            }
            if (!email) {
                log('No email found in response. Raw hex preview: ' + data.slice(0, 80).toString('hex'));
                return { success: false, error: 'No email found in response' };
            }
            log('Sniffed email from LS: ' + email);

            const os = require('os');
            const fsPromises = require('fs/promises');
            const userHome = os.homedir();
            
            const baseDir = path.join(userHome, '.antigravity_tools');
            await fsPromises.mkdir(baseDir, { recursive: true });
            
            const accountsPath = path.join(baseDir, 'accounts.json');
            let dataPool;
            try {
                dataPool = await readJsonWithRetry(accountsPath);
            } catch (e) {
                if (e.code === 'ENOENT') {
                    dataPool = { version: "2.0", accounts: [], current_account_id: "" };
                } else {
                    log('Error reading accounts.json, aborting sniff: ' + e.message);
                    return { success: false, error: 'Database read failed: ' + e.message };
                }
            }


            // 定义局部通用读取 Token 逻辑（包含 DB 读取和 Keyring 降级机制）
            const getFreshToken = () => {
                log('Reading fresh token...');
                const { execSync } = require('child_process');
                const appdata = process.env.APPDATA || '';
                const dbCandidates = [
                    path.join(appdata, 'Antigravity IDE', 'User', 'globalStorage', 'state.vscdb'),
                    path.join(appdata, 'Antigravity', 'User', 'globalStorage', 'state.vscdb'),
                ];
                let dbPath = null;
                for (const c of dbCandidates) {
                    if (fs.existsSync(c)) { dbPath = c; break; }
                }
                log('state.vscdb path: ' + (dbPath || 'NOT FOUND'));

                let currentKeyring = null;
                if (dbPath) {
                    const pyScript = `
import sqlite3, json, sys
db = sys.argv[1]
conn = sqlite3.connect(db)
cur = conn.cursor()
cur.execute("SELECT value FROM ItemTable WHERE key=?", ("gemini:antigravity",))
row = cur.fetchone()
if row:
    print("KEYRING:" + row[0])
else:
    print("KEYRING:")
conn.close()
`.trim();
                    const tempPy = path.join(os.tmpdir(), 'agy_read_db_' + Date.now() + '.py');
                    fs.writeFileSync(tempPy, pyScript, 'utf-8');

                    try {
                        const out = execSync(`python "${tempPy}" "${dbPath}"`, { encoding: 'utf-8', timeout: 8000 });
                        if (fs.existsSync(tempPy)) fs.unlinkSync(tempPy);
                        log('DB read output: ' + out.substring(0, 200));
                        const match = /^KEYRING:(.+)$/m.exec(out);
                        if (match && match[1].trim()) {
                            try {
                                currentKeyring = JSON.parse(match[1].trim());
                            } catch(pe) {
                                log('JSON parse error: ' + pe.message);
                            }
                        }
                    } catch(e) {
                        if (fs.existsSync(tempPy)) try { fs.unlinkSync(tempPy); } catch(_) {}
                        log('DB read error: ' + e.message);
                    }
                }

                // 降级：如果 DB 读取失败，尝试从 Windows Keyring 读取
                if (!currentKeyring || !currentKeyring.token || !currentKeyring.token.access_token) {
                    log('No token found in DB, falling back to Keyring...');
                    try {
                        const tempPsFile = path.join(os.tmpdir(), `agy_read_cred_${Date.now()}.ps1`);
                        const readScript = `
                            try {
                                $definition = @"
                                using System;
                                using System.Text;
                                using System.Runtime.InteropServices;

                                [StructLayout(LayoutKind.Sequential)]
                                public struct CREDENTIAL {
                                    public uint Flags;
                                    public uint Type;
                                    public IntPtr TargetName;
                                    public IntPtr Comment;
                                    public long LastWritten;
                                    public int CredentialBlobSize;
                                    public IntPtr CredentialBlob;
                                    public uint Persist;
                                    public uint AttributeCount;
                                    public IntPtr Attributes;
                                    public IntPtr TargetAlias;
                                    public IntPtr UserName;
                                }

                                public class CredReader {
                                    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
                                    public static extern bool CredEnumerate(string filter, int flag, out int count, out IntPtr pCredentials);

                                    [DllImport("advapi32.dll", SetLastError = true)]
                                    public static extern void CredFree(IntPtr pCredentials);

                                    public static string ReadGenericCred(string targetName) {
                                        int count;
                                        IntPtr pCredentials;
                                        if (CredEnumerate(null, 0, out count, out pCredentials)) {
                                            IntPtr[] credentials = new IntPtr[count];
                                            Marshal.Copy(pCredentials, credentials, 0, count);
                                            try {
                                                for (int i = 0; i < count; i++) {
                                                    CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credentials[i], typeof(CREDENTIAL));
                                                    string tName = Marshal.PtrToStringUni(cred.TargetName);
                                                    if (tName != null && tName.ToLower() == targetName.ToLower()) {
                                                        if (cred.CredentialBlob != IntPtr.Zero && cred.CredentialBlobSize > 0) {
                                                            byte[] blob = new byte[cred.CredentialBlobSize];
                                                            Marshal.Copy(cred.CredentialBlob, blob, 0, cred.CredentialBlobSize);
                                                            return Encoding.UTF8.GetString(blob);
                                                        }
                                                    }
                                                }
                                            } finally {
                                                CredFree(pCredentials);
                                            }
                                        }
                                        return "";
                                    }
                                }
"@
                                Add-Type -TypeDefinition $definition -ErrorAction SilentlyContinue
                                $res = [CredReader]::ReadGenericCred("gemini:antigravity")
                                Write-Host "VALUE: $res"
                            } catch {
                                Write-Host "ERROR: $($_.Exception.Message)"
                            }
                        `;
                        const bom = Buffer.from([0xFF, 0xFE]);
                        const buf = Buffer.from(readScript, 'utf16le');
                        fs.writeFileSync(tempPsFile, Buffer.concat([bom, buf]));
                        
                        const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPsFile}"`, { encoding: 'utf-8', timeout: 5000 });
                        if (fs.existsSync(tempPsFile)) fs.unlinkSync(tempPsFile);
                        
                        const lines = out.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('VALUE: ')) {
                                const jsonStr = line.substring(7).trim();
                                if (jsonStr) {
                                    currentKeyring = JSON.parse(jsonStr);
                                }
                            }
                        }
                    } catch(e) {
                        log('Keyring fallback error: ' + e.message);
                    }
                }
                return currentKeyring;
            };

            const existingAcc = (dataPool.accounts || []).find(a => a.email.toLowerCase() === email.toLowerCase());
            log('Existing account found: ' + (existingAcc ? existingAcc.id : 'none'));
            
            if (existingAcc && dataPool.current_account_id === existingAcc.id) {
                log('Account already current, returning success');
                return { success: true, email, accountId: existingAcc.id, alreadySaved: true };
            }

            if (existingAcc) {
                log('Account exists but not current. Re-reading fresh token to update detail file...');
                const currentKeyring = getFreshToken();
                if (currentKeyring && currentKeyring.token && currentKeyring.token.access_token) {
                    const detailPath = path.join(baseDir, 'accounts', `${existingAcc.id}.json`);
                    try {
                        const detail = await readJsonWithRetry(detailPath);
                        
                        // 用新 Token 覆盖旧 Token
                        const token = currentKeyring.token;
                        detail.token.access_token = token.access_token;
                        detail.token.refresh_token = token.refresh_token;
                        detail.token.expires_in = token.expires_in || 3599;
                        detail.token.expiry_timestamp = token.expiry_timestamp || Math.floor(Date.now() / 1000) + 3599;
                        if (token.project_id) {
                            detail.token.project_id = token.project_id;
                        }
                        
                        await writeJsonAtomic(detailPath, detail);
                        log('Successfully updated token for existing account: ' + email);
                    } catch(e) {
                        log('Failed to update existing account detail file: ' + e.message);
                    }
                } else {
                    log('Warning: could not retrieve fresh token for existing account.');
                }

                dataPool.current_account_id = existingAcc.id;
                await writeJsonAtomic(accountsPath, dataPool);
                log('Updated current_account_id to ' + existingAcc.id);
                return { success: true, email, accountId: existingAcc.id, updatedCurrent: true };
            }

            log('New email detected. Fetching fresh token for registration...');
            const currentKeyring = getFreshToken();
            if (!currentKeyring || !currentKeyring.token || !currentKeyring.token.access_token) {
                return { success: false, error: 'No token found in system database or keyring' };
            }

            const crypto = require('crypto');
            await fsPromises.mkdir(path.join(baseDir, 'accounts'), { recursive: true });
            
            const accountId = crypto.randomUUID();
            const newAcc = {
                id: accountId,
                email: email,
                name: email.split('@')[0],
                disabled: false
            };
            dataPool.accounts.push(newAcc);
            dataPool.current_account_id = accountId;
            
            const detailPath = path.join(baseDir, 'accounts', `${accountId}.json`);
            const deviceProfile = {
                machine_id: "auth0|user_" + accountId.replace(/-/g, '').substring(0, 24),
                mac_machine_id: crypto.randomUUID(),
                dev_device_id: crypto.randomUUID(),
                sqm_id: "{" + crypto.randomUUID().toUpperCase() + "}"
            };

            const token = currentKeyring.token;
            const newDetail = {
                id: accountId,
                email: email,
                name: email.split('@')[0],
                token: {
                    access_token: token.access_token,
                    refresh_token: token.refresh_token,
                    expires_in: token.expires_in || 3599,
                    expiry_timestamp: token.expiry_timestamp || Math.floor(Date.now() / 1000) + 3599,
                    token_type: token.token_type || 'Bearer',
                    email: email,
                    project_id: token.project_id || ('disco-acre-' + crypto.randomBytes(3).toString('hex')),
                    oauth_client_key: token.oauth_client_key || 'antigravity_enterprise',
                    is_gcp_tos: false
                },
                device_profile: deviceProfile,
                device_history: [
                    {
                        id: crypto.randomUUID(),
                        created_at: Math.floor(Date.now() / 1000),
                        label: "auto_generated",
                        profile: deviceProfile,
                        is_current: true
                    }
                ]
            };

            await writeJsonAtomic(detailPath, newDetail);
            await writeJsonAtomic(accountsPath, dataPool);

            log('Sniff registered brand new account to pool: ' + email);
            return { success: true, email, accountId, newlySaved: true };
        } catch (e) {
            console.error('[ipcHandlers] accounts:sniff exception:', e);
            try { log('accounts:sniff exception: ' + e.message); } catch(_) {}
            return { success: false, error: e.message };
        }
    });

    // Accounts clear keyring and trigger relaunch
    electron_1.ipcMain.handle('accounts:clear-keyring', async () => {
        try {
            const { execSync } = require('child_process');
            if (process.platform === 'win32') {
                try {
                    execSync('cmdkey /delete:gemini:antigravity');
                    console.log('[ipcHandlers] Successfully cleared generic credential from system keyring');
                } catch (e) {
                    console.warn('[ipcHandlers] cmdkey delete failed (might not exist):', e.message);
                }
            }
            // Sync current_account_id to empty in accounts.json
            try {
                const os = require('os');
                const path = require('path');
                const userHome = os.homedir();
                const accountsPath = path.join(userHome, '.antigravity_tools', 'accounts.json');
                const data = await readJsonWithRetry(accountsPath);
                data.current_account_id = '';
                await writeJsonAtomic(accountsPath, data);
            } catch (e) {}

            // Kill old language_server.exe immediately to free up gRPC ports before relaunch
            if (process.platform === 'win32') {
                try {
                    execSync('taskkill /F /IM language_server.exe');
                } catch (e) {}
            }

            // Relaunch the app
            setTimeout(() => {
                electron_1.app.relaunch();
                electron_1.app.exit(0);
            }, 50);
            return { success: true };
        } catch (e) {
            console.error('[ipcHandlers] accounts:clear-keyring error:', e);
            return { success: false, error: e.message };
        }
    });

    // Accounts async native confirm box to prevent blocking the Chromium render thread
    electron_1.ipcMain.handle('accounts:confirm-clear', async (event) => {
        try {
            const { dialog, BrowserWindow } = require('electron');
            const win = BrowserWindow.fromWebContents(event.sender);
            const result = await dialog.showMessageBox(win, {
                type: 'question',
                buttons: ['确定', '取消'],
                defaultId: 1,
                title: 'Antigravity',
                message: '是否要清空当前登录状态并重启客户端以登录新账号？',
                cancelId: 1
            });
            return result.response === 0;
        } catch (e) {
            console.error('[ipcHandlers] accounts:confirm-clear error:', e);
            return false;
        }
    });

    // Accounts confirm delete handler (async native dialog box)
    electron_1.ipcMain.handle('accounts:confirm-delete', async (event, { email, isCurrent }) => {
        try {
            const { dialog, BrowserWindow } = require('electron');
            const win = BrowserWindow.fromWebContents(event.sender);
            const message = isCurrent
                ? `确定要删除当前正在使用的账号 ${email} 吗？\n删除后会清除系统凭据并自动重启客户端。`
                : `确定要删除账号 ${email} 吗？\n删除后如需再次使用，必须重新登录。`;
            const result = await dialog.showMessageBox(win, {
                type: 'warning',
                buttons: ['确定删除', '取消'],
                defaultId: 1,
                title: '删除账号',
                message: message,
                cancelId: 1
            });
            return result.response === 0;
        } catch (e) {
            console.error('[ipcHandlers] accounts:confirm-delete error:', e);
            return false;
        }
    });

    // Accounts delete handler
    electron_1.ipcMain.handle('accounts:delete', async (_event, accountId) => {
        try {
            const os = require('os');
            const path = require('path');
            const fs = require('fs/promises');
            const userHome = os.homedir();
            
            const baseDir = path.join(userHome, '.antigravity_tools');
            const accountsPath = path.join(baseDir, 'accounts.json');
            
            const data = await readJsonWithRetry(accountsPath);
            
            // Remove from list
            data.accounts = (data.accounts || []).filter(a => a.id !== accountId);
            
            // Delete detail profile file
            const detailPath = path.join(baseDir, 'accounts', `${accountId}.json`);
            try {
                await fs.unlink(detailPath);
            } catch (e) {}
            
            let mustRelaunch = false;
            if (data.current_account_id === accountId) {
                data.current_account_id = '';
                mustRelaunch = true;
                
                if (process.platform === 'win32') {
                    const { execSync } = require('child_process');
                    try {
                        execSync('cmdkey /delete:gemini:antigravity');
                    } catch (e) {}
                    try {
                        execSync('taskkill /F /IM language_server.exe');
                    } catch (e) {}
                }
            }
            
            await writeJsonAtomic(accountsPath, data);
            
            if (mustRelaunch) {
                setTimeout(() => {
                    electron_1.app.relaunch();
                    electron_1.app.exit(0);
                }, 50);
            }
            
            return { success: true, mustRelaunch };
        } catch (e) {
            console.error('[ipcHandlers] accounts:delete error:', e);
            return { success: false, error: e.message };
        }
    });

    electron_1.ipcMain.handle('debug:write-dom', async (_event, url, elements) => {
        try {
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const logPath = path.join(os.homedir(), '.gemini', 'antigravity', 'scratch', 'dom_debug.txt');
            fs.writeFileSync(logPath, `URL: ${url}\n\nTop Elements:\n${elements}`, 'utf-8');
            return true;
        } catch(e) {
            console.error('debug:write-dom error:', e);
            return false;
        }
    });

    electron_1.ipcMain.handle('patch:check-update', async () => {
        try {
            const data = await fetchJson('https://api.github.com/repos/3169657175/Antigravity-Chinese/releases/latest');
            return { success: true, data };
        } catch(e) {
            console.error('Check update error:', e);
            return { success: false, error: e.message };
        }
    });

    electron_1.ipcMain.handle('patch:trigger-update', async (_event, downloadUrl) => {
        const originalNoAsar = process.noAsar;
        process.noAsar = true;
        try {
            const https = require('https');
            const fs = require('fs');
            const path = require('path');
            const os = require('os');
            const { execSync } = require('child_process');

            const tempDir = path.join(os.tmpdir(), 'antigravity-patch-update');
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            fs.mkdirSync(tempDir, { recursive: true });

            const zipPath = path.join(tempDir, 'update.zip');
            
            // 1. 下载 ZIP 压缩包
            await downloadFile(downloadUrl, zipPath);

            // 2. 解压 ZIP 压缩包
            execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}\\unpacked' -Force"`, { stdio: 'ignore' });

            // 3. 验证并定位解压后的 patch 文件夹或补丁文件位置 (兼容直接在根目录和子目录结构)
            const unpackedDir = path.join(tempDir, 'unpacked');
            
            // 4. 定位解包后的 prebuilt 成品文件
            let prebuiltAsar = null;
            let prebuiltUnpacked = null;

            // 递归查找 app.asar，以防解压出来包裹了一层子文件夹
            if (fs.existsSync(path.join(unpackedDir, 'app.asar'))) {
                prebuiltAsar = path.join(unpackedDir, 'app.asar');
                if (fs.existsSync(path.join(unpackedDir, 'app.asar.unpacked'))) {
                    prebuiltUnpacked = path.join(unpackedDir, 'app.asar.unpacked');
                }
            } else {
                // 扫描一级子文件夹
                const children = fs.readdirSync(unpackedDir);
                for (const child of children) {
                    const fullChild = path.join(unpackedDir, child);
                    if (fs.statSync(fullChild).isDirectory()) {
                        if (fs.existsSync(path.join(fullChild, 'app.asar'))) {
                            prebuiltAsar = path.join(fullChild, 'app.asar');
                            if (fs.existsSync(path.join(fullChild, 'app.asar.unpacked'))) {
                                prebuiltUnpacked = path.join(fullChild, 'app.asar.unpacked');
                            }
                            break;
                        }
                    }
                }
            }

            if (!prebuiltAsar || !fs.existsSync(prebuiltAsar)) {
                throw new Error('Downloaded archive does not contain prebuilt app.asar');
            }

            // 5. 同步覆盖本地开发仓库源码（若检测到开发仓库存在）
            const userHome = os.homedir();
            const scratchDir = path.join(userHome, '.gemini', 'antigravity', 'scratch');
            fs.mkdirSync(scratchDir, { recursive: true });
            const localRepoDir = path.join(scratchDir, 'Antigravity-Chinese');
            
            if (fs.existsSync(localRepoDir)) {
                // 查找解压包里的 patch/ 和安装脚本位置
                let srcPatchDir = null;
                let srcInstallScript = null;
                let srcRestoreScript = null;
                let srcAutoHeal = null;
                let srcReadme = null;
                
                const searchPaths = [unpackedDir, path.dirname(prebuiltAsar)];
                for (const sp of searchPaths) {
                    if (fs.existsSync(path.join(sp, 'patch'))) {
                        srcPatchDir = path.join(sp, 'patch');
                        srcInstallScript = path.join(sp, 'install.ps1');
                        srcRestoreScript = path.join(sp, 'restore.ps1');
                        srcAutoHeal = path.join(sp, 'auto_heal.ps1');
                        srcReadme = path.join(sp, 'README.md');
                        break;
                    }
                }
                
                if (srcPatchDir && fs.existsSync(srcPatchDir)) {
                    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path '${srcPatchDir}\\*' -Destination '${localRepoDir}\\patch' -Recurse -Force"`, { stdio: 'ignore' });
                    if (fs.existsSync(srcInstallScript)) fs.copyFileSync(srcInstallScript, path.join(localRepoDir, 'install.ps1'));
                    if (fs.existsSync(srcRestoreScript)) fs.copyFileSync(srcRestoreScript, path.join(localRepoDir, 'restore.ps1'));
                    if (fs.existsSync(srcAutoHeal)) fs.copyFileSync(srcAutoHeal, path.join(localRepoDir, 'auto_heal.ps1'));
                    if (fs.existsSync(srcReadme)) fs.copyFileSync(srcReadme, path.join(localRepoDir, 'README.md'));
                }
            }

            // 6. 准备待覆盖的文件到临时缓存区 (app.asar.new & app.asar.new.unpacked)
            const localNewAsar = path.join(scratchDir, 'app.asar.new');
            fs.copyFileSync(prebuiltAsar, localNewAsar);
            
            const localNewUnpacked = path.join(scratchDir, 'app.asar.new.unpacked');
            const hasNewUnpacked = prebuiltUnpacked && fs.existsSync(prebuiltUnpacked);
            if (hasNewUnpacked) {
                if (fs.existsSync(localNewUnpacked)) {
                    fs.rmSync(localNewUnpacked, { recursive: true, force: true });
                }
                fs.mkdirSync(localNewUnpacked, { recursive: true });
                execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Copy-Item -Path '${prebuiltUnpacked}\\*' -Destination '${localNewUnpacked}' -Recurse -Force"`, { stdio: 'ignore' });
            }

            // 7. 生成重启覆盖批处理脚本 (写在 scratch 目录下，以便它运行后可以安全地物理清理整个 tempDir 临时下载目录)
            const appPath = path.join(userHome, 'AppData', 'Local', 'Programs', 'antigravity');
            const asarPath = path.join(appPath, 'resources', 'app.asar');
            const restartBatPath = path.join(scratchDir, 'restart.bat');
            
            let batContent = `@echo off
timeout /t 1 /nobreak >nul
:: 1. 覆盖 app.asar 主程序包
copy /y "${localNewAsar}" "${asarPath}"
:: 2. 覆盖 app.asar.unpacked 解包依赖文件夹
`;
            if (hasNewUnpacked) {
                batContent += `if exist "${localNewUnpacked}" (
    xcopy /y /e /i /q "${localNewUnpacked}" "${appPath}\\resources\\app.asar.unpacked"
)
`;
            }
            batContent += `:: 3. 缓存一份最新版到 scratch，供自愈服务自启动自愈机制使用
copy /y "${localNewAsar}" "${path.join(scratchDir, 'app.asar')}"
`;
            if (hasNewUnpacked) {
                batContent += `if exist "${localNewUnpacked}" (
    xcopy /y /e /i /q "${localNewUnpacked}" "${path.join(scratchDir, 'app.asar.unpacked')}"
)
`;
            }
            batContent += `:: 4. 清理本地缓存打包生成临时垃圾
del /f /q "${localNewAsar}"
`;
            if (hasNewUnpacked) {
                batContent += `if exist "${localNewUnpacked}" (
    rmdir /s /q "${localNewUnpacked}"
)
`;
            }
            batContent += `:: 5. 彻底删除临时下载解压工作空间
rmdir /s /q "${tempDir}"
:: 6. 重启拉起应用
start "" "${path.join(appPath, 'Antigravity.exe')}"
exit
`;
            fs.writeFileSync(restartBatPath, batContent.replace(/\r?\n/g, '\r\n'), 'ascii');
            
            process.noAsar = originalNoAsar;
            return { success: true, restartScript: restartBatPath };
        } catch(e) {
            process.noAsar = originalNoAsar;
            console.error('Trigger update error:', e);
            try {
                const fs = require('fs');
                const path = require('path');
                const os = require('os');
                const errLog = path.join(os.homedir(), '.gemini', 'antigravity', 'scratch', 'update_error.txt');
                fs.writeFileSync(errLog, `Error: ${e.message}\nStack: ${e.stack}\n`, 'utf-8');
            } catch(logErr) {
                console.error('Failed to write error log:', logErr);
            }
            return { success: false, error: e.message };
        }
    });

    electron_1.ipcMain.handle('patch:restart-app', async (_event, restartScript) => {
        const { spawn } = require('child_process');
        spawn('cmd.exe', ['/c', restartScript], {
            detached: true,
            stdio: 'ignore'
        }).unref();
        electron_1.app.quit();
    });


}

async function pollLocalQuota() {
    try {
        const languageServer = require("./languageServer");
        const port = languageServer.getLsPort();
        const csrf = languageServer.getLsCsrf();
        
        appendQuotaDebugLog(`[MAIN_POLL_TICK] port=${port} csrf=${csrf}\n`);

        if (!port || !csrf) return;

        // Fetch the fresh quota summary with force_refresh = true (using Field 2 payload [0x10, 0x01])
        const forceRefreshPayload = Buffer.from([0, 0, 0, 0, 2, 16, 1]);
        const data = await requestGrpc(port, csrf, '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary', forceRefreshPayload);
        
        if (data && data.length > 0) {
            const quotas = parseProtoQuota(data);
            
            if (quotas && Object.keys(quotas).length > 0) {
                appendQuotaDebugLog(`[MAIN_POLL_SUCCESS] quotas=${JSON.stringify(quotas)}\n`);

                const windows = electron_1.BrowserWindow.getAllWindows();
                for (const win of windows) {
                    if (win.webContents) {
                        win.webContents.executeJavaScript(`
                            localStorage.setItem("quota_gemini_weekly", "${quotas.gemini_weekly || '0%'}");
                            localStorage.setItem("quota_gemini_5h", "${quotas.gemini_5h || '0%'}");
                            localStorage.setItem("quota_claude_weekly", "${quotas.claude_weekly || '0%'}");
                            localStorage.setItem("quota_claude_5h", "${quotas.claude_5h || '0%'}");
                        `).catch(()=>{});
                    }
                }
            } else {
                appendQuotaDebugLog(`[MAIN_POLL_EMPTY_QUOTAS] parsed 0 quotas\n`);
            }
        } else {
            appendQuotaDebugLog(`[MAIN_POLL_EMPTY_DATA] response length is 0\n`);
        }
    } catch (e) {
        appendQuotaDebugLog(`[MAIN_POLL_ERR] execution error: ${e.message}\n`);
        console.error('pollLocalQuota execution error:', e);
    }
}

function requestGrpc(port, csrf, path, payload) {
    return new Promise((resolve) => {
        const https = require('https');
        const body = payload || Buffer.from([0, 0, 0, 0, 0]);

        const options = {
            hostname: '127.0.0.1',
            port: port,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/grpc-web+proto',
                'x-codeium-csrf-token': csrf,
                'x-grpc-web': '1'
            },
            rejectUnauthorized: false,
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        });

        req.on('error', (e) => {
            appendQuotaDebugLog(`[MAIN_POLL_REQ_ERR] path=${path} err=${e.message}\n`);
            console.error(`requestGrpc error on ${path}:`, e.message);
            resolve(Buffer.alloc(0));
        });

        req.on('timeout', () => {
            appendQuotaDebugLog(`[MAIN_POLL_TIMEOUT] path=${path}\n`);
            req.destroy();
            resolve(Buffer.alloc(0));
        });

        req.write(body);
        req.end();
    });
}

function parseProtoQuota(buffer) {
    const results = {};
    const keys = [
        { key: 'gemini-weekly', name: 'gemini_weekly' },
        { key: 'gemini-5h', name: 'gemini_5h' },
        { key: '3p-weekly', name: 'claude_weekly' },
        { key: '3p-5h', name: 'claude_5h' }
    ];
    
    for (const item of keys) {
        const keyIndex = buffer.indexOf(item.key);
        if (keyIndex === -1) continue;
        
        let floatMarkerIndex = -1;
        for (let i = keyIndex + item.key.length; i < keyIndex + 500 && i < buffer.length; i++) {
            if (buffer[i] === 0x25) {
                floatMarkerIndex = i;
                break;
            }
        }
        
        if (floatMarkerIndex !== -1 && floatMarkerIndex + 4 < buffer.length) {
            const floatBytes = buffer.slice(floatMarkerIndex + 1, floatMarkerIndex + 5);
            const floatValue = floatBytes.readFloatLE(0);
            // Calculate used percentage directly to align with the Settings UI
            const used = Math.max(0, Math.min(100, Math.round(floatValue * 100)));
            results[item.name] = used + '%';
        }
    }
    return results;
}


function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const options = {
            headers: {
                'User-Agent': 'Antigravity-Assistant'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status code: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const fs = require('fs');
        const file = fs.createWriteStream(dest);
        
        const request = (targetUrl) => {
            https.get(targetUrl, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    request(response.headers.location);
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        };
        request(url);
    });
}


function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const options = {
            headers: {
                'User-Agent': 'Antigravity-Assistant'
            }
        };
        https.get(url, options, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`Status code: ${res.statusCode}`));
                return;
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch(e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const https = require('https');
        const fs = require('fs');
        const file = fs.createWriteStream(dest);
        
        const request = (targetUrl) => {
            https.get(targetUrl, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    request(response.headers.location);
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });
        };
        request(url);
    });
}
