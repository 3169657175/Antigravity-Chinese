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
// Antigravity 2.0 Chinese Localization Entry
// ==========================================
(function() {
  const { startObserver } = require('./core/engine');

  const dictUrls = [
    'https://raw.githubusercontent.com/3169657175/Antigravity-Chinese/main/patch/locales/dict.json',
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
            const localDict = require('./locales/dict.json');
            Object.assign(localDict, data);
            console.log('Antigravity Chinese Patch: Cloud dictionary updated successfully from ' + new URL(url).hostname + '! Total keys: ' + Object.keys(data).length);
            
            // Force refresh current body translation
            if (document.body) {
              const { translateNode } = require('./core/engine');
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

  // --- Sidebar Minimalist Quota Monitor ---
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

  function injectQuotaWidget() {
    try {
      if (window.antigravityAccounts === undefined) {
        window.antigravityAccounts = null;
        try {
          electron_1.ipcRenderer.invoke('accounts:list').then(res => {
            window.antigravityAccounts = res.accounts || [];
            window.antigravityCurrentAccount = res.currentAccountId || '';
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
      
      function getCurrentModel() {
        try {
          const interactives = document.querySelectorAll('button, [role="button"], .select, .trigger, .dropdown, a');
          for (let i = 0; i < interactives.length; i++) {
            const el = interactives[i];
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

            <div id="antigravity-account-dropdown" class="dropdown-list" style="display: none;"></div>
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

          const items = dropdown.querySelectorAll('.account-item, .add-new-item');
          items.forEach(item => {
            const itemId = item.getAttribute('data-id');
            const isCurrent = itemId === window.antigravityCurrentAccount;

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

            const delBtn = item.querySelector('.delete-btn');
            if (delBtn) {
              const targetAcc = window.antigravityAccounts.find(a => a.id === itemId);
              delBtn.onclick = (ev) => {
                ev.stopPropagation();
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

  // --- Webpage Context Telemetry Injection ---
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

        const origSend = XMLHttpRequest.prototype.send;
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this._url = url;
          this._method = method;
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[XHR_REQ] url=' + url + ' method=' + method + '\\n');
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

        const OrigWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[WS_OPEN] url=' + url + '\\n');
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

        const OrigEventSource = window.EventSource;
        window.EventSource = function(url, configuration) {
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[SSE_OPEN] url=' + url + '\\n');
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
      if (now - lastNotify > 3000) {
        lastNotify = now;
        electron_1.ipcRenderer.send('user-active');
      }
    };
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
      const CURRENT_VERSION = 'v1.2.1';

      function injectVersionElement() {
          let widget = document.getElementById('antigravity-version-widget');
          if (!widget) {
              const root = document.documentElement || document.body;
              if (!root) return;
              
              widget = document.createElement('div');
              widget.id = 'antigravity-version-widget';
              
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
          
          const theme = getNativeThemeColors();
          let fgColor = '';
          
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
          
          if (!fgColor || fgColor.includes('rgba(255, 255, 255, 0.7)') || fgColor === 'transparent') {
              fgColor = theme.isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(16, 16, 16, 0.85)';
          }
          
          widget.style.color = fgColor;
          widget.style.border = theme.isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.15)';
      }
      
      let updateUrl = null;
      let downloadUrl = null;
      
      setTimeout(() => {
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
          
          electron_1.ipcRenderer.invoke('patch:trigger-update', downloadUrl).then(res => {
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
