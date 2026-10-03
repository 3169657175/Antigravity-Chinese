// ==========================================
// FRONTEND LOGIC: RENDERER (前端交互核心)
// ==========================================

// 获取常用 DOM 节点
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');
const navItems = document.querySelectorAll('.nav-item');
const tabPanes = document.querySelectorAll('.tab-pane');
const logTerminal = document.getElementById('terminal-log-output');
const btnClearTerminal = document.getElementById('btn-clear-terminal');
const safeDom = window.AgySafeDom || { text: value => String(value ?? ''), errorMessage: error => String(error?.message || error || ''), imageUrl: () => '' };
const uiFeedback = window.AgyUiFeedback || { notify: (message, type) => console[type === 'error' ? 'error' : 'log'](message), confirm: message => Promise.resolve(window.confirm(message)) };
const communityState = window.AgyCommunityState;
const pageLifecycle = window.AgyPageLifecycle || { once: (_key, task) => Promise.resolve().then(task), reset: () => {}, has: () => false };
const errorDiagnostics = window.AgyErrorDiagnostics || { classify: input => ({ title: '操作失败', message: String(input?.message || input?.error || input || '未知错误') }) };
function notifyUiError(input, fallbackTitle = '操作失败') { const info = errorDiagnostics.classify(input); uiFeedback.notify(info.message, 'error', { title: info.title || fallbackTitle }); return info; }

// 网络配置
const switchNetworkBypass = document.getElementById('switch-network-bypass');
const btnSaveNetwork = document.getElementById('btn-save-network');
const btnTogglePatchDeveloperMode = document.getElementById('btn-toggle-patch-developer-mode');

// 本地账号
const btnRefreshLocalAccounts = document.getElementById('btn-refresh-local-accounts');

// Skill 生成器 (工坊)
const inputSkillName = document.getElementById('input-skill-name');
const inputSkillDesc = document.getElementById('input-skill-desc');
const inputSkillPrompt = document.getElementById('input-skill-prompt');
const btnGenerateSkill = document.getElementById('btn-generate-skill');
const customSkillResult = document.getElementById('custom-skill-result');

// 状态池
let appPaths = null;
let feedbackSearchTimer = null;

function syncCommunityStateToWindow() {
  if (communityState) window.currentFeedbacksDesktop = communityState.all();
}

async function ensureAuthLoaded() {
  return pageLifecycle.once('auth-session', () => checkAuthSession());
}

function feedbackFromState(id) {
  const items = communityState?.all?.() || window.currentFeedbacksDesktop || [];
  return items.find(item => String(item.id) === String(id)) || null;
}

function applyFeedbackLikeVisual(id, liked, count) {
  const btnMain = document.getElementById(`like-btn-${id}`);
  const countMain = document.getElementById(`like-count-${id}`);
  const btnDetail = document.getElementById(`detail-like-btn-${id}`);
  const countDetail = document.getElementById(`detail-like-count-${id}`);
  for (const [button, counter] of [[btnMain, countMain], [btnDetail, countDetail]]) {
    if (counter) counter.textContent = String(Math.max(0, Number(count) || 0));
    if (button) button.classList.toggle('liked', Boolean(liked));
  }
}

function renderFeedbackDetailFromState(id) {
  const item = feedbackFromState(id);
  if (item) renderDetailModalContentDesktop(item);
  const count = document.getElementById(`main-comment-count-${id}`);
  if (count && item) count.textContent = Array.isArray(item.replies) ? item.replies.length : 0;
}

async function reconcileFeedbacksInBackground() {
  try {
    const sort = document.getElementById('feedback-sort')?.value || 'newest';
    const res = await window.agyHubAPI.fetchFeedbacks({ sort });
    if (!res?.success) return false;
    communityState?.setAll(res.data);
    syncCommunityStateToWindow();
    if (document.getElementById('tab-feedback')?.classList.contains('active')) await loadFeedbacks(true, { silent: true });
    return true;
  } catch (error) {
    console.warn('[Community] background reconcile failed:', error.message);
    return false;
  }
}

async function ensureCommunityLoaded() {
  await ensureAuthLoaded();
  return pageLifecycle.once('community-page', async () => {
    await Promise.all([loadFeedbacks(false, { showSkeleton: true }), loadAnnouncementSystemDesktop()]);
  });
}

function scheduleAfterPaint(task, timeout = 250) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const run = () => Promise.resolve().then(task).catch(error => {
        console.error('[UI Background Task]', error);
      });
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(run, { timeout });
      } else {
        setTimeout(run, 0);
      }
    });
  });
}

function formatCompactCount(value) {
  const numeric = Math.max(0, Number(value) || 0);
  const scales = [
    { minimum: 1_000_000_000, suffix: 'B' },
    { minimum: 1_000_000, suffix: 'M' },
    { minimum: 1_000, suffix: 'K' }
  ];
  const scale = scales.find(item => numeric >= item.minimum);
  if (!scale) return Math.round(numeric).toLocaleString('en-US');
  const scaled = numeric / scale.minimum;
  const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
  return `${Number(scaled.toFixed(digits))}${scale.suffix}`;
}

function setCompactCount(element, value, label, unit = 'Token') {
  if (!element) return;
  const numeric = Math.max(0, Number(value) || 0);
  const exact = Math.round(numeric).toLocaleString('en-US');
  element.textContent = formatCompactCount(numeric);
  element.title = `${label}：${exact}${unit ? ` ${unit}` : ''}`;
  element.setAttribute('aria-label', element.title);
  element.dataset.exactValue = String(Math.round(numeric));
}

// ==========================================
// 1. 全局初始化与选项卡切换
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  logToTerminal('[Info] 正在初始化 AGY Hub 核心引擎...');
  window.AgyFeatureFlags?.apply?.();
  ensureAuthLoaded();
  
  // 绑定窗口控制按钮
  btnMinimize.addEventListener('click', () => window.agyHubAPI.minimizeWindow());
  btnClose.addEventListener('click', () => window.agyHubAPI.closeWindow());

  // 绑定选项卡点击切换
  window.AgyNavigationController.bind({ navItems, tabPanes, onNavigate: (targetId, item) => {
      
      // 切换导航项 Active
      // Active state is owned by navigationController.js.

      // 切换面板 Active
      const targetPane = document.getElementById(targetId);
      
      logToTerminal(`[Navigate] 切换至选项卡: ${item.querySelector('.nav-text').textContent}`);

      // 动态载入联动
      if (targetId === 'tab-feedback') {
        scheduleAfterPaint(() => ensureCommunityLoaded());
      } else if (targetId === 'tab-admin-users') {
        ensureAuthLoaded().then(() => loadAdminUserData());
      } else if (targetId === 'tab-admin-announcement') {
        loadAnnouncementHistory();
      } else if (targetId === 'tab-local-accounts') {
        pageLifecycle.once('local-accounts-page', async () => {
          await loadLocalAccounts();
          await initTokenMonitor();
        });
      } else if (targetId === 'tab-codex-gateway') {
        pageLifecycle.once('codex-page', () => initCodexGateway()).then(() => {
          scheduleAfterPaint(() => document.dispatchEvent(new CustomEvent('agy-codex-tab-opened')));
        });
      } else if (targetId === 'tab-mcp' || targetId === 'tab-skill-market') {
        pageLifecycle.once('marketplace-page', () => initMarketplace()).then(() => {
          window.AgyMarketplaceController?.reflow?.(targetId);
          document.dispatchEvent(new CustomEvent('agy-marketplace-tab-opened', { detail: { targetId } }));
        });
      }
  }});

  // 清除日志
  btnClearTerminal.addEventListener('click', () => {
    logTerminal.innerHTML = '[System] 日志终端已清空。';
  });

  if (btnRefreshLocalAccounts) {
    btnRefreshLocalAccounts.addEventListener('click', loadLocalAccounts);
  }

  // 【性能优化】：将原本阻塞首屏渲染的串行磁盘/IO检测重构为并发异步非阻塞加载，首屏秒开！
  initPatchPage().then(() => Promise.all([initNetworkStatus(), initPatchDeveloperMode()])).then(() => {
    logToTerminal('[System] 核心管理组件并发初始化就绪，冷工业极简模式载入成功。');
  }).catch(err => {
    logToTerminal(`组件载入异常: ${err.message}`, 'error');
  });
  initThemeManager();
});

async function initMarketplace() {
  const controller = window.AgyMarketplaceController;
  if (!controller || typeof controller.init !== 'function') throw new Error('扩展市场控制器未加载');
  return controller.init({ appPaths, logToTerminal });
}

async function initThemeManager() {
  const controller = window.AgyThemeController;
  if (!controller || typeof controller.init !== 'function') throw new Error('主题控制器未加载');
  return controller.init({ scheduleAfterPaint, logToTerminal });
}

async function loadLocalAccounts() {
  const controller = window.AgyLocalAccountsController;
  if (!controller || typeof controller.loadLocalAccounts !== 'function') {
    throw new Error('本地账号控制器未加载');
  }
  return controller.loadLocalAccounts({ logToTerminal });
}

function logToTerminal(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  let prefix = '[LOG]';
  if (type === 'error') prefix = '❌ [ERROR]';
  if (type === 'success') prefix = '✅ [SUCCESS]';
  
  logTerminal.innerHTML += `\n[${time}] ${prefix} ${msg}`;
  logTerminal.scrollTop = logTerminal.scrollHeight; // 滚动到底部
}

// ==========================================
// 2. 自动检测目录与版本逻辑
// ==========================================
async function initPatchPage() {
  const controller = window.AgyPatchController;
  if (!controller || typeof controller.init !== 'function') throw new Error('汉化补丁控制器未加载');
  appPaths = await controller.init({ logToTerminal });
  return appPaths;
}

let patchDeveloperModeEnabled = false;

function renderPatchDeveloperMode() {
  if (!btnTogglePatchDeveloperMode) return;
  btnTogglePatchDeveloperMode.textContent = patchDeveloperModeEnabled ? '已开启' : '已关闭';
  btnTogglePatchDeveloperMode.setAttribute('aria-pressed', patchDeveloperModeEnabled ? 'true' : 'false');
  btnTogglePatchDeveloperMode.title = patchDeveloperModeEnabled
    ? '关闭后隐藏 Antigravity 中的汉化维护信息'
    : '开启后显示 Antigravity 中的汉化维护信息';
}

async function initPatchDeveloperMode() {
  if (!btnTogglePatchDeveloperMode || !window.agyHubAPI.getIntegrationConfig) return;
  try {
    const result = await window.agyHubAPI.getIntegrationConfig();
    patchDeveloperModeEnabled = Boolean(result?.success && result.data?.developerMode);
  } catch (_) {
    patchDeveloperModeEnabled = false;
  }
  renderPatchDeveloperMode();
}

