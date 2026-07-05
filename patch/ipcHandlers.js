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
            nodeFs.appendFileSync('C:/Users/niu/.gemini/antigravity/scratch/mcp_spy.txt', text, 'utf-8');
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

    setTimeout(() => {
        lastPollTime = Date.now();
        pollLocalQuota();
    }, 5000);   // First poll after 5s

    // Accounts list handler
    electron_1.ipcMain.handle('accounts:list', async () => {
        try {
            const os = require('os');
            const path = require('path');
            const fs = require('fs/promises');
            const userHome = os.homedir();
            const accountsPath = path.join(userHome, '.antigravity_tools', 'accounts.json');
            
            const raw = await fs.readFile(accountsPath, 'utf-8');
            const data = JSON.parse(raw);
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
            const raw = await fs.readFile(accountsPath, 'utf-8');
            const data = JSON.parse(raw);
            
            const acc = (data.accounts || []).find(a => a.id === accountId);
            if (!acc) throw new Error('Account not found in registry');
            
            const detailPath = path.join(userHome, '.antigravity_tools', 'accounts', `${accountId}.json`);
            const detailRaw = await fs.readFile(detailPath, 'utf-8');
            const detail = JSON.parse(detailRaw);
            
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
            await fs.writeFile(accountsPath, JSON.stringify(data, null, 2), 'utf-8');
            
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

    // Accounts get current keyring handler
    electron_1.ipcMain.handle('accounts:get-current-keyring', async () => {
        try {
            const os = require('os');
            const path = require('path');
            const fs = require('fs');
            const { execSync } = require('child_process');
            
            if (process.platform !== 'win32') return null;
            
            const tempPsFile = path.join(os.tmpdir(), `agy_read_cred_${Date.now()}.ps1`);
            const readScript = `
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
            
            try {
                const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPsFile}"`, { encoding: 'utf-8', timeout: 5000 });
                if (fs.existsSync(tempPsFile)) fs.unlinkSync(tempPsFile);
                
                const lines = out.split('\n');
                for (const line of lines) {
                    if (line.startsWith('VALUE: ')) {
                        const jsonStr = line.substring(7).trim();
                        if (jsonStr) {
                            return JSON.parse(jsonStr);
                        }
                    }
                }
            } catch (e) {
                if (fs.existsSync(tempPsFile)) fs.unlinkSync(tempPsFile);
                console.error('[ipcHandlers] accounts:get-current-keyring run error:', e);
            }
            return null;
        } catch (e) {
            console.error('[ipcHandlers] accounts:get-current-keyring error:', e);
            return null;
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
                const fs = require('fs/promises');
                const userHome = os.homedir();
                const accountsPath = path.join(userHome, '.antigravity_tools', 'accounts.json');
                const raw = await fs.readFile(accountsPath, 'utf-8');
                const data = JSON.parse(raw);
                data.current_account_id = '';
                await fs.writeFile(accountsPath, JSON.stringify(data, null, 2), 'utf-8');
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

    // Accounts save new handler
    electron_1.ipcMain.handle('accounts:save-new', async (_event, { email, name, token }) => {
        try {
            const os = require('os');
            const path = require('path');
            const fs = require('fs/promises');
            const crypto = require('crypto');
            const userHome = os.homedir();
            
            const baseDir = path.join(userHome, '.antigravity_tools');
            await fs.mkdir(baseDir, { recursive: true });
            await fs.mkdir(path.join(baseDir, 'accounts'), { recursive: true });
            
            const accountsPath = path.join(baseDir, 'accounts.json');
            let data = { version: "2.0", accounts: [], current_account_id: "" };
            
            try {
                const raw = await fs.readFile(accountsPath, 'utf-8');
                data = JSON.parse(raw);
            } catch (e) {
                // If accounts.json doesn't exist, we use the default empty one
            }
            
            // Check if email already exists
            let acc = (data.accounts || []).find(a => a.email.toLowerCase() === email.toLowerCase());
            const accountId = acc ? acc.id : crypto.randomUUID();
            
            if (!acc) {
                acc = {
                    id: accountId,
                    email: email,
                    name: name || email.split('@')[0],
                    disabled: false
                };
                data.accounts.push(acc);
            } else {
                // Update name if changed
                if (name) acc.name = name;
            }
            
            data.current_account_id = accountId;
            
            // Save detailed JSON file (which holds access_token and refresh_token)
            const detailPath = path.join(baseDir, 'accounts', `${accountId}.json`);
            let existingDetail = {};
            try {
                const detailRaw = await fs.readFile(detailPath, 'utf-8');
                existingDetail = JSON.parse(detailRaw);
            } catch (e) {}
            
            const deviceProfile = existingDetail.device_profile || {
                machine_id: "auth0|user_" + accountId.replace(/-/g, '').substring(0, 24),
                mac_machine_id: crypto.randomUUID(),
                dev_device_id: crypto.randomUUID(),
                sqm_id: "{" + crypto.randomUUID().toUpperCase() + "}"
            };
            
            const newDetail = {
                id: accountId,
                email: email,
                name: name || email.split('@')[0],
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
            
            await fs.writeFile(detailPath, JSON.stringify(newDetail, null, 2), 'utf-8');
            await fs.writeFile(accountsPath, JSON.stringify(data, null, 2), 'utf-8');
            
            console.log('[ipcHandlers] Successfully saved/updated account in pool:', email);
            return { success: true, id: accountId };
        } catch (e) {
            console.error('[ipcHandlers] accounts:save-new error:', e);
            return { success: false, error: e.message };
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
            
            const raw = await fs.readFile(accountsPath, 'utf-8');
            const data = JSON.parse(raw);
            
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
            
            await fs.writeFile(accountsPath, JSON.stringify(data, null, 2), 'utf-8');
            
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
}

async function pollLocalQuota() {
    try {
        const languageServer = require("./languageServer");
        const port = languageServer.getLsPort();
        const csrf = languageServer.getLsCsrf();
        
        // Diagnostic tick log
        try {
            const fs = require('fs');
            fs.appendFileSync('C:/Users/niu/.gemini/antigravity/scratch/mcp_spy.txt', `[MAIN_POLL_TICK] port=${port} csrf=${csrf}\n`, 'utf-8');
        } catch (e) {}

        if (!port || !csrf) return;

        // Fetch the fresh quota summary with force_refresh = true (using Field 2 payload [0x10, 0x01])
        const forceRefreshPayload = Buffer.from([0, 0, 0, 0, 2, 16, 1]);
        const data = await requestGrpc(port, csrf, '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary', forceRefreshPayload);
        
        if (data && data.length > 0) {
            const quotas = parseProtoQuota(data);
            
            if (quotas && Object.keys(quotas).length > 0) {
                // Diagnostic log
                try {
                    const fs = require('fs');
                    fs.appendFileSync('C:/Users/niu/.gemini/antigravity/scratch/mcp_spy.txt', `[MAIN_POLL_SUCCESS] quotas=${JSON.stringify(quotas)}\n`, 'utf-8');
                } catch (e) {}

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
                try {
                    const fs = require('fs');
                    fs.appendFileSync('C:/Users/niu/.gemini/antigravity/scratch/mcp_spy.txt', `[MAIN_POLL_EMPTY_QUOTAS] parsed 0 quotas\n`, 'utf-8');
                } catch (e) {}
            }
        } else {
            try {
                const fs = require('fs');
                fs.appendFileSync('C:/Users/niu/.gemini/antigravity/scratch/mcp_spy.txt', `[MAIN_POLL_EMPTY_DATA] response length is 0\n`, 'utf-8');
            } catch (e) {}
        }
    } catch (e) {
        try {
            const fs = require('fs');
            fs.appendFileSync('C:/Users/niu/.gemini/antigravity/scratch/mcp_spy.txt', `[MAIN_POLL_ERR] execution error: ${e.message}\n`, 'utf-8');
        } catch (err) {}
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
            try {
                const fs = require('fs');
                fs.appendFileSync('C:/Users/niu/.gemini/antigravity/scratch/mcp_spy.txt', `[MAIN_POLL_REQ_ERR] path=${path} err=${e.message}\n`, 'utf-8');
            } catch (err) {}
            console.error(`requestGrpc error on ${path}:`, e.message);
            resolve(Buffer.alloc(0));
        });

        req.on('timeout', () => {
            try {
                const fs = require('fs');
                fs.appendFileSync('C:/Users/niu/.gemini/antigravity/scratch/mcp_spy.txt', `[MAIN_POLL_TIMEOUT] path=${path}\n`, 'utf-8');
            } catch (err) {}
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
