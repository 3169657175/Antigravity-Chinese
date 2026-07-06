/**
 * modules/update-checker.js
 * Antigravity-Chinese v2 - 鑷姩鏇存柊妫€娴嬫ā鍧? * 渚濊禆锛歵heme-adapter.js锛坓etNativeThemeColors锛? * 鎻愪緵锛歴etupVersionUpdater
 */

function setupVersionUpdater() {
  const CURRENT_VERSION = 'v2.0.0';

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
        <span class="version-label">姹夊寲鎻掍欢 ${CURRENT_VERSION}</span>
        <span id="antigravity-patch-update-btn" style="display:none;margin-left:8px;padding:1px 6px;border-radius:10px;font-size:10px;font-weight:bold;background:#e0f2fe;color:#0369a1;border:1px solid #bae6fd;cursor:pointer;transition:all 0.2s;">鏈夋柊鐗堟湰</span>
      `;

      root.appendChild(widget);

      const btn = document.getElementById('antigravity-patch-update-btn');
      if (btn) {
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; btn.style.background = '#bae6fd'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.background = '#e0f2fe'; };
        btn.onclick = (e) => { e.stopPropagation(); handleUpdateClick(btn); };
      }
    }

    // 鍔ㄦ€侀鑹茶嚜閫傚簲
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
      if (val) { fgColor = val; break; }
      const color = style.color;
      if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') { fgColor = color; break; }
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
          if (data.tag_name && isNewerVersion(data.tag_name, CURRENT_VERSION)) {
            updateUrl = data.html_url;
            if (data.assets && data.assets.length > 0) {
              const updateAsset = data.assets.find(a => a.name && a.name.toLowerCase().includes('update.zip'));
              downloadUrl = updateAsset ? updateAsset.browser_download_url : data.assets[0].browser_download_url;
              const interval = setInterval(() => {
                const btn = document.getElementById('antigravity-patch-update-btn');
                if (btn) { btn.style.display = 'inline-block'; clearInterval(interval); }
              }, 1000);
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
        btn.onmouseenter = () => { btn.style.transform = 'scale(1.05)'; btn.style.background = '#bbf7d0'; };
        btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.background = '#dcfce7'; };
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

module.exports = { setupVersionUpdater };