if (btnTogglePatchDeveloperMode) {
  btnTogglePatchDeveloperMode.addEventListener('click', async () => {
    const next = !patchDeveloperModeEnabled;
    try {
      const result = await window.agyHubAPI.saveIntegrationConfig({ developerMode: next });
      if (!result?.success) throw new Error(result?.error || '保存失败');
      patchDeveloperModeEnabled = next;
      renderPatchDeveloperMode();
      logToTerminal(`[Patch] 开发者模式已${next ? '开启' : '关闭'}；Antigravity 维护入口会自动同步。`, 'success');
    } catch (error) {
      notifyUiError(error, '开发者模式保存失败');
    }
  });
}

// 4. 极简免 TUN 分流网络状态初始化与激活
// ==========================================
async function initNetworkStatus() {
  if (!switchNetworkBypass) return;
  try {
    const res = await window.agyHubAPI.getNetworkConfig();
    if (res.success && res.data) {
      switchNetworkBypass.checked = res.data.active;
      logToTerminal(`[Network] 已成功读取上次保存的免 TUN 分流设置，当前：${res.data.active ? '已启用 (7890 端口)' : '已禁用'}`);
    }
  } catch (e) {
    switchNetworkBypass.checked = true; // 默认开启
  }
}

if (btnSaveNetwork && switchNetworkBypass) {
  btnSaveNetwork.addEventListener('click', async () => {
    const active = switchNetworkBypass.checked;
    const port = 7890; // 端口静默锁定为 7890 常用代理端口，摒弃用户手动设置

    if (active) {
      logToTerminal(`[Network] 正在检测本地代理服务 127.0.0.1:${port} 连通性...`);
      try {
        // 原生 TCP 套接字握手，不触碰命令执行
        const testResult = await window.agyHubAPI.checkProxyPort(port);
        if (!testResult.success) {
          logToTerminal(`[警告] 代理测试失败: ${testResult.error}`, 'error');
          alert(`⚠️ 本地代理端口 ${port} 连接测试未通畅！\n\n原因: ${testResult.error}\n\n建议:\n1. 确保 Clash / v2ray / NekoBox 已经在后台运行。\n2. 确认其本地 Socks / HTTP 代理端口确实为 ${7890}。`);
          switchNetworkBypass.checked = false;
          return;
        }

        logToTerminal(`[Network] 本地代理服务连接测试成功，握手耗时正常。`, 'success');
        
        const saveRes = await window.agyHubAPI.saveNetworkConfig({ mode: 'bypass', active: true, port: port });
        if (saveRes.success) {
          logToTerminal(`[Network] 免 TUN 局部加速代理已成功保存并激活！配置存入: ${saveRes.path}`, 'success');
          alert('💾 免 TUN 分流网络代理已成功保存并激活！');
        }
      } catch (err) {
        logToTerminal(err.message, 'error');
      }
    } else {
      // 用户选择关闭网络代理
      logToTerminal('[Network] 正在禁用免 TUN 局部代理，流量将走系统直连。');
      try {
        const saveRes = await window.agyHubAPI.saveNetworkConfig({ mode: 'direct', active: false, port: port });
        if (saveRes.success) {
          logToTerminal(`[Network] 网络代理已关闭！已切回全局直连模式。`, 'success');
          alert('💾 网络策略修改成功！已切回直连模式。');
        }
      } catch (err) {
        logToTerminal(err.message, 'error');
      }
    }
  });
}

// ==========================================
// 7. 自定义 Skill 创造工坊
// ==========================================
btnGenerateSkill.addEventListener('click', async () => {
  const name = inputSkillName.value.trim().toLowerCase();
  const desc = inputSkillDesc.value.trim();
  const prompt = inputSkillPrompt.value.trim();

  if (!name || !desc || !prompt) {
    customSkillResult.className = 'integration-result error';
    customSkillResult.textContent = '请完整填写技能标识、功能说明和指令内容。';
    return;
  }
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(name)) {
    customSkillResult.className = 'integration-result error';
    customSkillResult.textContent = '技能标识只能使用小写英文字母、数字和连字符，长度为 2-64 个字符。';
    return;
  }

  logToTerminal(`[Skill] 正在编译新自定义智能体技能 [${name}]...`);

  const skillMarkdown = `---
name: ${name}
description: ${yamlString(desc)}
---

# ${name}

${prompt}
`;

  try {
    btnGenerateSkill.disabled = true;
    customSkillResult.className = 'integration-result';
    customSkillResult.textContent = '正在写入官方目录并重新读取校验...';
    const res = await window.agyHubAPI.writeSkill(null, name, skillMarkdown);
    if (res.success && res.verified) {
      installedSkillIds.add(name);
      customSkillResult.className = 'integration-result success';
      customSkillResult.textContent = `创建成功并校验通过：${res.path}。重新打开 Antigravity 对话后可被发现。`;
      logToTerminal(`自定义 Skill [${name}] 已写入官方目录并校验通过。`, 'success');
      inputSkillName.value = '';
      inputSkillDesc.value = '';
      inputSkillPrompt.value = '';
    } else {
      customSkillResult.className = 'integration-result error';
      customSkillResult.textContent = `创建失败：${res.error}`;
      logToTerminal(`Skill 生成失败: ${res.error}`, 'error');
    }
  } catch (err) {
    customSkillResult.className = 'integration-result error';
    customSkillResult.textContent = `创建失败：${err.message}`;
    logToTerminal(err.message, 'error');
  } finally {
    btnGenerateSkill.disabled = false;
  }
});

// ==========================================
// 8. 终端控制台手动折叠交互逻辑 (完全静默，默认且一直保持折叠)
// ==========================================
const btnToggleTerminal = document.getElementById('btn-toggle-terminal');
const terminalBar = document.getElementById('terminal-bar');

if (btnToggleTerminal && terminalBar) {
  // 确保初始加载时绝对收起
  terminalBar.classList.remove('expanded');
  btnToggleTerminal.textContent = '显示日志';

  btnToggleTerminal.addEventListener('click', () => {
    const isExpanded = terminalBar.classList.toggle('expanded');
    btnToggleTerminal.textContent = isExpanded ? '隐藏日志' : '显示日志';
    
    // 同步给父容器 main-wrapper 切换高度避让 class
    const mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.classList.toggle('terminal-expanded', isExpanded);
    }
  });

  // 重写输出日志到终端的 logToTerminal (完全静默更新，不干扰主界面)
  const originalLogToTerminal = window.logToTerminal;
  window.logToTerminal = function(msg, type = 'info') {
    const time = new Date().toLocaleTimeString();
    let prefix = '[LOG]';
    if (type === 'error') prefix = '❌ [ERROR]';
    if (type === 'success') prefix = '✅ [SUCCESS]';
    
    logTerminal.innerHTML += `\n[${time}] ${prefix} ${msg}`;
    logTerminal.scrollTop = logTerminal.scrollHeight;
  };
}

// ==========================================
// 9. 网页与桌面结合：极客登录与反馈看板前端交互驱动 (高级重构版)
// ==========================================
let currentUser = null;
let uploadedImageUrl = ''; // 全局保存发帖已上传图片的 R2 CDN 链接
let uploadedAnnImageUrl = ''; // 全局保存发布公告已上传图片的 R2 CDN 链接
let uploadTarget = 'feedback'; // 'feedback' 或 'announcement'

