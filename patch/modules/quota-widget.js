/**
 * modules/quota-widget.js
 * Antigravity-Chinese v2 - 棰濆害鏄剧ず缁勪欢
 * 渚濊禆锛歵heme-adapter.js锛坓etNativeThemeColors锛? * 鍖呭惈锛歶pdateStoredQuota, injectQuotaWidget, getCurrentModel
 * 
 * 鉁?宸插寘鍚?BugFix锛氶槻姝?Gemini 鍚庡彴鎺㈤拡鍝嶅簲姹℃煋 Claude/GPT 棰濆害鏄剧ず
 */

function updateStoredQuota() {
  try {
    const dialog = document.querySelector('[role="dialog"], .settings-modal, .onboarding-modal');
    if (!dialog) return;
    const allDivs = dialog.querySelectorAll('*');
    for (let i = 0; i < allDivs.length; i++) {
      const el = allDivs[i];
      if (!el || el.children.length > 0) continue;
      const text = el.textContent ? el.textContent.trim() : '';
      if (text.includes('姣忓懆棰濆害闄愰') || text.includes('Weekly Limit')) {
        const val = findPercentageNearby(el);
        if (val) {
          const group = checkModelGroup(el);
          if (group === 'gemini') localStorage.setItem('quota_gemini_weekly', val);
          else if (group === 'claude') localStorage.setItem('quota_claude_weekly', val);
        }
      } else if (text.includes('浜斿皬鏃堕搴﹂檺棰?) || text.includes('Five Hour Limit') || text.includes('5-hour limit')) {
        const val = findPercentageNearby(el);
        if (val) {
          const group = checkModelGroup(el);
          if (group === 'gemini') localStorage.setItem('quota_gemini_5h', val);
          else if (group === 'claude') localStorage.setItem('quota_claude_5h', val);
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

// BUG FIX: 绮惧噯妫€娴嬪綋鍓?UI 閫変腑鐨勬ā鍨嬶紝鎺掗櫎瀵硅瘽姘旀场鍐呭鐨勫共鎵?function getCurrentModel() {
  try {
    // 浼樺厛鏌ヨ搴曢儴宸ュ叿鏍忕殑涓撳睘妯″瀷閫夋嫨鍣?    const modelSelectors = [
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
    // 娆￠€夛細鍙壂鎻忓簳閮ㄨ緭鍏ュ尯鍩燂紝璺宠繃闀挎枃鏈紙瀵硅瘽姘旀场锛?    const bottomBar = document.querySelector('.bottom-bar, .input-area, .composer, footer, form');
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
  return 'Gemini';
}

function injectQuotaWidget() {
  try {
    // 1. 寮傛杞藉叆澶氳处鍙峰垪琛?    if (window.antigravityAccounts === undefined) {
      window.antigravityAccounts = null;
      electron_1.ipcRenderer.invoke('accounts:list').then(res => {
        window.antigravityAccounts = res.accounts || [];
        window.antigravityCurrentAccount = res.currentAccountId || '';
        injectQuotaWidget();
      }).catch(() => { window.antigravityAccounts = []; });
      return;
    }
    if (window.antigravityAccounts === null) return;

    // 2. 鎵惧埌鐩爣瀹瑰櫒锛堣缃寜閽尯鍩燂級
    const settingsBtn = Array.from(document.querySelectorAll('button, [role="button"], a')).find(el => {
      const text = el.textContent ? el.textContent.trim() : '';
      const label = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
      return text === '璁剧疆' || text === 'Settings' || label.includes('Settings') || label.includes('璁剧疆');
    });
    if (!settingsBtn || !settingsBtn.parentNode) return;

    updateStoredQuota();

    // 3. 鍒涘缓鎴栧鐢?widget
    let widget = document.getElementById('antigravity-quota-widget');
    if (!widget) {
      widget = document.createElement('div');
      widget.id = 'antigravity-quota-widget';
      const shadow = widget.attachShadow({ mode: 'open' });

      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; width: 100%; }
        .quota-root {
          padding: 8px 12px 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          border-top: 1px solid var(--ag-border);
          margin-bottom: 2px;
        }
        .quota-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .quota-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--ag-fg);
        }
        .quota-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 11px;
          color: var(--ag-muted-fg);
        }
        .quota-weekly, .quota-5h {
          font-size: 11px;
          font-weight: 500;
          color: var(--ag-fg);
        }
        .switcher-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .switcher-title {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: var(--ag-muted-fg);
        }
        .add-link {
          font-size: 10px;
          color: #3b82f6;
          cursor: pointer;
          padding: 1px 4px;
          border-radius: 3px;
          transition: background 0.15s;
        }
        .add-link:hover { background: rgba(59,130,246,0.12); }
        .select-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--ag-trigger-bg);
          border: 1px solid var(--ag-border);
          border-radius: 5px;
          padding: 5px 8px;
          cursor: pointer;
          font-size: 11px;
          color: var(--ag-fg);
          transition: background 0.15s;
        }
        .select-trigger:hover { background: var(--ag-hover); }
        .trigger-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .arrow-icon { margin-left: 4px; font-size: 9px; color: var(--ag-muted-fg); transition: transform 0.2s; }
        .dropdown-list {
          position: absolute;
          bottom: 100%;
          left: 0; right: 0;
          background: var(--ag-menu-bg);
          border: 1px solid var(--ag-border);
          border-radius: 6px;
          padding: 4px;
          display: none;
          flex-direction: column;
          gap: 2px;
          z-index: 10000;
          box-shadow: 0 -4px 16px rgba(0,0,0,0.15);
          max-height: 180px;
          overflow-y: auto;
        }
        .dropdown-item {
          padding: 7px 10px;
          border-radius: 4px;
          font-size: 11px;
          color: var(--ag-menu-fg);
          cursor: pointer;
          transition: background 0.12s;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dropdown-item:hover { background: var(--ag-hover); }
        .dropdown-item.active { color: #3b82f6; font-weight: 600; }
        .accounts-container { position: relative; }
      `;

      const root = document.createElement('div');
      root.className = 'quota-root';
      root.innerHTML = `
        <div class="quota-header">
          <span class="quota-title">gemini</span>
        </div>
        <div class="quota-row">
          <span>姣忓懆棰濆害</span>
          <span class="quota-weekly">--</span>
        </div>
        <div class="quota-row">
          <span>5灏忔椂棰濆害</span>
          <span class="quota-5h">--</span>
        </div>
        <div class="accounts-container"></div>
      `;

      shadow.appendChild(style);
      shadow.appendChild(root);
      settingsBtn.parentNode.insertBefore(widget, settingsBtn);
    }

    const root = widget.shadowRoot.querySelector('.quota-root');
    if (!root) return;

    // 4. 涓婚閫傞厤
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

    // BUG FIX: 閫氳繃鏃堕棿鎴抽槻姝?Gemini 鍚庡彴鎺㈤拡鏁版嵁姹℃煋褰撳墠 Claude 棰濆害鏄剧ず
    const geminiTs = parseInt(localStorage.getItem('quota_gemini_ts') || '0', 10);
    const claudeTs = parseInt(localStorage.getItem('quota_claude_ts') || '0', 10);
    const currentModel = getCurrentModel().toLowerCase();
    const isGemini = currentModel.includes('gemini');
    // 濡傛灉鐢?Claude 鏃?Gemini 鎺㈤拡鍒氳Е鍙戯紙5 绉掑唴锛夛細鍙潤榛樺瓨鍌ㄦ暟瀛楋紝涓嶆敼鏍囬
    const geminiJustUpdated = !isGemini && (geminiTs > claudeTs + 5000);

    const titleEl = root.querySelector('.quota-title');
    const weeklyEl = root.querySelector('.quota-weekly');
    const hourlyEl = root.querySelector('.quota-5h');
    const accountsContainer = root.querySelector('.accounts-container');

    if (isGemini) {
      if (titleEl.textContent !== 'gemini') { titleEl.textContent = 'gemini'; titleEl.style.color = '#3b82f6'; }
      if (weeklyEl.textContent !== gWeekly) weeklyEl.textContent = gWeekly;
      if (hourlyEl.textContent !== g5h) hourlyEl.textContent = g5h;
    } else if (geminiJustUpdated) {
      // 鍚庡彴鎺㈤拡鍒氭洿鏂颁簡 Gemini 鏁版嵁锛屼絾鎴戜滑鍦ㄧ敤 Claude 鈥斺€?鍙洿鏂版暟瀛楋紝涓嶆敼鏍囬
      if (weeklyEl.textContent !== gWeekly && gWeekly !== '--') weeklyEl.textContent = gWeekly;
      if (hourlyEl.textContent !== g5h && g5h !== '--') hourlyEl.textContent = g5h;
    } else {
      const isGpt = currentModel.includes('gpt');
      const titleText = isGpt ? 'gpt' : 'claude';
      const color = isGpt ? '#f59e0b' : '#10b981';
      if (titleEl.textContent !== titleText) { titleEl.textContent = titleText; titleEl.style.color = color; }
      if (weeklyEl.textContent !== cWeekly) weeklyEl.textContent = cWeekly;
      if (hourlyEl.textContent !== c5h) hourlyEl.textContent = c5h;
    }

    // 5. 璐﹀彿鍒囨崲 UI
    let trigger = accountsContainer.querySelector('#antigravity-account-select-trigger');
    if (!trigger && window.antigravityAccounts && window.antigravityAccounts.length > 0) {
      const currentAcc = window.antigravityAccounts.find(a => a.id === window.antigravityCurrentAccount);
      const triggerLabel = currentAcc ? `${currentAcc.name} (${currentAcc.email})` : '鏈櫥褰曟垨閫夋嫨璐﹀彿';

      accountsContainer.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:4px;position:relative;" onclick="event.stopPropagation();">
          <div class="switcher-header">
            <span class="switcher-title">鍒囨崲璐﹀彿</span>
            <span id="antigravity-add-account" class="add-link">娣诲姞璐﹀彿</span>
          </div>
          <div id="antigravity-account-select-trigger" class="select-trigger">
            <span class="trigger-label">${triggerLabel}</span>
            <span class="arrow-icon">鈻?/span>
          </div>
          <div id="antigravity-account-dropdown" class="dropdown-list" style="display:none;"></div>
        </div>
      `;

      function renderDropdownItems() {
        const dropdown = accountsContainer.querySelector('#antigravity-account-dropdown');
        if (!dropdown) return;
        dropdown.innerHTML = '';
        (window.antigravityAccounts || []).forEach(acc => {
          const item = document.createElement('div');
          item.className = 'dropdown-item' + (acc.id === window.antigravityCurrentAccount ? ' active' : '');
          item.textContent = `${acc.name} (${acc.email})`;
          item.onclick = (e) => {
            e.stopPropagation();
            item.style.opacity = '0.5';
            item.style.pointerEvents = 'none';
            item.textContent = '姝ｅ湪鍒囨崲...';
            electron_1.ipcRenderer.invoke('accounts:switch', acc.id);
          };
          dropdown.appendChild(item);
        });
      }

      const triggerEl = accountsContainer.querySelector('#antigravity-account-select-trigger');
      if (triggerEl) {
        triggerEl.onclick = (e) => {
          e.stopPropagation();
          const dropdown = accountsContainer.querySelector('#antigravity-account-dropdown');
          const arrow = triggerEl.querySelector('.arrow-icon');
          if (!dropdown) return;
          if (dropdown.style.display === 'flex') {
            dropdown.style.display = 'none';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
          } else {
            renderDropdownItems();
            dropdown.style.display = 'flex';
            if (arrow) arrow.style.transform = 'rotate(180deg)';
          }
        };
      }

      if (!window.antigravityDropdownListenerAdded) {
        window.antigravityDropdownListenerAdded = true;
        document.addEventListener('click', () => {
          const w = document.getElementById('antigravity-quota-widget');
          if (w && w.shadowRoot) {
            const dp = w.shadowRoot.querySelector('#antigravity-account-dropdown');
            if (dp && dp.style.display === 'flex') {
              dp.style.display = 'none';
              const trg = w.shadowRoot.querySelector('#antigravity-account-select-trigger');
              if (trg) { const arr = trg.querySelector('.arrow-icon'); if (arr) arr.style.transform = 'rotate(0deg)'; }
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
          showBeautifulConfirm('鐧诲綍鏂拌处鍙?, '鏄惁瑕佹竻绌哄綋鍓嶇櫥褰曠姸鎬佸苟閲嶅惎瀹㈡埛绔互鐧诲綍鏂拌处鍙凤紵', '纭畾', '鍙栨秷').then(confirmed => {
            if (confirmed) {
              electron_1.ipcRenderer.invoke('accounts:clear-keyring');
            } else {
              addBtn.style.pointerEvents = 'auto';
              addBtn.style.opacity = '1';
            }
          }).catch(() => {
            addBtn.style.pointerEvents = 'auto';
            addBtn.style.opacity = '1';
          });
        };
        addBtn.onmousedown = (e) => e.stopPropagation();
      }
    } else if (trigger) {
      // 鏇存柊宸插瓨鍦ㄧ殑 trigger 鏍囩
      const currentAcc = window.antigravityAccounts ? window.antigravityAccounts.find(a => a.id === window.antigravityCurrentAccount) : null;
      const labelEl = trigger.querySelector('.trigger-label');
      if (labelEl) {
        const newLabel = currentAcc ? `${currentAcc.name} (${currentAcc.email})` : '鏈櫥褰曟垨閫夋嫨璐﹀彿';
        if (labelEl.textContent !== newLabel) labelEl.textContent = newLabel;
      }
    }
  } catch (e) {
    console.error('injectQuotaWidget error:', e);
  }
}

function readQuotaTheme(anchor) {
  const theme = getNativeThemeColors(anchor);
  const isDark = theme.isDark;
  return {
    fg: theme.foreground,
    muted: theme.muted,
    surface: theme.surface,
    card: theme.subtle,
    trigger: theme.subtle,
    menuBg: isDark ? 'rgba(30,32,38,0.98)' : 'rgba(255,255,255,0.98)',
    menuFg: theme.foreground,
    border: theme.border,
    hover: theme.subtleHover,
  };
}

module.exports = { updateStoredQuota, injectQuotaWidget, getCurrentModel };
