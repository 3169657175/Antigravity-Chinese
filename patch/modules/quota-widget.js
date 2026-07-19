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
      if (text.includes('每周额度限额') || text.includes('Weekly Limit')) {
        const val = findPercentageNearby(el);
        if (val) {
          const group = checkModelGroup(el);
          if (group === 'gemini') localStorage.setItem('quota_gemini_weekly', val);
          else if (group === 'claude') localStorage.setItem('quota_claude_weekly', val);
        }
      } else if (text.includes('五小时额度限制') || text.includes('Five Hour Limit') || text.includes('5-hour limit')) {
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

// BUG FIX: 精准检测当前 UI 选中的模型，排除对话气泡内容的干扰
function getCurrentModel() {
  try {
    // 优先查询底部工具栏的专属模型选择器
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
    // 娆￠€夛細鍙壂鎻忓簳閮ㄨ緭鍏ュ尯鍩燂紝璺宠繃闀挎枃鏈紙瀵硅瘽姘旀场锛?    
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
  return 'Gemini';
}

function injectQuotaWidget() {
  try {
    // 1. 寮傛杞藉叆澶氳处鍙峰垪琛?    
if (window.antigravityAccounts === undefined) {
      window.antigravityAccounts = null;
      electron_1.ipcRenderer.invoke('accounts:list').then(res => {
        window.antigravityAccounts = res.accounts || [];
        window.antigravityCurrentAccount = res.currentAccountId || '';
        injectQuotaWidget();
      }).catch(() => { window.antigravityAccounts = []; });
      return;
    }
    if (window.antigravityAccounts === null) return;

    // 2. 找到目标容器（设置按钮区域）
    const settingsBtn = Array.from(document.querySelectorAll('button, [role="button"], a')).find(el => {
      const text = el.textContent ? el.textContent.trim() : '';
      const label = el.getAttribute ? (el.getAttribute('aria-label') || '') : '';
      return text === '璁剧疆' || text === 'Settings' || label.includes('Settings') || label.includes('璁剧疆');
    });
    if (!settingsBtn || !settingsBtn.parentNode) return;

    updateStoredQuota();

    // 3. 创建或复用 widget
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

    // 4. 主题适配
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

    // BUG FIX: 通过时间戳防止 Gemini 后台探测数据污染当前 Claude 额度显示
    const geminiTs = parseInt(localStorage.getItem('quota_gemini_ts') || '0', 10);
    const claudeTs = parseInt(localStorage.getItem('quota_claude_ts') || '0', 10);
    const currentModel = getCurrentModel().toLowerCase();
    const isGemini = currentModel.includes('gemini');
    // 如果用 Claude 时 Gemini 探测刚触发（5 秒内）：只静默存储数字，不改标题
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
      // 后台探测刚更新了 Gemini 数据，但我们在用 Claude —— 只更新数字，不改标题
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

    // 5. 账号切换 UI
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
          showAgyAddAccountModal();
        };
        addBtn.onmousedown = (e) => e.stopPropagation();
      }

    } else if (trigger) {
      // 更新已存在的 trigger 标签
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


// ==========================================
// Google OAuth & JSON 导入自定义毛玻璃弹窗组件 (物理追加)
// ==========================================
function showAgyAddAccountModal() {
  // 1. 避免重复弹窗
  if (document.getElementById('agy-add-account-overlay')) return;

  // 2. 注入弹窗专属样式 (赛博暗黑毛玻璃风格)
  const styleId = 'agy-add-account-styles';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
      .agy-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(5, 7, 10, 0.7);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        display: flex; justify-content: center; align-items: center;
        z-index: 999999;
        animation: agyFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .agy-card {
        background: rgba(18, 20, 26, 0.95);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 36px 32px;
        width: 380px;
        max-width: 90%;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px rgba(59,130,246,0.1);
        text-align: center;
        color: #f3f4f6;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-sizing: border-box;
        animation: agySlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .agy-title {
        font-size: 18px; font-weight: 700; margin: 0 0 10px 0;
        background: linear-gradient(to right, #ffffff, #c7d2fe);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      .agy-desc {
        font-size: 12px; color: #9ca3af; line-height: 1.5; margin: 0 0 24px 0;
      }
      .agy-btn {
        width: 100%; padding: 12px 16px; border-radius: 8px;
        font-size: 13px; font-weight: 600; cursor: pointer;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        box-sizing: border-box; border: 1px solid transparent;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        margin-bottom: 12px;
      }
      .agy-btn-primary {
        background: linear-gradient(135deg, #2563eb, #3b82f6);
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(59,130,246,0.25);
      }
      .agy-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(59,130,246,0.35);
      }
      .agy-btn-secondary {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.08);
        color: #e5e7eb;
      }
      .agy-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.15);
      }
      .agy-cancel-link {
        font-size: 12px; color: #9ca3af; cursor: pointer; text-decoration: none;
        display: inline-block; margin-top: 14px;
        transition: color 0.15s;
      }
      .agy-cancel-link:hover { color: #f3f4f6; }
      
      /* Status display */
      .agy-status-area {
        margin: 16px 0; font-size: 12px; min-height: 20px;
        display: flex; flex-direction: column; align-items: center; gap: 10px;
      }
      
      /* Code input panel */
      .agy-input-panel {
        display: flex; gap: 8px; width: 100%; box-sizing: border-box;
      }
      .agy-input {
        flex: 1; padding: 8px 12px; border-radius: 6px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #ffffff; font-size: 12px; outline: none;
      }
      .agy-input:focus {
        border-color: #3b82f6;
      }
      .agy-submit-btn {
        padding: 8px 14px; border-radius: 6px; background: #10b981;
        color: #ffffff; font-size: 12px; font-weight: 600; cursor: pointer;
        border: none; transition: background 0.15s;
      }
      .agy-submit-btn:hover { background: #059669; }

      @keyframes agyFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes agySlideUp {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(styleEl);
  }

  // 3. 动态渲染弹窗 DOM 结构
  const overlay = document.createElement('div');
  overlay.id = 'agy-add-account-overlay';
  overlay.className = 'agy-overlay';
  
  overlay.innerHTML = `
    <div class="agy-card" onclick="event.stopPropagation();">
      <div class="agy-title">添加新账号</div>
      <div class="agy-desc">通过 Google 网页一键安全登录授权，或直接选择导入已导出的账号配置文件。</div>
      
      <button id="agy-btn-oauth" class="agy-btn agy-btn-primary">
        <span>🌐</span> Google OAuth 网页登录
      </button>
      
      <button id="agy-btn-json" class="agy-btn agy-btn-secondary">
        <span>📁</span> 导入 JSON 配置文件
      </button>

      <div id="agy-status-area" class="agy-status-area"></div>
      
      <div>
        <span id="agy-btn-cancel" class="agy-cancel-link">取消</span>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // 4. 事件绑定与状态流转
  const btnOauth = overlay.querySelector('#agy-btn-oauth');
  const btnJson = overlay.querySelector('#agy-btn-json');
  const btnCancel = overlay.querySelector('#agy-btn-cancel');
  const statusArea = overlay.querySelector('#agy-status-area');

  const closeModal = () => {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  };

  btnCancel.onclick = closeModal;
  overlay.onclick = closeModal;

  // A. Google OAuth 网页一键授权
  btnOauth.onclick = async () => {
    btnOauth.disabled = true;
    btnOauth.style.opacity = '0.5';
    statusArea.innerHTML = '<span style="color:#60a5fa;">正在拉起系统浏览器进行授权...</span>';
    
    const oRes = await electron_1.ipcRenderer.invoke('oauth:start-login');
    if (oRes && oRes.success) {
      statusArea.innerHTML = `
        <div style="color:#9ca3af;margin-bottom:8px;line-height:1.4;">请在打开的网页中登录您的 Google 账号以完成授权。</div>
        <div class="agy-input-panel">
          <input type="text" id="agy-manual-code" class="agy-input" placeholder="自动拦截失败时可在此粘贴 Code" />
          <button id="agy-manual-submit" class="agy-submit-btn">提交</button>
        </div>
      `;

      const submitBtn = statusArea.querySelector('#agy-manual-submit');
      const inputCode = statusArea.querySelector('#agy-manual-code');
      if (submitBtn && inputCode) {
        submitBtn.onclick = async () => {
          const codeValue = inputCode.value.trim();
          if (!codeValue) {
            alert('请输入有效的 Code！');
            return;
          }
          submitBtn.disabled = true;
          submitBtn.textContent = '提交中';
          statusArea.innerHTML = '<span style="color:#00ffcc;font-weight:600;">⚡ 正在兑换 Token 并安全导入...</span>';
          
          const aRes = await electron_1.ipcRenderer.invoke('oauth:submit-code', codeValue);
          if (aRes && aRes.success) {
            statusArea.innerHTML = '<span style="color:#4ade80;font-weight:600;">✓ 导入成功！正在同步...</span>';
            setTimeout(async () => {
              closeModal();
              // 刷新列表
              const listRes = await electron_1.ipcRenderer.invoke('accounts:list');
              window.antigravityAccounts = listRes.accounts || [];
              window.antigravityCurrentAccount = listRes.currentAccountId || '';
              injectQuotaWidget();
            }, 1000);
          } else {
            statusArea.innerHTML = `<span style="color:#f43f5e;font-weight:600;">❌ 导入失败: ${aRes?.error || '未知错误'}</span>`;
            btnOauth.disabled = false;
            btnOauth.style.opacity = '1';
          }
        };
      }
    } else {
      statusArea.innerHTML = `<span style="color:#f43f5e;font-weight:600;">❌ 启动网页登录失败: ${oRes?.error || '未知错误'}</span>`;
      btnOauth.disabled = false;
      btnOauth.style.opacity = '1';
    }
  };

  // B. 原生 JSON 配置文件导入
  btnJson.onclick = async () => {
    btnJson.disabled = true;
    btnJson.style.opacity = '0.5';
    statusArea.innerHTML = '<span style="color:#60a5fa;">正在选择文件...</span>';
    
    const jRes = await electron_1.ipcRenderer.invoke('accounts:import-json-dialog');
    if (jRes && jRes.success) {
      statusArea.innerHTML = '<span style="color:#4ade80;font-weight:600;">✓ 导入成功！正在同步...</span>';
      setTimeout(async () => {
        closeModal();
        const listRes = await electron_1.ipcRenderer.invoke('accounts:list');
        window.antigravityAccounts = listRes.accounts || [];
        window.antigravityCurrentAccount = listRes.currentAccountId || '';
        injectQuotaWidget();
      }, 1000);
    } else {
      statusArea.innerHTML = '';
      btnJson.disabled = false;
      btnJson.style.opacity = '1';
      if (jRes?.error && jRes.error !== '用户取消了选择') {
        alert('导入失败: ' + jRes.error);
      }
    }
  };
}

// C. 监听主进程网页登录自动拦截发来的 code 凭据
if (!window.antigravityOauthListenerAdded) {
  window.antigravityOauthListenerAdded = true;
  
  electron_1.ipcRenderer.on('oauth:code-captured', async (_event, { code }) => {
    const statusArea = document.getElementById('agy-status-area');
    if (statusArea) {
      statusArea.innerHTML = '<span style="color:#00ffcc;font-weight:600;">⚡ 正在兑换 Token 并安全导入...</span>';
    }
    
    const aRes = await electron_1.ipcRenderer.invoke('oauth:submit-code', code);
    const modalOverlay = document.getElementById('agy-add-account-overlay');
    if (aRes && aRes.success) {
      if (statusArea) {
        statusArea.innerHTML = '<span style="color:#4ade80;font-weight:600;">✓ 导入成功！正在同步...</span>';
      }
      setTimeout(async () => {
        if (modalOverlay) modalOverlay.parentNode.removeChild(modalOverlay);
        const listRes = await electron_1.ipcRenderer.invoke('accounts:list');
        window.antigravityAccounts = listRes.accounts || [];
        window.antigravityCurrentAccount = listRes.currentAccountId || '';
        injectQuotaWidget();
      }, 1000);
    } else {
      if (statusArea) {
        statusArea.innerHTML = `<span style="color:#f43f5e;font-weight:600;">❌ 自动导入失败: ${aRes?.error || '未知错误'}</span>`;
      }
    }
  });

  // 监听主进程 accounts:clear-keyring 的拦截重定向通知，触发本模块弹窗
  electron_1.ipcRenderer.on('accounts:open-add-modal', () => {
    showAgyAddAccountModal();
  });
}