function initFeedbackBoard() {
  const tabFeedback = document.getElementById('tab-feedback');
  if (!tabFeedback) return;

  // --- A. 全局模态框控制 ---
  const authModal = document.getElementById('auth-modal');
  const btnTitlebarLogin = document.getElementById('btn-titlebar-login');
  const btnCloseAuthModal = document.getElementById('btn-close-auth-modal');
  const btnLockTriggerLogin = document.getElementById('btn-lock-trigger-login');

  const focusActiveAuthInput = () => {
    if (!authModal || authModal.style.display === 'none') return;
    const activeForm = authModal.querySelector('.auth-form-box.active');
    if (!activeForm) return;
    const inputs = activeForm.querySelectorAll('input:not([disabled])');
    if (!inputs || inputs.length === 0) return;

    let targetInput = inputs[0];
    if (inputs.length > 1 && inputs[0].value.trim() !== '') {
      targetInput = inputs[1];
    }

    try {
      targetInput.focus({ preventScroll: true });
      if (targetInput.value) {
        targetInput.select();
      }
    } catch (_) {}
  };

  const showAuthModal = async () => {
    if (!authModal) return;
    authModal.style.display = 'flex';
    authModal.style.pointerEvents = 'auto';
    authModal.setAttribute('aria-hidden', 'false');
    void authModal.offsetHeight;
    try {
      await window.agyHubAPI.focusMainWindow();
    } catch (_) {}
    setTimeout(() => {
      focusActiveAuthInput();
    }, 60);
  };

  const hideAuthModal = () => {
    if (!authModal) return;
    if (authModal.contains(document.activeElement)) document.activeElement.blur();
    authModal.style.display = 'none';
    authModal.setAttribute('aria-hidden', 'true');
  };

  if (btnTitlebarLogin) btnTitlebarLogin.addEventListener('click', showAuthModal);
  if (btnLockTriggerLogin) btnLockTriggerLogin.addEventListener('click', showAuthModal);
  if (btnCloseAuthModal) btnCloseAuthModal.addEventListener('click', hideAuthModal);

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) hideAuthModal();
    });
    window.addEventListener('focus', () => {
      requestAnimationFrame(focusActiveAuthInput);
    });
  }

  // --- A.2 详情模态框关闭控制 ---
  const detailModal = document.getElementById('feedback-detail-modal');
  const detailModalCloseBtn = document.getElementById('detail-modal-close-btn');
  if (detailModalCloseBtn && detailModal) {
    detailModalCloseBtn.addEventListener('click', () => {
      detailModal.classList.remove('active');
      setTimeout(() => { detailModal.style.display = 'none'; }, 280);
      // 不触发全量 loadFeedbacks，保留当前卡片的点赞状态
    });
    detailModal.addEventListener('click', (e) => {
      if (e.target === detailModal) {
        detailModal.classList.remove('active');
        setTimeout(() => { detailModal.style.display = 'none'; }, 280);
        // 不触发全量 loadFeedbacks，保留当前卡片的点赞状态
      }
    });
  }


  // --- 内联 Auth 提示与焦点修复函数 ---
  const showAuthBanner = (msg, type = 'error') => {
    const banner = document.getElementById('auth-msg-banner');
    if (!banner) return;
    banner.textContent = msg;
    banner.style.display = 'block';
    if (type === 'success') {
      banner.style.background = 'rgba(16, 185, 129, 0.15)';
      banner.style.border = '1px solid rgba(16, 185, 129, 0.4)';
      banner.style.color = '#34d399';
    } else {
      banner.style.background = 'rgba(244, 63, 94, 0.15)';
      banner.style.border = '1px solid rgba(244, 63, 94, 0.4)';
      banner.style.color = '#fb7185';
    }
  };

  const clearAuthBanner = () => {
    const banner = document.getElementById('auth-msg-banner');
    if (banner) banner.style.display = 'none';
  };

  // --- B. 登录与注册 Tab 切换 ---
  const btnTabLogin = document.getElementById('btn-tab-login');
  const btnTabRegister = document.getElementById('btn-tab-register');
  const formLoginBox = document.getElementById('form-login-box');
  const formRegisterBox = document.getElementById('form-register-box');
  const inputLoginUser = document.getElementById('input-login-username');
  const inputLoginPass = document.getElementById('input-login-password');
  const inputRegUser = document.getElementById('input-reg-username');
  const inputRegPass = document.getElementById('input-reg-password');

  if (btnTabLogin && btnTabRegister) {
    btnTabLogin.addEventListener('click', async () => {
      btnTabLogin.classList.add('active');
      btnTabRegister.classList.remove('active');
      formLoginBox.classList.add('active');
      formRegisterBox.classList.remove('active');
      clearAuthBanner();
      try {
        await window.agyHubAPI.focusMainWindow();
      } catch (_) {}
      setTimeout(() => {
        if (inputLoginUser && inputLoginUser.value.trim()) {
          inputLoginPass && inputLoginPass.focus({ preventScroll: true });
        } else if (inputLoginUser) {
          inputLoginUser.focus({ preventScroll: true });
        }
      }, 50);
    });

    btnTabRegister.addEventListener('click', async () => {
      btnTabRegister.classList.add('active');
      btnTabLogin.classList.remove('active');
      formRegisterBox.classList.add('active');
      formLoginBox.classList.remove('active');
      clearAuthBanner();
      try {
        await window.agyHubAPI.focusMainWindow();
      } catch (_) {}
      setTimeout(() => {
        if (inputRegUser) inputRegUser.focus({ preventScroll: true });
      }, 50);
    });
  }

  // --- C. 提交登录 ---
  const btnSubmitLogin = document.getElementById('btn-submit-login');

  if (btnSubmitLogin) {
    btnSubmitLogin.addEventListener('click', async () => {
      const username = inputLoginUser.value.trim();
      const password = inputLoginPass.value.trim();

      if (!username || !password) {
        showAuthBanner('⚠️ 请填写完整账号与密码！', 'error');
        if (!username) inputLoginUser.focus();
        else inputLoginPass.focus();
        return;
      }

      btnSubmitLogin.disabled = true;
      btnSubmitLogin.textContent = '正在安全登录...';
      clearAuthBanner();

      try {
        const res = await window.agyHubAPI.authLogin(username, password);
        if (res.success) {
          logToTerminal(`[Auth] 极客账号 @${username} 登录成功！`, 'success');
          inputLoginUser.value = '';
          inputLoginPass.value = '';
          currentUser = res.data;
          logToTerminal(`[Auth-Login] 内存会话已载入, Token: ${currentUser.token ? (currentUser.token.slice(0, 10) + '...') : '无'}`, 'success');
          updateAuthUI();
          hideAuthModal();
          loadFeedbacks(); // 刷新以同步渲染“删除”按钮
          loadAdminUserData(); // 如果是管理员，获取用户列表信息
        } else {
          showAuthBanner(`❌ 登录失败: ${res.error || '密码错误或账号不存在'}`, 'error');
          logToTerminal(`[Auth] 登录失败: ${res.error}`, 'error');
          try {
            await window.agyHubAPI.focusMainWindow();
          } catch (_) {}
          setTimeout(() => {
            if (inputLoginPass) {
              inputLoginPass.focus({ preventScroll: true });
              inputLoginPass.select();
            }
          }, 50);
        }
      } catch (err) {
        showAuthBanner(`⚠️ 登录异常: ${err.message}`, 'error');
        logToTerminal(`[Auth] 登录异常: ${err.message}`, 'error');
      } finally {
        btnSubmitLogin.disabled = false;
        btnSubmitLogin.textContent = '立即登录';
      }
    });
  }

  // --- D. 提交注册 ---
  const btnSubmitRegister = document.getElementById('btn-submit-register');

  if (btnSubmitRegister) {
    btnSubmitRegister.addEventListener('click', async () => {
      const username = inputRegUser.value.trim();
      const password = inputRegPass.value.trim();

      if (!username || !password) {
        showAuthBanner('⚠️ 请填写完整的账号与设置密码！', 'error');
        if (!username) inputRegUser.focus();
        else inputRegPass.focus();
        return;
      }
      if (username.length < 3 || username.length > 20) {
        showAuthBanner('⚠️ 用户名长度必须在 3 到 20 字之间！', 'error');
        inputRegUser.focus();
        return;
      }
      if (password.length < 6) {
        showAuthBanner('⚠️ 密码长度不能少于 6 位！', 'error');
        inputRegPass.focus();
        return;
      }

      btnSubmitRegister.disabled = true;
      btnSubmitRegister.textContent = '正在提交注册...';
      clearAuthBanner();

      try {
        const res = await window.agyHubAPI.authRegister(username, password);
        if (res.success) {
          logToTerminal(`[Auth] 新账号 @${username} 注册成功。`, 'success');
          inputRegUser.value = '';
          inputRegPass.value = '';
          
          // 自动平滑切换到登录面板
          btnTabLogin.click();
          inputLoginUser.value = username;
          inputLoginPass.value = '';
          
          showAuthBanner(`🎉 账号 @${username} 注册成功！请输入密码完成登录。`, 'success');
          
          try {
            await window.agyHubAPI.focusMainWindow();
          } catch (_) {}
          
          setTimeout(() => {
            if (inputLoginPass) {
              inputLoginPass.focus({ preventScroll: true });
            }
          }, 80);
        } else {
          showAuthBanner(`❌ 注册失败: ${res.error || '用户名已被占用'}`, 'error');
          logToTerminal(`[Auth] 注册失败: ${res.error}`, 'error');
          try {
            await window.agyHubAPI.focusMainWindow();
          } catch (_) {}
          setTimeout(() => {
            if (inputRegUser) inputRegUser.focus({ preventScroll: true });
          }, 50);
        }
      } catch (err) {
        showAuthBanner(`⚠️ 注册异常: ${err.message}`, 'error');
        logToTerminal(`[Auth] 注册异常: ${err.message}`, 'error');
      } finally {
        btnSubmitRegister.disabled = false;
        btnSubmitRegister.textContent = '提交注册';
      }
    });
  }

  // --- E. 账号注销 (右上角) ---
  const btnTitlebarLogout = document.getElementById('btn-titlebar-logout');
  if (btnTitlebarLogout) {
    btnTitlebarLogout.addEventListener('click', async () => {
      await window.agyHubAPI.authLogout();
      logToTerminal('[Auth] 极客账号已退出登录。');
      currentUser = null;
      updateAuthUI();
      loadFeedbacks();
      showAuthModal();
    });
  }

  // --- F. 侧边栏官网外部跳转 ---
  const btnVisitWebsite = document.getElementById('btn-visit-website');
  if (btnVisitWebsite) {
    btnVisitWebsite.addEventListener('click', () => {
      window.agyHubAPI.openExternalUrl('https://myagy.me/');
      logToTerminal('[Website] 已调用默认浏览器跳转至网站 myagy.me');
    });
  }

  // --- G. 字数计数器监听 ---
  const inputFeedbackContent = document.getElementById('input-feedback-content');
  const textCharCounter = document.getElementById('text-char-counter');
  if (inputFeedbackContent && textCharCounter) {
    inputFeedbackContent.addEventListener('input', () => {
      const len = inputFeedbackContent.value.length;
      textCharCounter.textContent = `${len} / 500`;
    });
  }
  const feedbackClickTargets = [
    inputFeedbackContent,
    document.getElementById('btn-trigger-upload'),
    document.getElementById('btn-send-feedback')
  ].filter(Boolean);
  feedbackClickTargets.forEach(target => {
    target.addEventListener('pointerdown', async () => {
      try {
        await window.agyHubAPI.focusMainWindow();
      } catch (_) {}
      if (target === inputFeedbackContent) {
        requestAnimationFrame(() => inputFeedbackContent.focus({ preventScroll: true }));
      }
    }, { capture: true });
  });

  // --- H. 本地截图文件直接上传 (支持多场景分流) ---
  const btnTriggerUpload = document.getElementById('btn-trigger-upload');
  const btnTriggerAnnUpload = document.getElementById('btn-trigger-ann-upload');
  const inputFileImage = document.getElementById('input-file-image');
  
  // 反馈预览
  const uploadPreviewWrapper = document.getElementById('upload-preview-wrapper');
  const imgUploadPreview = document.getElementById('img-upload-preview');
  const textUploadStatus = document.getElementById('text-upload-status');
  const btnRemoveUploadedImg = document.getElementById('btn-remove-uploaded-img');

  // 公告预览
  const annUploadPreviewWrapper = document.getElementById('ann-upload-preview-wrapper');
  const imgAnnUploadPreview = document.getElementById('img-ann-upload-preview');
  const textAnnUploadStatus = document.getElementById('text-ann-upload-status');
  const btnRemoveAnnUploadedImg = document.getElementById('btn-remove-ann-uploaded-img');

  if (inputFileImage) {
    if (btnTriggerUpload) {
      btnTriggerUpload.addEventListener('click', () => {
        uploadTarget = 'feedback';
        inputFileImage.click();
      });
    }
    if (btnTriggerAnnUpload) {
      btnTriggerAnnUpload.addEventListener('click', () => {
        uploadTarget = 'announcement';
        inputFileImage.click();
      });
    }

    inputFileImage.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!currentUser || !currentUser.token) {
        uiFeedback.notify('请先登录后再上传图片', 'error', { title: '需要登录' });
        e.target.value = '';
        return;
      }

      if (!file.type.startsWith('image/')) {
        uiFeedback.notify('只允许上传图片文件', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        uiFeedback.notify('图片大小不能超过 5MB', 'error');
        return;
      }

      // 所见即所得本地缓存临时展示
      const objectUrl = URL.createObjectURL(file);
      if (uploadTarget === 'feedback') {
        if (uploadPreviewWrapper && imgUploadPreview) {
          imgUploadPreview.src = objectUrl;
          uploadPreviewWrapper.style.display = 'flex';
          textUploadStatus.textContent = '⏳ 正在上传...';
          textUploadStatus.style.color = 'var(--text-muted)';
        }
      } else {
        if (annUploadPreviewWrapper && imgAnnUploadPreview) {
          imgAnnUploadPreview.src = objectUrl;
          annUploadPreviewWrapper.style.display = 'flex';
          textAnnUploadStatus.textContent = '⏳ 正在上传...';
          textAnnUploadStatus.style.color = 'var(--text-muted)';
        }
      }

      try {
        const uploadResult = await window.agyHubAPI.uploadImage(file.path, uploadTarget);

        if (uploadResult.success && uploadResult.url) {
          if (uploadTarget === 'feedback') {
            uploadedImageUrl = uploadResult.url;
            textUploadStatus.textContent = '✅ 上传成功';
            textUploadStatus.style.color = 'var(--accent-green)';
            logToTerminal('[Upload] 反馈图片上传 R2 成功！', 'success');
          } else {
            uploadedAnnImageUrl = uploadResult.url;
            textAnnUploadStatus.textContent = '✅ 上传成功';
            textAnnUploadStatus.style.color = 'var(--accent-green)';
            logToTerminal('[Upload] 公告图片上传 R2 成功！', 'success');
          }
        } else {
          throw new Error(uploadResult.error || '服务器拒绝了上传');
        }
      } catch (err) {
        if (uploadTarget === 'feedback') {
          textUploadStatus.textContent = '❌ 上传失败';
          textUploadStatus.style.color = '#ff3333';
        } else {
          textAnnUploadStatus.textContent = '❌ 上传失败';
          textAnnUploadStatus.style.color = '#ff3333';
        }
        logToTerminal(`[Upload] 图片上传失败: ${err.message}`, 'error');
        notifyUiError(err, '图片上传失败');
      }
    });
  }

  // 移除已选图片
  if (btnRemoveUploadedImg) {
    btnRemoveUploadedImg.addEventListener('click', () => {
      if (inputFileImage) inputFileImage.value = '';
      uploadedImageUrl = '';
      if (uploadPreviewWrapper) uploadPreviewWrapper.style.display = 'none';
      if (imgUploadPreview) imgUploadPreview.src = '';
      logToTerminal('[Upload] 已清除待发送反馈截图。');
    });
  }

  // 移除公告图片
  if (btnRemoveAnnUploadedImg) {
    btnRemoveAnnUploadedImg.addEventListener('click', () => {
      if (inputFileImage) inputFileImage.value = '';
      uploadedAnnImageUrl = '';
      if (annUploadPreviewWrapper) annUploadPreviewWrapper.style.display = 'none';
      if (imgAnnUploadPreview) imgAnnUploadPreview.src = '';
      logToTerminal('[Upload] 已清除待发布公告截图。');
    });
  }

  // --- I. 发送反馈留言：1.3.0 乐观更新 ---
  const btnSendFeedback = document.getElementById('btn-send-feedback');
  if (btnSendFeedback) {
    btnSendFeedback.addEventListener('click', async () => {
      if (!currentUser) {
        uiFeedback.notify('请先登录您的极客账号后再发表反馈', 'error', { title: '需要登录' });
        return;
      }
      const content = inputFeedbackContent.value.trim();
      if (!content) {
        uiFeedback.notify('反馈内容不能为空', 'error');
        return;
      }

      const snapshot = communityState?.snapshot?.() || [];
      const pendingId = communityState?.pendingId?.('pending-feedback') || `pending-feedback-${Date.now()}`;
      const pending = {
        id: pendingId,
        username: currentUser.username,
        role: currentUser.role,
        content,
        image_url: uploadedImageUrl || '',
        created_at: Date.now(),
        likes_count: 0,
        has_liked: false,
        replies: [],
        pending: true
      };
      communityState?.upsert?.(pending);
      syncCommunityStateToWindow();
      await loadFeedbacks(true, { silent: true });
      inputFeedbackContent.value = '';
      if (textCharCounter) textCharCounter.textContent = '0 / 500';
      btnSendFeedback.disabled = true;
      btnSendFeedback.textContent = '发送中…';

      const imageAtSubmit = uploadedImageUrl;
      const res = await window.agyHubAPI.submitFeedback(content, imageAtSubmit);
      btnSendFeedback.disabled = false;
      btnSendFeedback.textContent = '发送';
      if (res.success) {
        if (btnRemoveUploadedImg) btnRemoveUploadedImg.click();
        logToTerminal('[Feedback] 反馈已提交，正在后台同步真实数据。', 'success');
        uiFeedback.notify('反馈已发布', 'success');
        reconcileFeedbacksInBackground();
      } else {
        communityState?.restore?.(snapshot);
        syncCommunityStateToWindow();
        await loadFeedbacks(true, { silent: true });
        inputFeedbackContent.value = content;
        const handled = await handleSessionExpiry(res.error);
        if (!handled) uiFeedback.notify(res.error || '发送失败', 'error', { title: '反馈发送失败' });
        logToTerminal(`[Feedback] 提交失败: ${res.error}`, 'error');
      }
    });
  }

  // --- J. 用户管理与公告独立 Tab 事件绑定 ---
  const adminUsersListContainer = document.getElementById('admin-users-list-container');
  const adminUsersListPanel = document.getElementById('admin-users-list-panel');
  const adminUserDetailPanel = document.getElementById('admin-user-detail-panel');
  const btnBackToUsers = document.getElementById('btn-back-to-users');
  const btnSubmitDetailResetPass = document.getElementById('btn-submit-detail-reset-pass');
  const inputDetailNewPass = document.getElementById('input-detail-new-pass');

  const btnPublishAnnouncement = document.getElementById('btn-publish-announcement');
  const inputAnnounceContent = document.getElementById('input-announce-content');
  const inputAnnounceEditId = document.getElementById('input-announce-edit-id');
  const btnCancelAnnEdit = document.getElementById('btn-cancel-ann-edit');
  const textAnnFormTitle = document.getElementById('text-ann-form-title');

  // J.3 公告图片上传直接共用前面全局定义的 H. 多端上传分流机制（无需在此重复绑定以防止变量重复声明）

  // J.4 公告发布/更新提交
  if (btnPublishAnnouncement && inputAnnounceContent) {
    btnPublishAnnouncement.addEventListener('click', async () => {
      if (!currentUser || currentUser.role !== 'admin') return;

      const content = inputAnnounceContent.value.trim();
      if (!content) {
        uiFeedback.notify('请输入公告内容', 'error');
        return;
      }

      const editId = inputAnnounceEditId.value;

      btnPublishAnnouncement.disabled = true;
      btnPublishAnnouncement.textContent = editId ? '正在保存修改...' : '正在发布公告...';

      try {
        const bodyData = { content, image_url: uploadedAnnImageUrl };
        if (editId) bodyData.id = parseInt(editId);

        const annRes = await window.AgyCommunityController.request('/api/announcement', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + currentUser.token
          },
          body: JSON.stringify(bodyData)
        });
        const annResult = await annRes.json();

        if (annRes.ok && annResult.success) {
          logToTerminal(editId ? `[Admin] 成功更新公告 ID: ${editId}` : '[Admin] 云端新公告发布成功！', 'success');
          uiFeedback.notify(editId ? '公告修改成功' : '公告发布成功', 'success');
          
          inputAnnounceContent.value = '';
          inputAnnounceEditId.value = '';
          if (btnRemoveAnnUploadedImg) btnRemoveAnnUploadedImg.click();
          if (btnCancelAnnEdit) btnCancelAnnEdit.click();
          
          loadAnnouncementHistory();
          loadAnnouncementSystemDesktop();
        } else {
          notifyUiError({ message: annResult.error }, '公告操作失败');
        }
      } catch (err) {
        notifyUiError(err, '公告操作失败');
      } finally {
        btnPublishAnnouncement.disabled = false;
        btnPublishAnnouncement.textContent = inputAnnounceEditId.value ? '保存公告修改' : '发布公告';
      }
    });
  }

  // J.5 取消编辑公告
  if (btnCancelAnnEdit) {
    btnCancelAnnEdit.addEventListener('click', () => {
      inputAnnounceEditId.value = '';
      inputAnnounceContent.value = '';
      if (btnRemoveAnnUploadedImg) btnRemoveAnnUploadedImg.click();
      if (textAnnFormTitle) textAnnFormTitle.textContent = '📢 发布系统新公告';
      btnPublishAnnouncement.textContent = '发布公告';
      btnCancelAnnEdit.style.display = 'none';
    });
  }

  // --- K. 大图灯箱预览控制 ---
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxLargeImg = document.getElementById('lightbox-large-img');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');

  const hideLightbox = () => {
    if (lightboxModal) lightboxModal.style.display = 'none';
  };

  if (btnCloseLightbox) btnCloseLightbox.addEventListener('click', hideLightbox);
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      hideLightbox();
    });
  }

  // 1.3.0：这里只绑定交互，反馈/公告在用户首次进入页面时按需加载。
}

