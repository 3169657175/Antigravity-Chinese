/**
 * modules/account-switcher.js
 * Antigravity-Chinese v2 - 鐧诲綍椤佃处鍙峰揩鎹峰垏鎹㈢粍浠? * 渚濊禆锛歵heme-adapter.js锛坓etNativeThemeColors锛? * 鎻愪緵锛歩njectQuickLogin
 */

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
    qkContainer.style.cssText = 'margin-top:28px;width:100%;display:flex;flex-direction:column;align-items:center;gap:10px;opacity:0;transition:opacity 0.25s cubic-bezier(0.25,1,0.5,1);';

    electron_1.ipcRenderer.invoke('accounts:list').then(res => {
      const accounts = res.accounts || [];
      if (accounts.length === 0) return;

      const title = document.createElement('div');
      title.style.cssText = `font-size:12px;font-weight:600;color:${quickTheme.muted};opacity:1;margin-bottom:6px;letter-spacing:1px;text-transform:uppercase;user-select:none;`;
      title.textContent = '鈥?蹇嵎鐧诲綍宸插瓨璐﹀彿 鈥?;
      qkContainer.appendChild(title);

      accounts.forEach(acc => {
        const btn = document.createElement('div');
        btn.style.cssText = `width:260px;padding:10px 16px;border-radius:8px;border:1px solid ${quickTheme.border};background:${quickTheme.subtle};color:${quickTheme.foreground};font-size:12.5px;font-weight:500;cursor:pointer;text-align:center;box-sizing:border-box;transition:all 0.18s cubic-bezier(0.25,1,0.5,1);text-overflow:ellipsis;overflow:hidden;white-space:nowrap;`;
        btn.textContent = `${acc.name} (${acc.email})`;

        btn.onmouseenter = () => {
          btn.style.background = quickTheme.isDark ? 'rgba(59,130,246,0.16)' : 'rgba(59,130,246,0.08)';
          btn.style.borderColor = 'rgba(59,130,246,0.4)';
          btn.style.color = quickTheme.accent;
          btn.style.transform = 'translateY(-1px)';
          btn.style.boxShadow = quickTheme.isDark ? '0 4px 14px rgba(0,0,0,0.28)' : '0 4px 12px rgba(59,130,246,0.15)';
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
      console.error('[preload] Failed to fetch accounts for quick login:', err);
    });
  } catch (e) {
    console.error('[preload] Quick login UI injection failed:', e);
  }
}

module.exports = { injectQuickLogin };
