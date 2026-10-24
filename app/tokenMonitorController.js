(function exposeTokenMonitorController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyTokenMonitorController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createTokenMonitorController() {
async function init(dependencies = {}) {
  const { setCompactCount, logToTerminal = () => {} } = dependencies;
  const statTotal = document.getElementById('stat-total-token');
  const statHitRate = document.getElementById('stat-cache-hit-rate');
  const statCached = document.getElementById('stat-cached-token');
  const statOutput = document.getElementById('stat-output-token');
  const logList = document.getElementById('token-log-list');
  const inputUpstream = document.getElementById('input-proxy-upstream');
  const btnApply = document.getElementById('btn-proxy-apply');
  
  // Tab 切换逻辑
  const btnTabAccounts = document.getElementById('btn-la-tab-accounts');
  const btnTabToken = document.getElementById('btn-la-tab-token');
  const panelAccounts = document.getElementById('panel-la-accounts');
  const panelToken = document.getElementById('panel-la-token');
  const localAccountsPage = document.getElementById('tab-local-accounts');
  let statsTimer = null;
  let statusTimer = null;

  const monitorStatus = document.createElement('div');
  monitorStatus.id = 'token-monitor-status';
  monitorStatus.style.cssText = 'display:flex;align-items:center;gap:7px;margin:0 0 10px;padding:8px 10px;border:1px solid var(--border-subtle);border-radius:6px;font-size:11px;color:var(--text-dim);background:rgba(255,255,255,0.025);';
  if (panelToken) panelToken.insertBefore(monitorStatus, panelToken.children[1] || null);

  async function refreshMonitorStatus() {
    if (!window.agyHubAPI.getTokenMonitorStatus) return;
    try {
      const status = await window.agyHubAPI.getTokenMonitorStatus();
      const localActive = Boolean(status.localMonitor && status.localMonitor.ready);
      const proxyActive = Boolean(status.ready && status.routed);
      const active = localActive || proxyActive;
      const color = active ? '#52c49c' : '#fbd160';
      const label = localActive
        ? `本地实时估算已启动（监听 ${status.localMonitor.watchedFiles || 0} 个会话，无需重启 Antigravity）`
        : proxyActive
          ? '官方 Token 流量监控已接管 Antigravity'
        : (status.ready ? '代理已就绪，请重启 Antigravity 以接管对话流量' : 'Token 代理未监听');
      monitorStatus.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};flex:none;"></span><span>${label}</span>`;
      monitorStatus.style.borderColor = `${color}55`;
    } catch (error) {
      monitorStatus.textContent = `监控状态读取失败：${error.message}`;
    }
  }

  async function refreshStats() {
    try {
      const stats = await window.agyHubAPI.getTokenStats();
      if (stats) {
        window.globalTokenStatsRaw = stats;
        if (window.currentFilter === 'all') updateDashboard(stats);
      }
    } catch (_) {}
  }

  function isTokenMonitorVisible() {
    return !document.hidden
      && Boolean(localAccountsPage?.classList.contains('active'))
      && Boolean(panelToken)
      && panelToken.style.display !== 'none';
  }

  function stopPolling() {
    if (statsTimer) clearInterval(statsTimer);
    if (statusTimer) clearInterval(statusTimer);
    statsTimer = null;
    statusTimer = null;
  }

  function startPolling() {
    if (statsTimer || statusTimer || !isTokenMonitorVisible()) return;
    void refreshStats();
    void refreshMonitorStatus();
    statsTimer = setInterval(refreshStats, 1500);
    statusTimer = setInterval(refreshMonitorStatus, 3000);
  }

  function syncPollingState() {
    if (isTokenMonitorVisible()) startPolling();
    else stopPolling();
  }

  if (btnTabAccounts && btnTabToken) {
    function switchLaTab(tab) {
      const entries = [
        ['accounts', btnTabAccounts, panelAccounts],
        ['token', btnTabToken, panelToken]
      ];
      for (const [name, button, panel] of entries) {
        const active = name === tab;
        button.classList.toggle('active', active);
        button.style.background = active ? 'var(--bg-card)' : 'transparent';
        button.style.color = active ? 'var(--text-main)' : 'var(--text-dim)';
        if (panel) panel.style.display = active ? 'flex' : 'none';
      }
      syncPollingState();
    }
    btnTabAccounts.addEventListener('click', () => switchLaTab('accounts'));
    btnTabToken.addEventListener('click', () => switchLaTab('token'));
  }

  if (!statTotal) return;

  function updateDashboard(stats) {
    if (!stats) return;
    setCompactCount(statTotal, stats.totalTokens || 0, '观测 Token');
    const cacheDataAvailable = Boolean(stats.cacheDataAvailable);
    if (cacheDataAvailable) {
      setCompactCount(statCached, stats.cachedTokens || 0, '官方缓存 Token');
    } else {
      statCached.textContent = '--';
      statCached.removeAttribute('title');
      statCached.removeAttribute('aria-label');
      delete statCached.dataset.exactValue;
    }
    setCompactCount(statOutput, stats.completionTokens || 0, '观测输出 Token');
    
    let hitRate = null;
    if (cacheDataAvailable && stats.cachePromptTokens > 0) {
      hitRate = (stats.cachedTokens / stats.cachePromptTokens) * 100;
    }
    statHitRate.textContent = hitRate === null ? '--' : hitRate.toFixed(1) + '%';
    const fill = document.getElementById('cache-rate-fill');
    if (fill) {
      fill.style.width = hitRate === null ? '0%' : Math.min(100, Math.max(0, hitRate)).toFixed(1) + '%';
    }
  }

  // --- 新增状态控制 ---
  window.globalTokenLogs = [];
  window.currentFilter = 'all';
  window.currentPage = 1;
  window.pageSize = 20;
  window.globalTokenStatsRaw = null;

  function renderLogList() {
    const logList = document.getElementById('token-log-list');
    if (!logList) return;

    // 1. Normalize and merge
    const normalized = window.globalTokenLogs.map(log => {
        if (log.type === 'res' || log.input !== undefined) {
             return {
                 type: 'res',
                 timestamp: log.time || log.timestamp,
                 duration: log.duration || 0,
                 promptTokens: log.input !== undefined ? log.input : (log.promptTokens || 0),
                 completionTokens: log.output !== undefined ? log.output : (log.completionTokens || 0),
                  cachedTokens: log.cached !== undefined ? log.cached : (log.cachedTokens || 0),
                  cacheKnown: Boolean(log.cacheKnown),
                  estimated: log.estimated,
                  source: log.source,
                  requestPath: log.requestPath,
                  contentType: log.contentType,
                  usageProtocol: log.usageProtocol
             };
        }
        return log;
    });

    // 智能合并算法
    const arr = [...normalized].reverse();
    const merged = [];
    for (const log of arr) {
        if (log.type === 'res' && log.source === 'local-transcript') {
            if (log.promptTokens === 0) {
                if (merged.length > 0) {
                    const last = merged[merged.length - 1];
                    if (last.type === 'res' && last.source === 'local-transcript') {
                        last.completionTokens = (last.completionTokens || 0) + (log.completionTokens || 0);
                        continue;
                    }
                }
            }
        }
        merged.push({ ...log });
    }
    let processed = merged.reverse();

    // 2. Filter by Time
    const now = new Date();
    processed = processed.filter(log => {
        if (!log.timestamp) return true;
        const time = new Date(log.timestamp);
        if (window.currentFilter === 'hour') return now - time <= 3600000;
        if (window.currentFilter === 'day') return time.getFullYear() === now.getFullYear() && time.getMonth() === now.getMonth() && time.getDate() === now.getDate();
        if (window.currentFilter === 'week') {
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            const startOfWeek = new Date(now.setDate(diff));
            startOfWeek.setHours(0,0,0,0);
            return time >= startOfWeek;
        }
        if (window.currentFilter === 'month') return time.getFullYear() === now.getFullYear() && time.getMonth() === now.getMonth();
        return true;
    });

    // 3. Update Dashboard
    if (window.currentFilter === 'all' && window.globalTokenStatsRaw) {
        updateDashboard(window.globalTokenStatsRaw);
    } else {
        let tInput = 0, tOutput = 0, tCached = 0, tCachePrompt = 0, cacheSamples = 0;
        for (const log of processed) {
            if (log.type === 'res') {
                tInput += log.promptTokens || 0;
                tOutput += log.completionTokens || 0;
                if (log.cacheKnown) {
                    tCached += log.cachedTokens || 0;
                    tCachePrompt += log.promptTokens || 0;
                    cacheSamples += 1;
                }
            }
        }
        updateDashboard({
            totalTokens: tInput + tOutput,
            promptTokens: tInput,
            completionTokens: tOutput,
            cachedTokens: tCached,
            cachePromptTokens: tCachePrompt,
            cacheSamples,
            cacheDataAvailable: cacheSamples > 0
        });
    }

    // 4. Pagination
    const totalItems = processed.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / window.pageSize));
    if (window.currentPage > totalPages) window.currentPage = totalPages;
    
    const startIndex = (window.currentPage - 1) * window.pageSize;
    const paginated = processed.slice(startIndex, startIndex + window.pageSize);
    
    // 5. Render DOM
    logList.innerHTML = '';
    if (paginated.length === 0) {
        logList.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); text-align: center; margin-top: 20px;">暂无满足条件的日志</div>`;
    } else {
        paginated.forEach(log => {
            const div = document.createElement('div');
            div.style.cssText = 'background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 6px; border-left: 2px solid var(--accent-cyan); font-size: 11px; line-height: 1.5; margin-bottom: 8px;';
            const timeStr = new Date(log.timestamp).toLocaleTimeString();
            let details = '';
            if (log.type === 'req') {
                details = `<span style="color:var(--text-dim);">[Req]</span> ${log.url}`;
            } else if (log.type === 'res') {
                const estimateMark = log.estimated ? '≈' : '';
                const isLocal = log.source === 'local-transcript';
                const sourceLabel = isLocal ? '本地实时估算' : (log.source === 'manual' ? '手动' : (log.estimated ? '代理估算' : '官方'));
                const duration = isLocal ? '' : `耗时: ${log.duration}ms | `;
                const cacheText = log.cacheKnown ? log.cachedTokens : '未知';
                const protocolText = !log.estimated && log.usageProtocol ? `/${log.usageProtocol}` : '';
                details = `<span style="color:#fbd160;">[Res/${sourceLabel}${protocolText}]</span> ${duration}输入: ${estimateMark}${log.promptTokens} (缓存:${cacheText}) | 输出: ${estimateMark}${log.completionTokens}`;
            } else {
                details = log.message;
            }
            div.innerHTML = `<span style="color:var(--text-dim); margin-right:8px;">[${timeStr}]</span> ${details}`;
            logList.appendChild(div);
        });
    }
    
    // 6. Update Pagination UI
    const info = document.getElementById('token-page-info');
    const btnPrev = document.getElementById('btn-page-prev');
    const btnNext = document.getElementById('btn-page-next');
    if (info) info.textContent = `共 ${totalItems} 条，第 ${window.currentPage} / ${totalPages} 页`;
    if (btnPrev) btnPrev.disabled = window.currentPage <= 1;
    if (btnNext) btnNext.disabled = window.currentPage >= totalPages;
  }

  // --- 初始化事件监听 ---
  setTimeout(() => {
      const filterTabs = document.querySelectorAll('.filter-tab');
      filterTabs.forEach(tab => {
          tab.addEventListener('click', (e) => {
              filterTabs.forEach(t => {
                  t.classList.remove('active');
                  t.style.background = 'transparent';
                  t.style.color = 'var(--text-dim)';
              });
              e.target.classList.add('active');
              e.target.style.background = 'var(--bg-card)';
              e.target.style.color = 'var(--text-main)';
              
              window.currentFilter = e.target.dataset.filter;
              window.currentPage = 1;
              renderLogList();
          });
      });

      const btnPrev = document.getElementById('btn-page-prev');
      const btnNext = document.getElementById('btn-page-next');
      if (btnPrev) {
          btnPrev.addEventListener('click', () => {
              if (window.currentPage > 1) {
                  window.currentPage--;
                  renderLogList();
              }
          });
      }
      if (btnNext) {
          btnNext.addEventListener('click', () => {
              window.currentPage++;
              renderLogList();
          });
      }
  }, 100);


  try {
    const stats = await window.agyHubAPI.getTokenStats();
    if (stats) {
        window.globalTokenStatsRaw = stats;
        window.globalTokenLogs = stats.logs || [];
        renderLogList();
    }
  } catch(e) {
    console.error('Failed to init token stats:', e);
  }

  const visibilityObserver = new MutationObserver(syncPollingState);
  if (localAccountsPage) visibilityObserver.observe(localAccountsPage, { attributes: true, attributeFilter: ['class'] });
  if (panelToken) visibilityObserver.observe(panelToken, { attributes: true, attributeFilter: ['style', 'class'] });
  document.addEventListener('visibilitychange', syncPollingState);
  window.addEventListener('pagehide', stopPolling, { once: true });
  syncPollingState();

  if (window.agyHubAPI.onTokenLogUpdate) {
    window.agyHubAPI.onTokenLogUpdate((data) => {
      if (data.type === 'stats') {
         window.globalTokenStatsRaw = data.stats;
         if (window.currentFilter === 'all') {
             updateDashboard(data.stats);
         }
      } else {
         window.globalTokenLogs.unshift(data);
         if (window.globalTokenLogs.length > 500) {
             window.globalTokenLogs = window.globalTokenLogs.slice(0, 500);
         }
         renderLogList();
      }
    });
  }

  const btnRefreshStats = document.getElementById('btn-refresh-token-stats');
  if (btnRefreshStats) {
    btnRefreshStats.addEventListener('click', async () => {
      const spinIcon = document.getElementById('icon-refresh-token-spin');
      if (spinIcon) spinIcon.style.transition = 'transform 0.5s ease';
      if (spinIcon) spinIcon.style.transform = 'rotate(360deg)';
      btnRefreshStats.disabled = true;
      try {
        const stats = await window.agyHubAPI.getTokenStats();
        if (stats) {
          window.globalTokenStatsRaw = stats;
          window.globalTokenLogs = stats.logs || [];
          renderLogList();
        }
      } catch(e) {
        console.error('Manual refresh stats error:', e);
      } finally {
        setTimeout(() => {
          if (spinIcon) spinIcon.style.transform = 'rotate(0deg)';
          btnRefreshStats.disabled = false;
        }, 500);
      }
    });
  }

  if (btnApply) {
    btnApply.addEventListener('click', async () => {
      const upstream = inputUpstream.value.trim();
      if (!upstream) return alert('请输入有效的上游地址');
      btnApply.disabled = true;
      btnApply.textContent = '应用中...';
      try {
        await window.agyHubAPI.startTokenProxy(31000, upstream);
        logToTerminal('[Proxy] 代理转发目标已设置并激活: ' + upstream, 'success');
        btnApply.textContent = '✓ 已生效';
        btnApply.style.backgroundColor = 'rgba(0, 255, 204, 0.15)';
        btnApply.style.borderColor = '#00ffcc';
        btnApply.style.color = '#00ffcc';
      } catch(e) {
        alert('应用失败: ' + e.message);
        btnApply.textContent = '应用';
      } finally {
        btnApply.disabled = false;
      }
    });
  }
}


  return { init };
});