async function checkAuthSession() {
  const res = await window.agyHubAPI.getAuthSession();
  if (res.success && res.data) {
    currentUser = res.data;
    logToTerminal(`[Auth-Loader] 自动载入本地登录: @${currentUser.username}, Token: ${currentUser.token ? (currentUser.token.slice(0, 10) + '...') : '无'}`, 'success');
    updateAuthUI();
  } else {
    logToTerminal(`[Auth-Loader] 本地未检测到已保存的登录会话`, 'info');
  }
}

// 获取管理员工作台所需的用户列表与数据统计 (渲染为平铺网格，并绑定二级详情交互)
async function loadAdminUserData() { return window.AgyAdminCommunity.loadUsers(); }

// 检测后端接口错误信息中是否包含 Token 失效/会话过期，只进行友好警示，绝不强制登出或清空缓存，保留已登录状态
async function handleSessionExpiry(errorMsg) {
  logToTerminal(`[DEBUG] 进入会话失效校验，错误消息为: "${errorMsg}"`, 'info');
  const isExpired = errorMsg && (
    errorMsg.includes('请先登录') || 
    errorMsg.includes('会话已') || 
    errorMsg.includes('Token') ||
    errorMsg.includes('未登录') ||
    errorMsg.includes('已过期')
  );
  if (isExpired) {
    logToTerminal(`[Auth] 后端提示登录态异常: ${errorMsg}`, 'error');
    uiFeedback.notify(errorMsg || '登录状态异常，请重新登录', 'error', { title: '登录状态异常' });
    return true;
  }
  return false;
}

// 更新全局登录 UI 状态 (联动管理员工作台显示/隐藏)
function updateAuthUI() {
  const btnTitlebarLogin = document.getElementById('btn-titlebar-login');
  const dropdownUser = document.getElementById('titlebar-user-dropdown');
  const textTitlebarUsername = document.getElementById('text-titlebar-username');
  
  const writeLockOverlay = document.getElementById('write-lock-overlay');
  const inputFeedbackContent = document.getElementById('input-feedback-content');
  const btnTriggerUpload = document.getElementById('btn-trigger-upload');
  const btnSendFeedback = document.getElementById('btn-send-feedback');

  const adminNavs = document.querySelectorAll('.nav-admin-only');

  if (currentUser) {
    if (btnTitlebarLogin) btnTitlebarLogin.style.display = 'none';
    if (dropdownUser) dropdownUser.style.display = 'flex';
    if (textTitlebarUsername) textTitlebarUsername.textContent = `@${currentUser.username}`;

    if (writeLockOverlay) {
      writeLockOverlay.style.display = 'none';
      writeLockOverlay.style.pointerEvents = 'none';
      writeLockOverlay.setAttribute('aria-hidden', 'true');
    }
    if (inputFeedbackContent) inputFeedbackContent.removeAttribute('disabled');
    if (btnTriggerUpload) btnTriggerUpload.removeAttribute('disabled');
    if (btnSendFeedback) btnSendFeedback.removeAttribute('disabled');

    // 独立 Tab 可见性控制
    if (currentUser.role === 'admin') {
      adminNavs.forEach(nav => nav.style.display = 'flex');
    } else {
      adminNavs.forEach(nav => nav.style.display = 'none');
      redirectFromAdminTab();
    }
  } else {
    if (btnTitlebarLogin) btnTitlebarLogin.style.display = 'block';
    if (dropdownUser) dropdownUser.style.display = 'none';

    if (writeLockOverlay) {
      writeLockOverlay.style.display = 'flex';
      writeLockOverlay.style.pointerEvents = 'auto';
      writeLockOverlay.setAttribute('aria-hidden', 'false');
    }
    if (inputFeedbackContent) inputFeedbackContent.setAttribute('disabled', 'true');
    if (btnTriggerUpload) btnTriggerUpload.setAttribute('disabled', 'true');
    if (btnSendFeedback) btnSendFeedback.setAttribute('disabled', 'true');

    adminNavs.forEach(nav => nav.style.display = 'none');
    redirectFromAdminTab();
  }
}

