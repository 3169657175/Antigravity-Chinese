(function exposeLocalAccountsController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyLocalAccountsController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createLocalAccountsController() {
const QUOTA_SECTIONS = Object.freeze([
  { title: 'Claude / GPT', fields: [['claude5h', '5h 限制'], ['claudeWeekly', '每周上限']] },
  { title: 'Gemini', fields: [['gemini5h', '5h 限制'], ['geminiWeekly', '每周上限']] }
]);
function argonLastSeenCopy(result) {
  if (result?.argonCapabilityStatus !== 'previously-available') return null;
  const checkedAt = Number(result.argonLastKnown?.checkedAt);
  const ageMs = Date.now() - checkedAt;
  if (!Number.isFinite(ageMs) || ageMs < 0) return '历史已验证，实时额度待确认';
  const age = ageMs < 3600000 ? Math.max(1, Math.round(ageMs / 60000)) + ' 分钟前' :
    ageMs < 86400000 ? Math.round(ageMs / 3600000) + ' 小时前' :
    Math.round(ageMs / 86400000) + ' 天前';
  return `上次确认：${result.argonLastKnown?.lastPercent || '额度未知'} · ${age}（非实时）`;
}
let localAccountsLoadGeneration = 0;

function quotaFieldState(result, field) {
  if (/^\d+%$/.test(String(result?.quota?.[field] || ''))) return 'available';
  const missing = Array.isArray(result?.missingQuotaFields) ? result.missingQuotaFields : [];
  const confirmed = Array.isArray(result?.confirmedMissingQuotaFields)
    ? result.confirmedMissingQuotaFields
    : missing.filter(name => !(result?.unconfirmedQuotaFields || []).includes(name));
  return confirmed.includes(field) ? 'missing' : 'unconfirmed';
}

function quotaPercent(result, field) {
  if (quotaFieldState(result, field) !== 'available') return null;
  const value = Number.parseInt(result.quota[field], 10);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function calculateQuotaScore(weekly, shortWindow) {
  if (weekly === null) return shortWindow;
  if (shortWindow === null) return weekly;
  const weeklyFraction = weekly / 100;
  const alpha = 1 - Math.pow(weeklyFraction, 2);
  return alpha * weekly + (1 - alpha) * shortWindow;
}

function quotaSectionsForResult(result) {
  const sections = [...QUOTA_SECTIONS];
  if (result?.capabilities?.argon === true) {
    sections.push({ title: 'Gemini 4 Argon', fields: [['argonWeekly', '每周上限']] });
  }
  return sections.map(section => ({
    title: section.title,
    fields: section.fields
      .map(([field, label]) => ({ field, label, state: quotaFieldState(result, field) }))
      .filter(item => item.state !== 'missing')
  })).filter(section => section.fields.length > 0);
}

function createLocalAccountBadge(text, type) {
  const badge = document.createElement('span');
  badge.className = `local-account-badge ${type}`;
  badge.textContent = text;
  return badge;
}

function createLocalAccountRow(account, index, activeQuotaPromises, logToTerminal, isCurrentLoad = () => true) {
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
          const lifecycleText = sRes.restarted
            ? '，Antigravity 已正常重启并保留原启动参数'
            : sRes.willApplyOnNextLaunch
              ? '，将在下次启动 Antigravity 时生效'
              : sRes.restartRequired
                ? '，需要手动重新打开 Antigravity'
                : '，账号状态已更新';
          logToTerminal(`[Account] 已切换当前活动账户：${account.email}${lifecycleText}`, 'success');
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

    function getBarColor(percent) {
      const val = Number(percent) || 0;
      if (val >= 50) return 'var(--accent-green, #10b981)';
      if (val >= 25) return '#f59e0b';
      return 'var(--accent-pink, #ef4444)';
    }

    function renderQuotaResultIntoPanel(res) {
      const quotaColumns = quotaSectionsForResult(res).map(section => {
        const isArgonSection = section.title.toLowerCase().includes('argon');
        const items = section.fields.map(({ field, label, state }) => {
          if (state === 'unconfirmed') {
            const lastSeen = isArgonSection ? argonLastSeenCopy(res) : null;
            return `<div class="quota-item pending"><div class="quota-label"><span>${label}</span><span class="quota-val">待确认</span></div>${lastSeen ? `<div class="quota-last-seen">${lastSeen}</div>` : ''}</div>`;
          }
          const percent = quotaPercent(res, field);
          const reset = formatResetTime(res.quota[`${field}Reset`]);
          const barColor = isArgonSection && percent >= 50 ? '#8b5cf6' : getBarColor(percent);
          return `<div class="quota-item"><div class="quota-label"><span>${label} ${reset}</span><span class="quota-val">${percent}%</span></div><div class="quota-bar"><div class="quota-fill" style="width: ${percent}%; background-color: ${barColor};"></div></div></div>`;
        }).filter(Boolean).join('');
        return items ? `<div class="quota-col${isArgonSection ? ' quota-col-argon' : ''}"><div class="quota-platform">${section.title}</div>${items}</div>` : '';
      }).filter(Boolean);
      quotaPanel.className = 'local-account-quota';
      quotaPanel.innerHTML = `<div class="quota-grid${quotaColumns.length === 1 ? ' single' : ''}">${quotaColumns.join('')}</div>`;
    }

    const swrCacheKey = `agy_hub_quota_swr_v2_${account.id}`;
    let swrRendered = false;
    try {
      const rawCache = typeof localStorage !== 'undefined' ? localStorage.getItem(swrCacheKey) : null;
      if (rawCache) {
        const parsed = JSON.parse(rawCache);
        if (parsed && parsed.savedAt && (Date.now() - parsed.savedAt < 300000) && parsed.res?.success && parsed.res?.quota) {
          renderQuotaResultIntoPanel(parsed.res);
          swrRendered = true;
        }
      }
    } catch (_) {}

    if (!swrRendered) {
      quotaPanel.innerHTML = `<div class="quota-spinner">正在同步实时额度...</div>`;
    }

    // 异步拉取该账号的配额信息
    const qPromise = (async () => {
      try {
        const res = await window.agyHubAPI.fetchAccountQuota(account.id);
        if (!isCurrentLoad()) return { accountId: account.id, success: false, stale: true };
        if (res && res.success) {
          if (res.quotaSourceHost) {
            logToTerminal(`[Quota] ${account.email} source: ${res.quotaSourceHost}, ${res.quotaResponseTimeMs || 0}ms`);
          }
          renderQuotaResultIntoPanel(res);
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(swrCacheKey, JSON.stringify({ savedAt: Date.now(), res }));
            }
          } catch (_) {}

          if (res.quotaDetails && Object.keys(res.quotaDetails).length > 0) {
            logToTerminal(`[Quota] 账号 ${account.email} 详细配额明细 (Project: ${res.projectId || '未知'}): ${JSON.stringify(res.quotaDetails)}`);
          }
          if (res.quotaDataDebug && Object.keys(res.quotaDataDebug).length > 0) {
            logToTerminal(`[Quota] 账号 ${account.email} 响应体最外层全局非 models 属性: ${JSON.stringify(res.quotaDataDebug)}`);
          }

          return {
            accountId: account.id,
            success: true,
            gemini5h: quotaPercent(res, 'gemini5h'),
            geminiWeekly: quotaPercent(res, 'geminiWeekly'),
            claude5h: quotaPercent(res, 'claude5h'),
            claudeWeekly: quotaPercent(res, 'claudeWeekly'),
            argonWeekly: quotaPercent(res, 'argonWeekly'),
            capabilities: res.capabilities || {}
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
        if (!isCurrentLoad()) return { accountId: account.id, success: false, stale: true };
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
  const generation = ++localAccountsLoadGeneration;
  const isCurrentLoad = () => generation === localAccountsLoadGeneration;

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
    if (!isCurrentLoad()) return;

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
        localAccountsList.appendChild(createLocalAccountRow(account, index, activeQuotaPromises, logToTerminal, isCurrentLoad));
      });

      // 异步执行智能算分与账号推荐标记
      if (activeQuotaPromises.length > 0) {
        const quotaResults = await Promise.all(activeQuotaPromises);
        if (!isCurrentLoad()) return;
        const validResults = quotaResults.filter(r => r.success);
        if (validResults.length > 0) {
          let bestGeminiId = null;
          let bestGeminiScore = -1;
          let bestClaudeId = null;
          let bestClaudeScore = -1;

          for (const res of validResults) {
            const gScore = calculateQuotaScore(res.geminiWeekly, res.gemini5h);
            const cScore = calculateQuotaScore(res.claudeWeekly, res.claude5h);

            // 周额度缺失时使用已确认的 5h 额度，避免整个平台失去推荐能力。
            if (gScore !== null && gScore > bestGeminiScore && gScore > 0) {
              bestGeminiScore = gScore;
              bestGeminiId = res.accountId;
            }
            if (cScore !== null && cScore > bestClaudeScore && cScore > 0) {
              bestClaudeScore = cScore;
              bestClaudeId = res.accountId;
            }
          }

          if (bestGeminiId) {
            const geminiRow = localAccountsList.querySelector(`.local-account-row[data-account-id="${bestGeminiId}"]`);
            if (geminiRow) {
              const nameLine = geminiRow.querySelector('.local-account-title-line');
              if (nameLine && !nameLine.querySelector('.recommend-gemini')) {
                nameLine.appendChild(createLocalAccountBadge('Gemini 优选', 'recommend-gemini'));
                geminiRow.classList.add('recommended-card-gemini');
              }
            }
          }
          if (bestClaudeId) {
            const claudeRow = localAccountsList.querySelector(`.local-account-row[data-account-id="${bestClaudeId}"]`);
            if (claudeRow) {
              const nameLine = claudeRow.querySelector('.local-account-title-line');
              if (nameLine && !nameLine.querySelector('.recommend-claude')) {
                nameLine.appendChild(createLocalAccountBadge('Claude 优选', 'recommend-claude'));
                claudeRow.classList.add('recommended-card-claude');
              }
            }
          }
        }
      }
    }

    logToTerminal(`[Accounts] 已读取 ${accounts.length} 个本地账号。`, 'success');
  } catch (error) {
    if (!isCurrentLoad()) return;
    localAccountCount.textContent = '0';
    localAccountCurrent.textContent = '读取失败';
    localAccountsList.replaceChildren();
    const failed = document.createElement('div');
    failed.className = 'local-accounts-state error';
    failed.textContent = error.message || '本地账号读取失败';
    localAccountsList.appendChild(failed);
    logToTerminal(`[Accounts] ${error.message}`, 'error');
  } finally {
    if (isCurrentLoad() && btnRefreshLocalAccounts) btnRefreshLocalAccounts.disabled = false;
  }
}

// 输出日志到终端

  return { loadLocalAccounts, quotaFieldState, quotaPercent, calculateQuotaScore, quotaSectionsForResult };
});
