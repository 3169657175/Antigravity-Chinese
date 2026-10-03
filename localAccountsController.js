(function exposeLocalAccountsController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyLocalAccountsController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createLocalAccountsController() {
function createLocalAccountBadge(text, type) {
  const badge = document.createElement('span');
  badge.className = `local-account-badge ${type}`;
  badge.textContent = text;
  return badge;
}

function createLocalAccountRow(account, index, activeQuotaPromises, logToTerminal) {
  const btnAddLocalAccount = document.getElementById('btn-add-local-account');
  const btnStartOauth = document.getElementById('btn-start-oauth');
  const oauthStatusMessage = document.getElementById('oauth-status-message');
  const accountUi = window.AgyAccountUI || {};
  const row = document.createElement('div');
  row.className = `local-account-row${account.current ? ' current' : ''}`;
  row.setAttribute('data-account-id', account.id);
  row.setAttribute('data-account-email', account.email || '');

  const avatar = document.createElement('div');
  avatar.className = 'local-account-avatar';
  const avatarSource = account.name || account.email || String(index + 1);
  avatar.textContent = avatarSource.trim().charAt(0).toUpperCase() || String(index + 1);

  const identity = document.createElement('div');
  identity.className = 'local-account-identity';

  const titleLine = document.createElement('div');
  titleLine.className = 'local-account-title-line';
  const name = document.createElement('span');
  name.className = 'local-account-name';
  name.textContent = account.name || '未命名账号';
  titleLine.appendChild(name);
  if (account.current) titleLine.appendChild(createLocalAccountBadge('当前使用', 'current'));

  const email = document.createElement('span');
  email.className = 'local-account-email';
  email.textContent = account.email || '未记录邮箱';
  identity.append(titleLine, email);

  const security = document.createElement('div');
  security.className = 'local-account-security';

  // 上层：状态徽章区（独立一行）
  const statusBadgeArea = document.createElement('div');
  statusBadgeArea.className = 'local-account-badge-area';
  if (account.storageState === 'encrypted') {
    statusBadgeArea.appendChild(createLocalAccountBadge('DPAPI 已加密', 'encrypted'));
  } else if (account.storageState === 'legacy') {
    statusBadgeArea.appendChild(createLocalAccountBadge('等待加密迁移', 'warning'));
  } else {
    statusBadgeArea.appendChild(createLocalAccountBadge('凭据不可用', 'muted'));
  }
  security.appendChild(statusBadgeArea);

  // 下层：操作按钮区（独立一行，保证两按钮同高同宽）
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'local-account-actions';

  // 1. 若非当前使用账号且凭证可用，添加"切换使用"按钮
  if (!account.current && account.storageState !== 'missing') {
    const btnSwitch = document.createElement('button');
    btnSwitch.className = 'btn-account-action';
    btnSwitch.textContent = '切换使用';
    btnSwitch.addEventListener('click', async (e) => {
      e.stopPropagation();
      btnSwitch.disabled = true;
      btnSwitch.textContent = '切换中...';
      try {
        const sRes = await window.agyHubAPI.switchLocalAccount(account.id);
        if (sRes && sRes.success) {
          logToTerminal(`[Account] 已切换当前活动账户：${account.email}${sRes.restarted ? '，Antigravity 已完整重启' : '，请重启 Antigravity 后生效'}`, 'success');
          if (sRes.restartRequired && sRes.error) alert(sRes.error);
          await loadLocalAccounts();
        } else {
          alert('切换失败: ' + (sRes?.error || '未知错误'));
          btnSwitch.disabled = false;
          btnSwitch.textContent = '切换使用';
        }
      } catch (err) {
        alert('切换异常: ' + err.message);
        btnSwitch.disabled = false;
        btnSwitch.textContent = '切换使用';
      }
    });
    actionsContainer.appendChild(btnSwitch);
  }

  // 2. 为所有有效账号添加"导出配置"按钮
  if (account.storageState !== 'missing') {
    const btnExport = document.createElement('button');
    btnExport.className = 'btn-account-action export';
    btnExport.textContent = '导出配置';
    btnExport.addEventListener('click', async (e) => {
      e.stopPropagation();
      btnExport.disabled = true;
      btnExport.textContent = '导出中...';
      try {
        const eRes = await window.agyHubAPI.exportLocalAccount(account.id);
        if (eRes && eRes.success) {
          logToTerminal(`[Account] 账号配置成功导出: ${account.email}`, 'success');
        } else if (eRes && eRes.code === 'CANCELED') {
          // 用户取消，静默处理
        } else {
          alert('导出失败: ' + (eRes?.error || '未知错误'));
        }
      } catch (err) {
        alert('导出发生异常: ' + err.message);
      } finally {
        btnExport.disabled = false;
        btnExport.textContent = '导出配置';
      }
    });
    actionsContainer.appendChild(btnExport);
  }

  if (actionsContainer.children.length > 0) {
    security.appendChild(actionsContainer);
  }

  row.append(avatar, identity, security);

  // 添加配额显示区
  const quotaPanel = document.createElement('div');
  quotaPanel.className = 'local-account-quota';
  
  if (account.storageState === 'missing') {
    quotaPanel.innerHTML = `<div class="quota-error">凭据不可用，请先在官方客户端登录该账号</div>`;
  } else {
    quotaPanel.innerHTML = `<div class="quota-spinner">正在查询实时额度...</div>`;
    
    // 格式化重置倒计时
    function formatResetTime(isoStr) {
      if (!isoStr) return '';
      try {
        const target = new Date(isoStr);
        const now = new Date();
        const diffMs = target - now;
        if (diffMs <= 0) return '';
        const diffMins = Math.round(diffMs / 60000);
        if (diffMins < 60) return `<span style="font-size:10px;opacity:0.75;margin-left:4px;">(${diffMins}m重置)</span>`;
        const diffHours = Math.floor(diffMins / 60);
        const remMins = diffMins % 60;
        if (diffHours < 24) return `<span style="font-size:10px;opacity:0.75;margin-left:4px;">(${diffHours}h${remMins}m重置)</span>`;
        const diffDays = Math.floor(diffHours / 24);
        const remHours = diffHours % 24;
        return `<span style="font-size:10px;opacity:0.75;margin-left:4px;">(${diffDays}d${remHours}h重置)</span>`;
      } catch(e) { return ''; }
    }

    // 异步拉取该账号的配额信息
    const qPromise = (async () => {
      try {
        const res = await window.agyHubAPI.fetchAccountQuota(account.id);
        if (res && res.success) {
          if (res.quotaSourceHost) {
            logToTerminal(`[Quota] ${account.email} source: ${res.quotaSourceHost}`);
          }
          const c5hR = formatResetTime(res.quota.claude5hReset);
          const cWkR = formatResetTime(res.quota.claudeWeeklyReset);
          const g5hR = formatResetTime(res.quota.gemini5hReset);
          const gWkR = formatResetTime(res.quota.geminiWeeklyReset);

          quotaPanel.innerHTML = `
            <div class="quota-grid">
              <div class="quota-col">
                <div class="quota-platform">Claude / GPT</div>
                <div class="quota-item">
                  <div class="quota-label"><span>5h 限制 ${c5hR}</span> <span class="quota-val">${res.quota.claude5h}</span></div>
                  <div class="quota-bar"><div class="quota-fill" style="width: ${res.quota.claude5h}"></div></div>
                </div>
                <div class="quota-item">
                  <div class="quota-label"><span>每周上限 ${cWkR}</span> <span class="quota-val">${res.quota.claudeWeekly}</span></div>
                  <div class="quota-bar"><div class="quota-fill" style="width: ${res.quota.claudeWeekly}"></div></div>
                </div>
              </div>
              <div class="quota-col">
                <div class="quota-platform">Gemini</div>
                <div class="quota-item">
                  <div class="quota-label"><span>5h 限制 ${g5hR}</span> <span class="quota-val">${res.quota.gemini5h}</span></div>
                  <div class="quota-bar"><div class="quota-fill" style="width: ${res.quota.gemini5h}"></div></div>
                </div>
                <div class="quota-item">
                  <div class="quota-label"><span>每周上限 ${gWkR}</span> <span class="quota-val">${res.quota.geminiWeekly}</span></div>
                  <div class="quota-bar"><div class="quota-fill" style="width: ${res.quota.geminiWeekly}"></div></div>
                </div>
              </div>
            </div>
          `;
          
          if (res.quotaDetails && Object.keys(res.quotaDetails).length > 0) {
            logToTerminal(`[Quota] 账号 ${account.email} 详细配额明细 (Project: ${res.projectId || '未知'}): ${JSON.stringify(res.quotaDetails)}`);
          }
          if (res.quotaDataDebug && Object.keys(res.quotaDataDebug).length > 0) {
            logToTerminal(`[Quota] 账号 ${account.email} 响应体最外层全局非 models 属性: ${JSON.stringify(res.quotaDataDebug)}`);
          }
          
          // 渲染完成后稍微延迟给进度条上色及填充，以展示顺滑过渡动画
          setTimeout(() => {
            quotaPanel.querySelectorAll('.quota-fill').forEach(fill => {
              const val = parseInt(fill.style.width) || 0;
              if (val >= 50) fill.style.backgroundColor = 'var(--text-accent, #3ba5fc)';
              else if (val >= 25) fill.style.backgroundColor = '#fca240';
              else fill.style.backgroundColor = '#f06c8b';
            });
          }, 50);

          return {
            accountId: account.id,
            success: true,
            gemini5h: parseInt(res.quota.gemini5h) || 0,
            geminiWeekly: parseInt(res.quota.geminiWeekly) || 0,
            claude5h: parseInt(res.quota.claude5h) || 0,
            claudeWeekly: parseInt(res.quota.claudeWeekly) || 0
          };
        } else {
          if (accountUi.renderQuotaFailure) {
            accountUi.renderQuotaFailure({
              container: quotaPanel,
              row,
              statusBadgeArea,
              result: res || {},
              onReauthorize: () => {
                btnAddLocalAccount?.click();
                if (oauthStatusMessage) {
                  oauthStatusMessage.textContent = `${account.email || account.name || '该账号'} 的授权已失效，正在启动 Google 登录授权…`;
                }
                // This is still user-initiated: only the recovery button reaches this path.
                btnStartOauth?.click();
              },
              onRetry: () => loadLocalAccounts()
            });
          } else {
            quotaPanel.textContent = res?.message || res?.error || '实时额度暂未拉取成功';
            quotaPanel.className = 'local-account-quota quota-error';
          }
          logToTerminal(`[Quota] ${account.email || account.id}: ${res?.code || 'ACCOUNT_UNKNOWN_ERROR'} ${res?.message || ''}`, 'error');
        }
      } catch (err) {
        if (accountUi.renderQuotaFailure) {
          accountUi.renderQuotaFailure({
            container: quotaPanel,
            row,
            statusBadgeArea,
            result: {
              title: '账号状态检查失败',
              message: '查询过程中发生了本地异常。',
              advice: '请重新查询；如果持续失败，请复制一键诊断报告。',
              action: 'retry',
              actionLabel: '重新查询'
            },
            onRetry: () => loadLocalAccounts()
          });
        } else {
          quotaPanel.textContent = '账号状态检查失败，请重新查询。';
          quotaPanel.className = 'local-account-quota quota-error';
        }
        logToTerminal(`[Quota] ${account.email || account.id}: ${err.message}`, 'error');
      }
      return { accountId: account.id, success: false };
    })();
    
    if (activeQuotaPromises) {
      activeQuotaPromises.push(qPromise);
    }
  }
  
  row.appendChild(quotaPanel);
  return row;
}

async function loadLocalAccounts(options = {}) {
  const { logToTerminal = () => {} } = options;
  const localAccountsList = document.getElementById('local-accounts-list');
  const localAccountCount = document.getElementById('local-account-count');
  const localAccountCurrent = document.getElementById('local-account-current');
  if (!localAccountsList || !localAccountCount || !localAccountCurrent) return;

  localAccountsList.replaceChildren();
  const loading = document.createElement('div');
  loading.className = 'local-accounts-state';
  loading.textContent = '正在读取本地账号...';
  localAccountsList.appendChild(loading);
  localAccountCount.textContent = '-';
  localAccountCurrent.textContent = '正在读取...';
  if (btnRefreshLocalAccounts) btnRefreshLocalAccounts.disabled = true;

  const activeQuotaPromises = [];

  try {
    const result = await window.agyHubAPI.listLocalAccounts();
    if (!result || !result.success) {
      throw new Error(result?.error || '本地账号读取失败');
    }

    const accounts = Array.isArray(result.accounts) ? result.accounts : [];
    localAccountCount.textContent = String(accounts.length);
    const current = accounts.find(account => account.current);
    localAccountCurrent.textContent = current
      ? (current.email || current.name || '已识别')
      : '未设置';
    localAccountsList.replaceChildren();

    if (accounts.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'local-accounts-state empty';
      empty.textContent = '暂未发现本地账号';
      localAccountsList.appendChild(empty);
    } else {
      accounts.forEach((account, index) => {
        localAccountsList.appendChild(createLocalAccountRow(account, index, activeQuotaPromises, logToTerminal));
      });

      // 异步执行智能算分与账号推荐标记
      if (activeQuotaPromises.length > 0) {
        (async () => {
          const quotaResults = await Promise.all(activeQuotaPromises);
          const validResults = quotaResults.filter(r => r.success);
          if (validResults.length === 0) return;

          // 核心算法函数：S = a * W + (1 - a) * H, 其中 a = 1 - (W/100)^2
          const calculateScore = (w, h) => {
            const wFraction = w / 100;
            const alpha = 1 - Math.pow(wFraction, 2);
            return alpha * w + (1 - alpha) * h;
          };

          let bestGeminiId = null;
          let bestGeminiScore = -1;
          let bestClaudeId = null;
          let bestClaudeScore = -1;

          for (const res of validResults) {
            const gScore = calculateScore(res.geminiWeekly, res.gemini5h);
            const cScore = calculateScore(res.claudeWeekly, res.claude5h);

            // 只有剩余额度大于 0% 的情况下参与算分推荐
            if (gScore > bestGeminiScore && res.geminiWeekly > 0) {
              bestGeminiScore = gScore;
              bestGeminiId = res.accountId;
            }
            if (cScore > bestClaudeScore && res.claudeWeekly > 0) {
              bestClaudeScore = cScore;
              bestClaudeId = res.accountId;
            }
          }

          if (bestGeminiId) {
            const geminiRow = localAccountsList.querySelector(`.local-account-row[data-account-id="${bestGeminiId}"]`);
            if (geminiRow) {
              const nameLine = geminiRow.querySelector('.local-account-title-line');
              if (nameLine && !nameLine.querySelector('.recommend-gemini')) {
                nameLine.appendChild(createLocalAccountBadge('💡 Gemini 推荐', 'recommend-gemini'));
                geminiRow.classList.add('recommended-card-gemini');
              }
            }
          }
          if (bestClaudeId) {
            const claudeRow = localAccountsList.querySelector(`.local-account-row[data-account-id="${bestClaudeId}"]`);
            if (claudeRow) {
              const nameLine = claudeRow.querySelector('.local-account-title-line');
              if (nameLine && !nameLine.querySelector('.recommend-claude')) {
                nameLine.appendChild(createLocalAccountBadge('💡 Claude 推荐', 'recommend-claude'));
                claudeRow.classList.add('recommended-card-claude');
              }
            }
          }
        })();
      }
    }

    logToTerminal(`[Accounts] 已读取 ${accounts.length} 个本地账号。`, 'success');
  } catch (error) {
    localAccountCount.textContent = '0';
    localAccountCurrent.textContent = '读取失败';
    localAccountsList.replaceChildren();
    const failed = document.createElement('div');
    failed.className = 'local-accounts-state error';
    failed.textContent = error.message || '本地账号读取失败';
    localAccountsList.appendChild(failed);
    logToTerminal(`[Accounts] ${error.message}`, 'error');
  } finally {
    if (btnRefreshLocalAccounts) btnRefreshLocalAccounts.disabled = false;
  }
}

// 输出日志到终端

  return { loadLocalAccounts };
});