// 强制重定向辅助函数：防非管理员非法留存
function redirectFromAdminTab() {
  const activeNav = document.querySelector('.nav-item.active');
  if (activeNav) {
    const target = activeNav.getAttribute('data-target');
    if (target === 'tab-admin-users' || target === 'tab-admin-announcement') {
      const homeNav = document.querySelector('.nav-item[data-target="tab-patch"]');
      if (homeNav) homeNav.click();
    }
  }
}

// 异步加载渲染反馈列表 (支持大图灯箱唤醒)
async function loadFeedbacks(useCache = false, options = {}) {
  const container = document.getElementById('feedback-flow-list');
  if (!container) return;

  const cachedItems = communityState?.all?.() || window.currentFeedbacksDesktop || [];
  const hasCache = Array.isArray(cachedItems) && cachedItems.length > 0;
  if (!useCache && !hasCache && options.showSkeleton !== false) {
    container.innerHTML = `
      <div class="skeleton-loader">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    `;
  }

  const res = useCache && hasCache
    ? { success: true, data: cachedItems }
    : await window.agyHubAPI.fetchFeedbacks({ sort: document.getElementById('feedback-sort').value });
  if (!res.success) {
    if (hasCache) {
      uiFeedback.notify(res.error || '社区暂时无法连接，正在显示最近一次数据', 'error', { title: '社区网络异常' });
    } else {
      container.innerHTML = `<div class="no-data-tip">❌ 数据载入失败: ${safeDom.text(res.error)}，请检查网络。</div>`;
      return;
    }
  }

  const nextItems = res.success ? (Array.isArray(res.data) ? res.data : []) : cachedItems;
  if (!useCache) communityState?.setAll?.(nextItems);
  else if (communityState && !communityState.all().length) communityState.setAll(nextItems);
  syncCommunityStateToWindow();
  if (!communityState) window.currentFeedbacksDesktop = nextItems;
  if (res.stale && !options.silent) uiFeedback.notify(res.warning || '网络不可用，正在显示最近一次成功同步的数据', 'info', { title: '离线只读' });
  const list = window.AgyCommunityData.feedbacks(window.currentFeedbacksDesktop, document.getElementById('feedback-sort').value, document.getElementById('feedback-search').value);
  document.getElementById('feedback-result-count').textContent = list.length + ' 条反馈';
  if (!list.length) { container.innerHTML = '<div class="no-data-tip">没有匹配的反馈，试试其他显示顺序或搜索条件。</div>'; return; }

  let html = '';
  list.forEach(fb => {
    const isOwnerOrAdmin = currentUser && (currentUser.role === 'admin' || currentUser.username === fb.username);
    const deleteButton = isOwnerOrAdmin 
      ? `<button class="btn-delete-fb" data-id="${fb.id}" title="删除该反馈">🗑️ 删除</button>`
      : '';
      
    const isAdminAuthor = fb.role === 'admin';
    const authorClass = isAdminAuthor ? 'feedback-author admin-author' : 'feedback-author';
    const dateText = fb.pending ? '发送中…' : new Date(fb.created_at).toLocaleString();

    let imageTag = '';
    const feedbackImageUrl = safeDom.imageUrl(fb.image_url);
    if (feedbackImageUrl) {
      imageTag = `<img src="${feedbackImageUrl}" class="feedback-image-preview community-thumbnail img-trigger-lightbox" alt="用户反馈截图，点击查看原图" loading="lazy">`;
    }

    // B. 内容大于 120 字截断
    const isLong = fb.content.length > 120;
    const displayContent = isLong ? escapeHTML(fb.content.slice(0, 120)) + '...' : escapeHTML(fb.content);
    const showMoreBtn = isLong 
      ? `<button class="show-detail-btn" style="background: rgba(0, 245, 255, 0.05); border: 1px dashed rgba(0, 245, 255, 0.2); color: var(--neon-cyan); padding: 4px 12px; border-radius: 6px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; margin-top: 6px;">📖 展开全文</button>` 
      : '';

    const heartSvg = `
      <svg class="heart-svg" viewBox="0 0 24 24" width="14" height="14" style="vertical-align: middle;">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      </svg>
    `;

    const repliesCount = fb.replies ? fb.replies.length : 0;

    // C. 点赞和回复操作栏 (小红书心形点赞 + 评论数)
    const postActionBar = `
      <div class="post-action-bar" style="display: flex; gap: 16px; align-items: center; margin-top: 12px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.02); padding-top: 8px;">
        <button type="button" class="action-text-btn" style="color: var(--text-muted); font-size: 11.5px; display: inline-flex; align-items: center; gap: 6px; background: transparent; border: none; cursor: pointer;">
          💬 <span id="main-comment-count-${fb.id}">${repliesCount}</span> 条评论
        </button>
        <button type="button" class="heart-like-btn ${fb.has_liked ? 'liked' : ''}" data-id="${fb.id}" id="like-btn-${fb.id}">
          ${heartSvg}
          <span id="like-count-${fb.id}">${fb.likes_count || 0}</span>
        </button>
      </div>
    `;

    html += `
      <div class="feedback-item${fb.pending ? ' is-pending' : ''}" data-id="${fb.id}" style="cursor: pointer; margin-bottom: 12px;">
        <div class="feedback-meta">
          <span class="${authorClass}">${safeDom.text(fb.username)}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="feedback-date">${dateText}</span>
            ${deleteButton}
          </div>
        </div>
        <div class="feedback-body">${displayContent}</div>
        ${showMoreBtn}
        ${imageTag}
        ${postActionBar}
      </div>
    `;
  });

  container.innerHTML = html;

  // 1. 物理级级联删除绑定（乐观移除 + 失败回滚）
  const deleteButtons = container.querySelectorAll('.btn-delete-fb');
  deleteButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fbId = btn.getAttribute('data-id');
      const confirmed = await uiFeedback.confirm('删除后会同时删除该反馈下的回复与点赞，此操作不可撤销。', { title: '删除反馈', okText: '确认删除', danger: true });
      if (!confirmed) return;
      const snapshot = communityState?.snapshot?.() || [];
      communityState?.remove?.(fbId);
      syncCommunityStateToWindow();
      await loadFeedbacks(true, { silent: true });
      const delRes = await window.agyHubAPI.deleteFeedback(fbId);
      if (delRes.success) {
        logToTerminal(`[Feedback] 已删除留言 ID: ${fbId}`, 'success');
        uiFeedback.notify('反馈已删除', 'success');
        reconcileFeedbacksInBackground();
      } else {
        communityState?.restore?.(snapshot);
        syncCommunityStateToWindow();
        await loadFeedbacks(true, { silent: true });
        uiFeedback.notify(delRes.error || '删除失败', 'error', { title: '删除反馈失败' });
      }
    });
  });

  // 2. 点击图片拉起全屏灯箱模态预览 (Lightbox)
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxLargeImg = document.getElementById('lightbox-large-img');
  const previewImages = container.querySelectorAll('.img-trigger-lightbox');

  previewImages.forEach(img => {
    img.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止冒泡到卡片详情
      if (lightboxModal && lightboxLargeImg) {
        lightboxLargeImg.src = img.src;
        lightboxModal.style.display = 'flex';
      }
    });
  });

  // 3. 卡片点击事件监听 -> 展开详情弹窗
  const postCards = container.querySelectorAll('.feedback-item');
  postCards.forEach(card => {
    card.addEventListener('click', () => {
      const id = card.getAttribute('data-id');
      if (String(id).startsWith('pending-')) return;
      openFeedbackDetailDesktop(parseInt(id));
    });
  });

  // 4. 点赞按钮事件监听：统一走乐观更新函数
  const likeBtns = container.querySelectorAll('.heart-like-btn[data-id]');
  likeBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.getAttribute('data-id'));
      if (Number.isFinite(id)) await toggleLikePostDesktop(id);
    });
  });

}

// 桌面端详情弹窗拉开
async function openFeedbackDetailDesktop(id) {
  const modal = document.getElementById('feedback-detail-modal');
  const modalBody = document.getElementById('detail-modal-body');
  if (!modal || !modalBody) return;

  const fb = window.currentFeedbacksDesktop ? window.currentFeedbacksDesktop.find(f => f.id === id) : null;
  if (!fb) return;

  renderDetailModalContentDesktop(fb);
  modal.style.display = 'flex';
}
window.openFeedbackDetailDesktop = openFeedbackDetailDesktop;

// 渲染桌面详情弹窗内部
function renderDetailModalContentDesktop(fb) {
  const modalBody = document.getElementById('detail-modal-body');
  if (!modalBody) return;

  const dateStr = new Date(fb.created_at).toLocaleString();
  const imgTag = fb.image_url 
    ? `<img src="${fb.image_url}" class="feedback-image-preview img-trigger-lightbox" style="max-height: 200px; margin: 10px 0; display:block;" alt="截图">`
    : '';

  const heartSvg = `
    <svg class="heart-svg" viewBox="0 0 24 24" width="14" height="14" style="vertical-align: middle;">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  `;

  // 评论高赞排序列表渲染
  let repliesListHtml = '';
  if (fb.replies && fb.replies.length > 0) {
    repliesListHtml = fb.replies.map(r => {
      const replyDate = r.pending ? '发送中…' : new Date(r.created_at).toLocaleString();
      const deleteReplyBtn = (!r.pending && currentUser && (currentUser.role === 'admin' || currentUser.username === r.username))
        ? `<button type="button" class="action-text-btn delete-btn" data-feedback-detail-action="delete-reply" data-reply-id="${r.id}" data-feedback-id="${fb.id}" style="font-size:9px; margin-left:6px; color: #ef4444; border:none; background:transparent;">✕ 删除</button>`
        : '';
      const isAdminReply = r.role === 'admin' ? 'admin' : '';
      const replyActions = r.pending ? '<span style="font-size:10px;color:var(--text-muted);">正在同步…</span>' : `
            ${replyActions}`;

      return `
        <div class="reply-item" style="border-left: 2px solid var(--accent-pink); padding: 8px 12px; background: rgba(0,0,0,0.15); border-radius: 4px; margin-bottom: 8px; text-align: left;">
          <div style="display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 4px;">
            <span class="reply-author ${isAdminReply}" style="font-weight:600; color: var(--neon-cyan);">${escapeHTML(r.username)} ${isAdminReply ? '(管理员)' : ''}</span>
            <span style="color: var(--text-muted); display: flex; align-items: center; gap: 6px;">
              ${replyDate} 
              ${deleteReplyBtn}
            </span>
          </div>
          <div class="reply-body" style="font-size: 11.5px; color: var(--text-secondary); margin: 4px 0; word-break: break-all;">${escapeHTML(r.content)}</div>
          <div style="display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
            <button type="button" class="action-text-btn" data-feedback-detail-action="focus-reply" data-reply-username="${escapeHTML(r.username)}" style="font-size:10px; color:var(--text-muted); border:none; background:transparent; cursor:pointer;">💬 回复</button>
            <button type="button" class="reply-like-btn ${r.has_liked ? 'liked' : ''}" data-feedback-detail-action="like-reply" data-reply-id="${r.id}" data-feedback-id="${fb.id}" id="reply-like-btn-${r.id}">
              ${heartSvg}
              <span id="reply-like-count-${r.id}">${r.likes_count || 0}</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    repliesListHtml = `<p style="text-align: center; color: var(--text-muted); font-size: 11px; margin: 20px 0;">🎉 暂无回复，抢占沙发！</p>`;
  }

  const inputAreaHtml = currentUser 
    ? `
      <div class="reply-input-box" style="display: flex; gap: 8px; margin-top: 14px; align-items: center;">
        <textarea id="modal-reply-text-${fb.id}" placeholder="写下您的评论... (点击评论的'回复'可快捷@他人)" class="reply-textarea" style="flex: 1; min-height: 42px; background: rgba(0,0,0,0.3); border: 1px solid var(--border-subtle); color: #fff; padding: 8px; border-radius: 6px; font-size: 12px; resize:none;"></textarea>
        <button type="button" class="btn btn-primary" data-feedback-detail-action="submit-reply" data-feedback-id="${fb.id}" style="height: 42px; padding: 0 16px;">发布</button>
      </div>
    `
    : `<p style="text-align: center; color: var(--text-muted); font-size: 11px; margin-top: 14px;">🔒 请先登录您的账号，登录后即可发表评论。</p>`;

  modalBody.innerHTML = `
    <!-- 帖子头部主帖展示 -->
    <div style="border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 12px; text-align: left;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px;">
        <strong style="color: var(--neon-cyan); font-size: 13px;">${escapeHTML(fb.username)}</strong>
        <span style="color: var(--text-muted);">${dateStr}</span>
      </div>
      <p style="color: var(--text-primary); font-size: 13.5px; word-break: break-all; line-height: 1.6; white-space: pre-wrap;">${escapeHTML(fb.content)}</p>
      ${imgTag}
      
      <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
        <button type="button" class="heart-like-btn ${fb.has_liked ? 'liked' : ''}" data-feedback-detail-action="like-post" data-feedback-id="${fb.id}" id="detail-like-btn-${fb.id}">
          ${heartSvg}
          <span id="detail-like-count-${fb.id}">${fb.likes_count || 0}</span>
        </button>
      </div>
    </div>

    <!-- 帖子下方的回复评论列表区 -->
    <div style="margin-top: 10px;">
      <h4 style="color: var(--neon-cyan); font-size: 12px; margin-bottom: 10px;">💬 回复评论列表</h4>
      <div class="modal-replies-flow" style="display: flex; flex-direction: column; gap: 8px;">
        ${repliesListHtml}
      </div>
    </div>

    <!-- 评论发布提交区 -->
    ${inputAreaHtml}
  `;

  // 严格 CSP (script-src 'self') 会拦截内联 onclick。
  // 详情弹窗统一使用事件委托，避免按钮看起来可点但实际没有任何响应。
  modalBody.onclick = async (event) => {
    const button = event.target.closest('[data-feedback-detail-action]');
    if (!button || !modalBody.contains(button)) return;
    const action = button.dataset.feedbackDetailAction;
    if (action === 'submit-reply') {
      await submitModalReplyDesktop(Number(button.dataset.feedbackId), button);
    } else if (action === 'focus-reply') {
      focusCommentInputDesktop(button.dataset.replyUsername || '');
    } else if (action === 'delete-reply') {
      await deleteReplyDesktop(Number(button.dataset.replyId), Number(button.dataset.feedbackId));
    } else if (action === 'like-reply') {
      await toggleLikeReplyDesktop(Number(button.dataset.replyId), Number(button.dataset.feedbackId));
    } else if (action === 'like-post') {
      await toggleLikePostDesktop(Number(button.dataset.feedbackId));
    }
  };

  // 对大图灯箱绑定
  const updatedLightboxImages = modalBody.querySelectorAll('.img-trigger-lightbox');
  const lightboxModal = document.getElementById('lightbox-modal');
  const lightboxLargeImg = document.getElementById('lightbox-large-img');
  updatedLightboxImages.forEach(img => {
    img.addEventListener('click', () => {
      if (lightboxModal && lightboxLargeImg) {
        lightboxLargeImg.src = img.src;
        lightboxModal.style.display = 'flex';
      }
    });
  });
}

// 聚焦输入框并自动填入回复 @
function focusCommentInputDesktop(username) {
  const ta = document.querySelector('#feedback-detail-modal .reply-textarea');
  if (ta) {
    ta.value = `@${username} `;
    ta.focus();
  }
}
window.focusCommentInputDesktop = focusCommentInputDesktop;

// 提交回复评论
async function submitModalReplyDesktop(feedbackId, triggerButton = null) {
  if (!currentUser) {
    uiFeedback.notify('请先登录后再发表评论', 'error', { title: '需要登录' });
    return;
  }
  const textarea = document.getElementById(`modal-reply-text-${feedbackId}`);
  if (!textarea) return;
  const content = textarea.value.trim();
  if (!content) {
    uiFeedback.notify('评论内容不能为空', 'error');
    return;
  }

  const tempId = communityState?.pendingId?.('reply') || `reply-${Date.now()}`;
  const pendingReply = {
    id: tempId,
    username: currentUser.username,
    role: currentUser.role || 'user',
    content,
    created_at: Date.now(),
    likes_count: 0,
    has_liked: false,
    pending: true
  };
  const originalButtonText = triggerButton?.textContent || '发布';
  communityState?.addReply?.(feedbackId, pendingReply);
  syncCommunityStateToWindow();
  textarea.value = '';
  renderFeedbackDetailFromState(feedbackId);
  if (triggerButton?.isConnected) {
    triggerButton.disabled = true;
    triggerButton.textContent = '发送中…';
  }

  try {
    const replyRes = await window.AgyCommunityController.request('/api/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token },
      body: JSON.stringify({ feedback_id: feedbackId, content })
    });
    const replyResult = await replyRes.json();
    if (!(replyRes.ok && replyResult.success)) {
      const errorMessage = replyResult.error || replyRes.error || '回复请求失败，请稍后重试';
      communityState?.removeReply?.(feedbackId, tempId);
      syncCommunityStateToWindow();
      renderFeedbackDetailFromState(feedbackId);
      const restored = document.getElementById(`modal-reply-text-${feedbackId}`);
      if (restored) restored.value = content;
      const handled = await handleSessionExpiry(errorMessage);
      if (!handled) uiFeedback.notify(errorMessage, 'error', { title: '回复失败' });
      return;
    }
    logToTerminal(`[Feedback] 成功发表评论 ID: ${feedbackId}`, 'success');
    uiFeedback.notify('回复已发送', 'success');
    void reconcileFeedbacksInBackground();
  } catch (err) {
    communityState?.removeReply?.(feedbackId, tempId);
    syncCommunityStateToWindow();
    renderFeedbackDetailFromState(feedbackId);
    const restored = document.getElementById(`modal-reply-text-${feedbackId}`);
    if (restored) restored.value = content;
    uiFeedback.notify(err.message || '网络异常', 'error', { title: '回复失败' });
  } finally {
    const currentButton = document.querySelector(`#feedback-detail-modal [data-feedback-detail-action="submit-reply"][data-feedback-id="${feedbackId}"]`);
    if (currentButton) {
      currentButton.disabled = false;
      currentButton.textContent = originalButtonText;
    }
  }
}
window.submitModalReplyDesktop = submitModalReplyDesktop;

// 删除回复的评论
async function deleteReplyDesktop(replyId, feedbackId) {
  const confirmed = await uiFeedback.confirm('确定删除这条回复吗？此操作不可撤销。', { title: '删除回复', okText: '确认删除', danger: true });
  if (!confirmed) return;
  const snapshot = communityState?.snapshot?.() || [];
  communityState?.removeReply?.(feedbackId, replyId);
  syncCommunityStateToWindow();
  renderFeedbackDetailFromState(feedbackId);
  try {
    const replyRes = await window.AgyCommunityController.request(`/api/reply?id=${replyId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + currentUser.token }
    });
    const replyResult = await replyRes.json();
    if (replyRes.ok && replyResult.success) {
      uiFeedback.notify('回复已删除', 'success');
      void reconcileFeedbacksInBackground();
      return;
    }
    communityState?.restore?.(snapshot);
    syncCommunityStateToWindow();
    renderFeedbackDetailFromState(feedbackId);
    uiFeedback.notify(replyResult.error || '删除失败', 'error', { title: '删除回复失败' });
  } catch (err) {
    communityState?.restore?.(snapshot);
    syncCommunityStateToWindow();
    renderFeedbackDetailFromState(feedbackId);
    uiFeedback.notify(err.message || '网络异常', 'error', { title: '删除回复失败' });
  }
}
window.deleteReplyDesktop = deleteReplyDesktop;

// 点赞主卡片
async function toggleLikePostDesktop(id) {
  if (!currentUser) {
    uiFeedback.notify('请先登录后再点赞', 'error', { title: '需要登录' });
    return;
  }
  const item = feedbackFromState(id);
  if (!item) return;
  const previousLiked = Boolean(item.has_liked);
  const previousCount = Math.max(0, Number(item.likes_count) || 0);
  const optimisticLiked = !previousLiked;
  const optimisticCount = Math.max(0, previousCount + (optimisticLiked ? 1 : -1));
  communityState?.update?.(id, { has_liked: optimisticLiked, likes_count: optimisticCount });
  syncCommunityStateToWindow();
  applyFeedbackLikeVisual(id, optimisticLiked, optimisticCount);
  try {
    const response = await window.AgyCommunityController.request('/api/feedback/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token },
      body: JSON.stringify({ feedback_id: Number(id) })
    });
    const data = await response.json();
    if (!(response.ok && data.success)) throw new Error(data.error || '点赞失败');
    communityState?.update?.(id, { has_liked: Boolean(data.liked), likes_count: Math.max(0, Number(data.likes_count) || 0) });
    syncCommunityStateToWindow();
    applyFeedbackLikeVisual(id, data.liked, data.likes_count);
  } catch (err) {
    communityState?.update?.(id, { has_liked: previousLiked, likes_count: previousCount });
    syncCommunityStateToWindow();
    applyFeedbackLikeVisual(id, previousLiked, previousCount);
    const handled = await handleSessionExpiry(err.message);
    if (!handled) uiFeedback.notify(err.message || '点赞失败', 'error');
  }
}
window.toggleLikePostDesktop = toggleLikePostDesktop;

// 二级回复点赞
async function toggleLikeReplyDesktop(replyId, feedbackId) {
  if (!currentUser) {
    uiFeedback.notify('请先登录后再点赞', 'error', { title: '需要登录' });
    return;
  }
  const item = feedbackFromState(feedbackId);
  const reply = item?.replies?.find(entry => String(entry.id) === String(replyId));
  if (!reply || reply.pending) return;
  const previousLiked = Boolean(reply.has_liked);
  const previousCount = Math.max(0, Number(reply.likes_count) || 0);
  const optimisticLiked = !previousLiked;
  const optimisticCount = Math.max(0, previousCount + (optimisticLiked ? 1 : -1));
  communityState?.updateReply?.(feedbackId, replyId, { has_liked: optimisticLiked, likes_count: optimisticCount });
  syncCommunityStateToWindow();
  renderFeedbackDetailFromState(feedbackId);
  try {
    const response = await window.AgyCommunityController.request('/api/reply/like', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentUser.token },
      body: JSON.stringify({ reply_id: replyId })
    });
    const data = await response.json();
    if (!(response.ok && data.success)) throw new Error(data.error || '点赞失败');
    communityState?.updateReply?.(feedbackId, replyId, { has_liked: Boolean(data.liked), likes_count: Math.max(0, Number(data.likes_count) || 0) });
    syncCommunityStateToWindow();
    renderFeedbackDetailFromState(feedbackId);
  } catch (err) {
    communityState?.updateReply?.(feedbackId, replyId, { has_liked: previousLiked, likes_count: previousCount });
    syncCommunityStateToWindow();
    renderFeedbackDetailFromState(feedbackId);
    const handled = await handleSessionExpiry(err.message);
    if (!handled) uiFeedback.notify(err.message || '点赞失败', 'error');
  }
}
window.toggleLikeReplyDesktop = toggleLikeReplyDesktop;

// 桌面端专属：云端置顶公告系统 (高斯模糊强弹 + 顶栏常驻)
async function loadAnnouncementSystemDesktop() {
  const modalHTML = `
    <div class="modal-overlay" id="announcement-modal" style="display: none; z-index: 10005;">
      <div class="modal-content" style="width: 480px;">
        <div class="modal-header">
          <div class="modal-logo">
            <span class="pulse-dot"></span>
            <span class="logo-text">📣 系统最新公告</span>
          </div>
          <button class="modal-close-btn" id="btn-close-announcement-modal">✕</button>
        </div>
        <div class="modal-body" id="announcement-modal-body" style="font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.85); white-space: pre-wrap;">
        </div>
        <div class="announcement-modal-footer" id="announcement-modal-footer" hidden>
          <button class="btn btn-secondary" id="btn-expand-all-announcements" type="button">展开全部</button>
        </div>
      </div>
    </div>
  `;
  
  if (!document.getElementById('announcement-modal')) {
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }

  const barHTML = `
    <div class="global-announcement-bar-desktop" id="global-announcement-bar-desktop" style="display: none;">
      <div class="announcement-bar-content-desktop">
        <span class="announcement-bell"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg></span>
        <span class="announcement-text-desktop" id="text-announcement-bar-content-desktop">最新公告加载中...</span>
        <button class="announcement-view-link-desktop" id="btn-reopen-announcement-desktop">点击查看详情 &rarr;</button>
      </div>
    </div>
  `;
  if (!document.getElementById('global-announcement-bar-desktop')) {
    const mainWrapper = document.querySelector('.main-wrapper');
    if (mainWrapper) {
      mainWrapper.insertAdjacentHTML('afterbegin', barHTML);
    } else {
      document.body.insertAdjacentHTML('afterbegin', barHTML);
    }
  }

  const annModal = document.getElementById('announcement-modal');
  const annModalBody = document.getElementById('announcement-modal-body');
  const annModalFooter = document.getElementById('announcement-modal-footer');
  const btnExpandAll = document.getElementById('btn-expand-all-announcements');
  const btnCloseAnnModal = document.getElementById('btn-close-announcement-modal');
  const annBar = document.getElementById('global-announcement-bar-desktop');
  const textAnnBarContent = document.getElementById('text-announcement-bar-content-desktop');
  const btnReopenAnn = document.getElementById('btn-reopen-announcement-desktop');

  if (!annModal || !annModalBody || !annBar || !annModalFooter || !btnExpandAll) return;

  try {
    const res = await window.AgyCommunityController.request('/api/announcement?all=true', { cache: 'no-store' });
    if (!res.ok) throw new Error(`请求失败 (${res.status})`);

    const payload = await res.json();
    const announcements = (Array.isArray(payload) ? payload : payload ? [payload] : [])
      .filter(item => item && item.content)
      .sort(window.AgyCommunityData.newest);
    if (!announcements.length) { annBar.style.display = 'none'; annModal.style.display = 'none'; return; }

    const latestAnnouncement = announcements[0];
    let expanded = false;

    const openImage = (src) => {
      const lightboxModal = document.getElementById('lightbox-modal');
      const lightboxLargeImg = document.getElementById('lightbox-large-img');
      if (lightboxModal && lightboxLargeImg) {
        lightboxLargeImg.src = src;
        lightboxModal.style.display = 'flex';
      }
    };

    const renderAnnouncements = () => {
      annModalBody.replaceChildren();
      const visibleAnnouncements = expanded ? announcements : announcements.slice(0, 1);

      visibleAnnouncements.forEach((announcement, index) => {
        const article = document.createElement('article');
        article.className = `announcement-modal-item${index === 0 ? ' latest' : ''}`;

        const meta = document.createElement('div');
        meta.className = 'announcement-modal-meta';
        const label = document.createElement('strong');
        label.textContent = index === 0 ? '最新公告' : '历史公告';
        const time = document.createElement('time');
        const date = new Date(announcement.created_at || 0);
        time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('zh-CN');
        meta.append(label, time);

        const content = document.createElement('p');
        content.textContent = announcement.content;
        article.append(meta, content);

        const imageUrl = String(announcement.image_url || '').trim();
        if (imageUrl) {
          const image = document.createElement('img');
          image.src = imageUrl;
          image.className = 'announcement-img-preview';
          image.alt = '公告配图';
          image.loading = index === 0 ? 'eager' : 'lazy';
          image.addEventListener('click', () => openImage(image.src));
          article.appendChild(image);
        }

        annModalBody.appendChild(article);
      });

      annModalFooter.hidden = announcements.length <= 1;
      btnExpandAll.textContent = expanded ? '收起历史公告' : `展开全部（${announcements.length}）`;
    };

    const openLatestAnnouncement = () => {
      expanded = false;
      renderAnnouncements();
      annModal.style.display = 'flex';
    };

    renderAnnouncements();

    // 展现顶栏常驻条
    textAnnBarContent.textContent = latestAnnouncement.content;
    annBar.style.display = 'block';

    // 判定强弹
    const lastReadId = localStorage.getItem('read_announcement_id_desktop');
    // Announcements stay available in the bar; opening them is an explicit action.
    btnReopenAnn.textContent = lastReadId === String(latestAnnouncement.id) ? '查看公告 →' : '查看新公告 →';

    const closeAnn = () => {
      annModal.style.display = 'none';
      localStorage.setItem('read_announcement_id_desktop', latestAnnouncement.id.toString());
    };

    if (btnCloseAnnModal) btnCloseAnnModal.onclick = closeAnn;
    annModal.onclick = (e) => {
      if (e.target === annModal) closeAnn();
    };

    btnExpandAll.onclick = () => {
      expanded = !expanded;
      renderAnnouncements();
      annModalBody.scrollTop = 0;
    };

    if (btnReopenAnn) {
      btnReopenAnn.onclick = openLatestAnnouncement;
    }

  } catch (e) {
    console.error('公告系统载入失败:', e.message);
  }
}

// 转义 HTML 防止 XSS
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// J.6 载入公告历史列表
async function loadAnnouncementHistory() {
  const container = document.getElementById('admin-ann-history-list');
  if (!container) return;

  container.innerHTML = '<div class="no-data-tip">⏳ 正在读取云端公告历史...</div>';

  try {
    const res = await window.AgyCommunityController.request('/api/announcement?all=true');
    if (!res.ok) throw new Error('拉取失败');

    const list = window.AgyCommunityData.announcements(await res.json(), document.getElementById('admin-ann-sort').value, document.getElementById('admin-ann-search').value);
    if (!list || list.length === 0) {
      container.innerHTML = '<div class="no-data-tip">🏜️ 暂无历史发布公告。</div>';
      return;
    }

    let html = '';
    list.forEach(ann => {
      const dateText = window.AgyCommunityData.date(ann.created_at);
      let imageTag = '';
      const announcementImageUrl = safeDom.imageUrl(ann.image_url);
      if (announcementImageUrl) {
        imageTag = `<img src="${announcementImageUrl}" class="announcement-img-preview img-trigger-lightbox" alt="公告配图" style="max-height: 120px; object-fit: contain; cursor: zoom-in; margin-top: 8px;">`;
      }

      html += `
        <article class="card community-ann-record" style="padding:16px">
          <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono);">${dateText}</span>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-edit-ann" data-id="${ann.id}" data-content="${safeDom.text(encodeURIComponent(ann.content))}" data-image="${safeDom.text(ann.image_url || '')}" style="padding: 2px 8px; font-size: 10px;">📝 编辑</button>
              <button class="btn-delete-fb btn-delete-ann" data-id="${ann.id}" style="padding: 2px 8px; font-size: 10px; color: var(--accent-pink); border-color: rgba(255,0,85,0.2);">🗑️ 删除</button>
            </div>
          </div>
          <details><summary>${safeDom.text(ann.content.slice(0, 100))}${ann.content.length > 100 ? '…' : ''}</summary><p class="community-ann-content">${escapeHTML(ann.content)}</p></details>
          ${imageTag}
        </article>
      `;
    });
    container.innerHTML = html;

    // 绑定编辑和删除按钮
    const editBtns = container.querySelectorAll('.btn-edit-ann');
    editBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const content = decodeURIComponent(btn.getAttribute('data-content'));
        const image = safeDom.imageUrl(btn.getAttribute('data-image'));
        uploadedAnnImageUrl = image;

        document.getElementById('input-announce-edit-id').value = id;
        document.getElementById('input-announce-content').value = content;
        
        const previewWrapper = document.getElementById('ann-upload-preview-wrapper');
        const previewImg = document.getElementById('img-ann-upload-preview');
        const statusText = document.getElementById('text-ann-upload-status');
        
        if (image && image.trim()) {
          previewImg.src = image.trim();
          previewWrapper.style.display = 'flex';
          statusText.textContent = '原公告图';
        } else {
          previewImg.src = '';
          previewWrapper.style.display = 'none';
        }

        document.getElementById('text-ann-form-title').textContent = '📝 编辑系统公告';
        document.getElementById('btn-cancel-ann-edit').style.display = 'inline-flex';
        
        document.getElementById('tab-admin-announcement').scrollTop = 0;
      });
    });

    const deleteBtns = container.querySelectorAll('.btn-delete-ann');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        if (confirm('⚠️ 确定要从云端删除这条公告吗？物理抹除操作不可逆。')) {
          btn.disabled = true;
          const delRes = await window.AgyCommunityController.request(`/api/announcement?id=${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': 'Bearer ' + currentUser.token
            }
          });
          const delResult = await delRes.json();
          if (delRes.ok && delResult.success) {
            logToTerminal(`[Admin] 物理删除公告 ID: ${id}`, 'success');
            loadAnnouncementHistory();
            loadAnnouncementSystemDesktop();
          } else {
            alert(`删除失败: ${delResult.error}`);
            btn.disabled = false;
          }
        }
      });
    });

    // 灯箱
    const previewImages = container.querySelectorAll('.img-trigger-lightbox');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxLargeImg = document.getElementById('lightbox-large-img');
    previewImages.forEach(img => {
      img.addEventListener('click', () => {
        if (lightboxModal && lightboxLargeImg) {
          lightboxLargeImg.src = img.src;
          lightboxModal.style.display = 'flex';
        }
      });
    });

  } catch (err) {
    container.innerHTML = `<div class="no-data-tip">❌ 加载历史失败: ${safeDom.errorMessage(err)}</div>`;
  }
}

// J.7 展示用户详细页 (及该用户的发言追踪)
async function showAdminUserDetail(username) { return window.AgyAdminCommunity.showDetail(username); }

window.AgyAdminCommunity.init({ getUser: () => currentUser, refreshFeedbacks: () => loadFeedbacks() });
document.getElementById('feedback-sort').addEventListener('change', () => loadFeedbacks(Boolean(communityState?.all?.().length)));
document.getElementById('feedback-search').addEventListener('input', () => {
  clearTimeout(feedbackSearchTimer);
  feedbackSearchTimer = setTimeout(() => loadFeedbacks(true, { silent: true }), 120);
});
document.getElementById('admin-ann-sort').addEventListener('change', () => loadAnnouncementHistory());
let announcementSearchTimer;
document.getElementById('admin-ann-search').addEventListener('input', () => { clearTimeout(announcementSearchTimer); announcementSearchTimer = setTimeout(loadAnnouncementHistory, 150); });
// 自动加载初始化极客看板
initFeedbackBoard();

// ==========================================
// 10. 关联/添加新账号 Modal 交互驱动
// ==========================================
const btnAddLocalAccount = document.getElementById('btn-add-local-account');
const addAccountModal = document.getElementById('add-account-modal');
const btnCloseAddAccountModal = document.getElementById('btn-close-add-account-modal');

const btnAddTabOfficial = document.getElementById('btn-add-tab-official');
const btnAddTabJson = document.getElementById('btn-add-tab-json');
const panelAddOfficial = document.getElementById('panel-add-official');
const panelAddJson = document.getElementById('panel-add-json');

const btnStartOauth = document.getElementById('btn-start-oauth');
const btnCopyOauthUrl = document.getElementById('btn-copy-oauth-url');
const btnSubmitOauthCode = document.getElementById('btn-submit-oauth-code');
const btnImportJsonFile = document.getElementById('btn-import-json-file');

const oauthLinkGroup = document.getElementById('oauth-link-group');
const inputOauthUrl = document.getElementById('input-oauth-url');
const inputOauthCode = document.getElementById('input-oauth-code');
const oauthStatusMessage = document.getElementById('oauth-status-message');

if (btnAddLocalAccount && addAccountModal && btnCloseAddAccountModal) {
  // 打开 Modal
  btnAddLocalAccount.addEventListener('click', () => {
    addAccountModal.style.display = 'flex';
    switchAddTab('official');
  });

  // 关闭 Modal
  const closeAddAccModal = () => {
    addAccountModal.style.display = 'none';
    if (inputOauthCode) inputOauthCode.value = '';
    if (inputOauthUrl) inputOauthUrl.value = '';
    if (oauthLinkGroup) oauthLinkGroup.style.display = 'none';
    if (oauthStatusMessage) oauthStatusMessage.textContent = '';
  };
  btnCloseAddAccountModal.addEventListener('click', closeAddAccModal);

  // 两选项卡切换
  function switchAddTab(tab) {
    [btnAddTabOfficial, btnAddTabJson].forEach(btn => {
      if (btn) {
        btn.classList.remove('active');
        btn.style.borderBottom = '2px solid transparent';
        btn.style.color = 'var(--text-dim)';
        btn.style.fontWeight = 'normal';
      }
    });
    [panelAddOfficial, panelAddJson].forEach(panel => {
      if (panel) panel.style.display = 'none';
    });

    if (tab === 'official') {
      if (btnAddTabOfficial) {
        btnAddTabOfficial.classList.add('active');
        btnAddTabOfficial.style.borderBottom = '2px solid var(--accent-cyan)';
        btnAddTabOfficial.style.color = 'var(--text-main)';
        btnAddTabOfficial.style.fontWeight = 'bold';
      }
      if (panelAddOfficial) panelAddOfficial.style.display = 'block';
    } else if (tab === 'json') {
      if (btnAddTabJson) {
        btnAddTabJson.classList.add('active');
        btnAddTabJson.style.borderBottom = '2px solid var(--accent-cyan)';
        btnAddTabJson.style.color = 'var(--text-main)';
        btnAddTabJson.style.fontWeight = 'bold';
      }
      if (panelAddJson) panelAddJson.style.display = 'block';
    }
  }

  if (btnAddTabOfficial && btnAddTabJson) {
    btnAddTabOfficial.addEventListener('click', () => switchAddTab('official'));
    btnAddTabJson.addEventListener('click', () => switchAddTab('json'));
  }

  // 1. 网页一键登录：开始 OAuth 授权流程
  if (btnStartOauth) {
    btnStartOauth.addEventListener('click', async () => {
      btnStartOauth.disabled = true;
      btnStartOauth.textContent = '🌐 正在启动授权流程...';
      if (oauthStatusMessage) oauthStatusMessage.textContent = '正在获取 Google 授权链接...';
      try {
        const res = await window.agyHubAPI.startOauthLogin();
        if (res && res.success) {
          if (oauthLinkGroup) oauthLinkGroup.style.display = 'block';
          if (inputOauthUrl) inputOauthUrl.value = res.authUrl;
          if (oauthStatusMessage) oauthStatusMessage.textContent = '🔑 请在自动打开的浏览器网页中完成 Google 授权登录。';
          logToTerminal('[Account] 已成功拉起系统默认浏览器进行 Google 授权登录。', 'success');
        } else {
          alert('启动 OAuth 授权失败: ' + (res?.error || '未知错误'));
          if (oauthStatusMessage) oauthStatusMessage.textContent = '授权获取失败，请重试。';
        }
      } catch (err) {
        alert('启动授权发生异常: ' + err.message);
      } finally {
        btnStartOauth.disabled = false;
        btnStartOauth.textContent = '🌐 重新开始 OAuth 授权';
      }
    });
  }

  // 2. 复制授权链接
  if (btnCopyOauthUrl && inputOauthUrl) {
    btnCopyOauthUrl.addEventListener('click', () => {
      navigator.clipboard.writeText(inputOauthUrl.value);
      const oldTxt = btnCopyOauthUrl.textContent;
      btnCopyOauthUrl.textContent = '已复制';
      setTimeout(() => {
        btnCopyOauthUrl.textContent = oldTxt;
      }, 1500);
    });
  }

  // 执行核心 Code 兑换逻辑
  async function performCodeExchange(codeValue) {
    if (oauthStatusMessage) oauthStatusMessage.textContent = '⚡ 正在向 Google 服务器兑换并导入 Token...';
    try {
      const aRes = await window.agyHubAPI.submitOauthCode(codeValue);
      if (aRes && aRes.success) {
        logToTerminal(`[Account] 网页授权成功！导入谷歌账号: ${aRes.email}，已设为当前激活账号！`, 'success');
        closeAddAccModal();
        await loadLocalAccounts();
      } else {
        alert('导入账号失败: ' + (aRes?.error || '未知错误'));
        if (oauthStatusMessage) oauthStatusMessage.textContent = '❌ Token 兑换失败，请重新授权。';
      }
    } catch (err) {
      alert('兑换 Token 发生异常: ' + err.message);
    }
  }

  // 3. 手动粘贴链接或 Code 提交
  if (btnSubmitOauthCode && inputOauthCode) {
    btnSubmitOauthCode.addEventListener('click', async () => {
      const codeVal = inputOauthCode.value.trim();
      if (!codeVal) {
        alert('请先输入重定向回调链接或授权 Code！');
        return;
      }
      btnSubmitOauthCode.disabled = true;
      btnSubmitOauthCode.textContent = '提交中...';
      await performCodeExchange(codeVal);
      btnSubmitOauthCode.disabled = false;
      btnSubmitOauthCode.textContent = '提交';
    });
  }

  // 4. 自动捕获主进程截获的回调 Code，实现瞬间静默登录！
  window.agyHubAPI.onOauthCodeCaptured(async ({ code }) => {
    logToTerminal('[Account] 检测到本地服务器已自动拦截 Google 授权回调，正在极速换取 Token...', 'info');
    await performCodeExchange(code);
  });

  // 方式二：导入 JSON 配置文件
  if (btnImportJsonFile) {
    btnImportJsonFile.addEventListener('click', async () => {
      btnImportJsonFile.disabled = true;
      btnImportJsonFile.textContent = '📥 正在等待选择文件...';
      try {
        const iRes = await window.agyHubAPI.importLocalAccountFile();
        if (iRes && iRes.success) {
          logToTerminal(`[Account] 成功从本地配置文件导入账号: ${iRes.email}`, 'success');
          closeAddAccModal();
          await loadLocalAccounts();
        } else if (iRes && iRes.code === 'CANCELED') {
          // 静默
        } else {
          alert('导入失败: ' + (iRes?.error || '文件解析错误'));
        }
      } catch (err) {
        alert('导入异常: ' + err.message);
      } finally {
        btnImportJsonFile.disabled = false;
        btnImportJsonFile.textContent = '📥 选择本地账号 JSON 配置文件';
      }
    });
  }
}

// ==========================================
// 11. Token 监控大屏逻辑
// ==========================================
async function initTokenMonitor() {
  const controller = window.AgyTokenMonitorController;
  if (!controller || typeof controller.init !== 'function') throw new Error('Token 监控控制器未加载');
  return controller.init({ setCompactCount, logToTerminal });
}

async function initCodexGateway() {
  const controller = window.AgyGatewayController;
  if (!controller || typeof controller.init !== 'function') throw new Error('反代页面控制器未加载');
  return controller.init({ scheduleAfterPaint, setCompactCount, formatCompactCount, escapeHTML });
}

document.addEventListener('DOMContentLoaded', () => {
  window.AgyAppShellController?.init();
  window.AgyOnboardingController?.init();
});
