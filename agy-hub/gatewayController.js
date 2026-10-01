(function exposeGatewayController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyGatewayController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createGatewayController() {
  async function init(dependencies = {}) {
    const { scheduleAfterPaint, setCompactCount, formatCompactCount, escapeHTML } = dependencies;
  const gatewayUi = window.AgyGatewayUI || {};
      const formatTieredReport = response => gatewayUi.formatTestReport
        ? gatewayUi.formatTestReport(response?.report)
        : (response?.report?.summary || response?.message || response?.error || '测试完成');
      const tieredReportType = response => gatewayUi.reportType
        ? gatewayUi.reportType(response?.report)
        : (response?.success ? 'success' : 'error');
      const overviewMount = document.getElementById('codex-overview-mount');
      const gatewayPanel = document.getElementById('panel-la-codex');
      if (overviewMount && gatewayPanel && gatewayPanel.parentElement !== overviewMount) {
        gatewayPanel.style.display = 'flex';
        overviewMount.appendChild(gatewayPanel);
      }
      const stateBox = document.getElementById('codex-gateway-state');
      const stateTitle = document.getElementById('codex-gateway-state-title');
      const stateDetail = document.getElementById('codex-gateway-state-detail');
      const baseUrl = document.getElementById('codex-gateway-base-url');
      const account = document.getElementById('codex-gateway-account');
      const model = document.getElementById('codex-gateway-model');
      const modelControl = document.getElementById('codex-gateway-model-control');
      const port = document.getElementById('codex-gateway-port');
      const apiKey = document.getElementById('codex-gateway-api-key');
      const resultBox = document.getElementById('codex-gateway-result');
      const accountStatus = document.getElementById('codex-gateway-account-status');
      const accountName = document.getElementById('codex-gateway-account-name');
      const quotaGrid = document.getElementById('codex-gateway-quota-grid');
      const refreshQuotaButton = document.getElementById('btn-codex-gateway-refresh-quota');
      if (!stateBox || !window.agyHubAPI.getCodexGatewayStatus) return;
    
      const workspaceTabs = document.querySelectorAll('.codex-workspace-tab');
      const overviewPage = document.getElementById('codex-page-overview');
      const claudePage = document.getElementById('codex-page-claude');
      const usagePage = document.getElementById('codex-page-usage');
      const providerPage = document.getElementById('codex-page-provider');
      let activeCodexPage = 'overview';
      let gatewayRefreshAt = 0;
      let gatewayRefreshPromise = null;
      let claudeStatusCache = null;
      let claudeStatusRefreshAt = 0;
      let usageRefreshAt = 0;
    
      function switchCodexPage(page) {
        activeCodexPage = page;
        workspaceTabs.forEach(button => button.classList.toggle('active', button.dataset.codexPage === page));
        overviewPage?.classList.toggle('active', page === 'overview');
        claudePage?.classList.toggle('active', page === 'claude');
        usagePage?.classList.toggle('active', page === 'usage');
        providerPage?.classList.toggle('active', page === 'provider');
        scheduleAfterPaint(() => refreshCodexPage(page));
      }
    
      function refreshCodexPage(page) {
        if (page === 'overview') return refresh({ maxAgeMs: 5000 });
        if (page === 'claude') return refreshClaudeDesktopStatus({ maxAgeMs: 5000 });
        if (page === 'usage') return refreshCodexUsage({ maxAgeMs: 3000 });
        return Promise.resolve();
      }
    
      workspaceTabs.forEach(button => {
        button.addEventListener('click', () => switchCodexPage(button.dataset.codexPage));
      });
    
      const usageSourceButtons = document.querySelectorAll('.codex-usage-source-tab');
      const usagePagination = document.getElementById('codex-usage-pagination');
      const usagePageNumbers = document.getElementById('codex-usage-page-numbers');
      const usagePageSummary = document.getElementById('codex-usage-page-summary');
      const USAGE_PAGE_SIZE = 20;
      const usageLogPageBySource = new Map([
        ['codex-gateway', 1],
        ['claude-code-gateway', 1]
      ]);
      let activeUsageSource = 'codex-gateway';
      let latestUsageStats = null;
    
      function usagePageWindow(current, total) {
        const pages = new Set([1, total]);
        for (let page = current - 2; page <= current + 2; page += 1) {
          if (page >= 1 && page <= total) pages.add(page);
        }
        return [...pages].sort((a, b) => a - b);
      }
    
      function renderUsagePagination(totalItems, source) {
        if (!usagePagination || !usagePageNumbers || !usagePageSummary) return;
        const totalPages = Math.max(1, Math.ceil(totalItems / USAGE_PAGE_SIZE));
        const currentPage = Math.max(1, Math.min(totalPages, usageLogPageBySource.get(source) || 1));
        usageLogPageBySource.set(source, currentPage);
        usagePagination.hidden = totalItems === 0;
        usagePageSummary.textContent = `第 ${currentPage} / ${totalPages} 页 · 共 ${totalItems} 条`;
        const previous = usagePagination.querySelector('[data-page-action="previous"]');
        const next = usagePagination.querySelector('[data-page-action="next"]');
        if (previous) previous.disabled = currentPage <= 1;
        if (next) next.disabled = currentPage >= totalPages;
    
        usagePageNumbers.replaceChildren();
        let previousPage = 0;
        for (const page of usagePageWindow(currentPage, totalPages)) {
          if (previousPage && page - previousPage > 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '…';
            usagePageNumbers.appendChild(ellipsis);
          }
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.page = String(page);
          button.textContent = String(page);
          button.classList.toggle('active', page === currentPage);
          button.setAttribute('aria-current', page === currentPage ? 'page' : 'false');
          usagePageNumbers.appendChild(button);
          previousPage = page;
        }
      }
    
      function renderCodexUsage(stats, source = activeUsageSource) {
        latestUsageStats = stats;
        activeUsageSource = source;
        const isClaude = source === 'claude-code-gateway';
        const sourceName = isClaude ? 'Claude Code' : 'Codex';
        const allLogs = Array.isArray(stats?.logs) ? stats.logs.filter(Boolean) : [];
        for (const button of usageSourceButtons) {
          const selected = button.dataset.usageSource === source;
          button.classList.toggle('active', selected);
          button.setAttribute('aria-selected', String(selected));
          const counter = button.querySelector('[data-usage-count]');
          if (counter) counter.textContent = `${allLogs.filter(log => log.source === button.dataset.usageSource).length} 次`;
        }
        const sourceTitle = document.getElementById('gateway-usage-source-title');
        const requestLabel = document.getElementById('gateway-stat-request-label');
        const logTitle = document.getElementById('gateway-usage-log-title');
        const logSubtitle = document.getElementById('gateway-usage-log-subtitle');
        if (sourceTitle) sourceTitle.textContent = `${sourceName} 反代统计`;
        if (requestLabel) requestLabel.textContent = `${sourceName} 请求`;
        if (logTitle) logTitle.textContent = `最近 ${sourceName} 调用`;
        if (logSubtitle) logSubtitle.textContent = `${sourceName} 的官方 UsageMetadata，和另一种客户端独立计算`;
        const logs = (Array.isArray(stats?.logs) ? stats.logs : [])
          .filter(log => log && log.source === source);
        const totalPages = Math.max(1, Math.ceil(logs.length / USAGE_PAGE_SIZE));
        const currentPage = Math.max(1, Math.min(totalPages, usageLogPageBySource.get(source) || 1));
        usageLogPageBySource.set(source, currentPage);
        const pageStart = (currentPage - 1) * USAGE_PAGE_SIZE;
        const pageLogs = logs.slice(pageStart, pageStart + USAGE_PAGE_SIZE);
        const totals = logs.reduce((sum, log) => ({
          input: sum.input + (Number(log.input ?? log.promptTokens) || 0),
          output: sum.output + (Number(log.output ?? log.completionTokens) || 0),
          cached: sum.cached + (Number(log.cached ?? log.cachedTokens) || 0),
          uncached: sum.uncached + Math.max(0,
            (Number(log.input ?? log.promptTokens) || 0) - (Number(log.cached ?? log.cachedTokens) || 0))
        }), { input: 0, output: 0, cached: 0, uncached: 0 });
        const rate = totals.input > 0 ? totals.cached / totals.input * 100 : 0;
        const inputMetric = document.getElementById('codex-stat-input');
        setCompactCount(inputMetric, totals.uncached, '未缓存输入');
        if (inputMetric.previousElementSibling) inputMetric.previousElementSibling.textContent = '未缓存输入';
        if (inputMetric.nextElementSibling) {
          inputMetric.nextElementSibling.textContent = `总上下文 ${formatCompactCount(totals.input)}`;
          inputMetric.nextElementSibling.title = `总上下文：${Math.round(totals.input).toLocaleString('en-US')} Token`;
        }
        setCompactCount(document.getElementById('codex-stat-output'), totals.output, '输出 Token');
        setCompactCount(document.getElementById('codex-stat-cached'), totals.cached, '缓存 Token');
        document.getElementById('codex-stat-rate').textContent = `${rate.toFixed(1)}%`;
        setCompactCount(document.getElementById('codex-stat-requests'), logs.length, '网关请求', '次');
        const list = document.getElementById('codex-usage-log');
        if (!list) return;
        list.replaceChildren();
        renderUsagePagination(logs.length, source);
        if (!logs.length) {
          const empty = document.createElement('div');
          empty.className = 'codex-usage-empty';
          empty.textContent = `等待 ${sourceName} 通过 AGY Hub 发起请求`;
          list.appendChild(empty);
          return;
        }
        for (const log of pageLogs) {
          const row = document.createElement('div');
          row.className = 'codex-usage-row';
          const time = document.createElement('time');
          time.textContent = new Date(log.time || log.timestamp).toLocaleTimeString();
          const modelName = document.createElement('strong');
          modelName.textContent = log.model || 'AGY Hub';
          const inputValue = document.createElement('span');
          const totalInput = Number(log.input ?? log.promptTokens) || 0;
          const cachedInput = Number(log.cached ?? log.cachedTokens) || 0;
          inputValue.textContent = `新增 ${Math.max(0, totalInput - cachedInput)} / 上下文 ${totalInput}`;
          const outputValue = document.createElement('span');
          outputValue.textContent = `输出 ${Number(log.output ?? log.completionTokens) || 0}`;
          const cachedValue = document.createElement('span');
          cachedValue.className = 'cached';
          cachedValue.textContent = `缓存 ${Number(log.cached ?? log.cachedTokens) || 0}`;
          row.append(time, modelName, inputValue, outputValue, cachedValue);
          list.appendChild(row);
        }
      }
    
      usageSourceButtons.forEach(button => {
        button.addEventListener('click', () => {
          renderCodexUsage(latestUsageStats || { logs: [] }, button.dataset.usageSource);
        });
      });
    
      usagePagination?.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || button.disabled) return;
        const sourceLogs = (Array.isArray(latestUsageStats?.logs) ? latestUsageStats.logs : [])
          .filter(log => log && log.source === activeUsageSource);
        const totalPages = Math.max(1, Math.ceil(sourceLogs.length / USAGE_PAGE_SIZE));
        const currentPage = usageLogPageBySource.get(activeUsageSource) || 1;
        let nextPage = Number(button.dataset.page) || currentPage;
        if (button.dataset.pageAction === 'previous') nextPage = currentPage - 1;
        if (button.dataset.pageAction === 'next') nextPage = currentPage + 1;
        usageLogPageBySource.set(activeUsageSource, Math.max(1, Math.min(totalPages, nextPage)));
        renderCodexUsage(latestUsageStats || { logs: [] }, activeUsageSource);
      });
    
      async function refreshCodexUsage(options = {}) {
        const maxAgeMs = Number(options.maxAgeMs) || 0;
        if (!options.force && latestUsageStats && Date.now() - usageRefreshAt < maxAgeMs) {
          renderCodexUsage(latestUsageStats);
          return latestUsageStats;
        }
        try {
          const stats = await window.agyHubAPI.getTokenStats();
          usageRefreshAt = Date.now();
          renderCodexUsage(stats);
          return stats;
        } catch (_) {}
        return null;
      }
    
      function showResult(message, type = '') {
        resultBox.textContent = message;
        resultBox.className = `codex-gateway-result${type ? ` ${type}` : ''}`;
      }
    
      function settings() {
        return {
          profileId: 'codex-antigravity',
          activateCodexProfile: 'antigravity',
          accountId: account.value,
          model: model.value,
          modelControl: modelControl?.value || 'gateway',
          port: Number(port.value),
          autoResolvedModel: model.dataset.autoResolvedModel || '',
          claudeModel: claudeDesktopModel?.value || 'claude-sonnet-4-6'
        };
      }
    
      function claudeSettings() {
        return {
          accountId: claudeDesktopAccount?.value || account.value,
          port: Number(claudeGatewayPort?.value || port.value || 8046),
          claudeModel: claudeDesktopModel?.value || 'claude-sonnet-4-6'
        };
      }
    
      function renderStatus(status) {
        stateBox.classList.toggle('running', Boolean(status.running));
        stateTitle.textContent = status.running ? 'Codex 本地服务已运行' : 'Codex 本地服务已停止';
        stateDetail.textContent = status.running
          ? `${status.host}:${status.port} · Responses API`
          : `端口 ${status.port} 等待启动`;
        baseUrl.textContent = status.baseUrl;
        port.value = String(status.port);
        apiKey.value = status.apiKey;
        if (startButton) {
          startButton.textContent = status.running ? '服务已启动' : '启动服务';
          startButton.disabled = Boolean(status.running);
          startButton.classList.toggle('is-complete', Boolean(status.running));
        }
        const antigravityActive = status.mode !== 'custom';
        if (startButton && status.running && !antigravityActive) {
          startButton.textContent = '切换到 Antigravity';
          startButton.disabled = false;
          startButton.classList.remove('is-complete');
        }
        if (stopButton) stopButton.disabled = !status.running;
        const codexProfile = status.profiles?.codexAntigravity || {};
        if (modelControl) modelControl.value = (codexProfile.modelControl || status.codexAntigravityModelControl) === 'client' ? 'client' : 'gateway';
        if (claudeDesktopModel && [...claudeDesktopModel.options].some(option => option.value === status.claudeModel)) {
          claudeDesktopModel.value = status.claudeModel;
        }
        const fallbackAgyModels = [
          'agy-auto',
          'gemini-3.8-flash-high',
          'gemini-3.8-flash-medium',
          'gemini-3.8-flash-low',
          'gemini-3.7-flash-high',
          'gemini-3.7-flash-medium',
          'gemini-3.7-flash-low',
          'gemini-3.6-flash-high',
          'gemini-3.6-flash-medium',
          'gemini-3.6-flash-low',
          'gemini-3.1-pro-high',
          'gemini-3.1-pro-low',
          'claude-opus-4-6-thinking',
          'claude-sonnet-4-6'
        ];
        const fallbackGroup = id => id === 'agy-auto'
          ? '自动路由'
          : id.startsWith('gemini-') ? 'Gemini'
            : id.startsWith('claude-') ? 'Claude'
              : id.startsWith('gpt-oss-') ? 'GPT-OSS' : '其他模型';
        const fallbackModels = Array.isArray(status.antigravityModels) && status.antigravityModels.length
          ? status.antigravityModels
          : fallbackAgyModels;
        const agyModelEntries = Array.isArray(status.antigravityModelEntries) && status.antigravityModelEntries.length
          ? status.antigravityModelEntries
          : fallbackModels.map(id => ({ id, label: id, group: fallbackGroup(id) }));
        const agyModels = agyModelEntries.map(entry => entry.id);
        const selectedModel = codexProfile.model || status.codexAntigravityModel || status.model;
        const selected = agyModels.includes(selectedModel) ? selectedModel : (model.value || 'gemini-3.1-pro-high');
        const groupedModels = new Map();
        for (const entry of agyModelEntries) {
          const group = entry.group || fallbackGroup(entry.id);
          if (!groupedModels.has(group)) groupedModels.set(group, []);
          groupedModels.get(group).push(entry);
        }
        const modelGroups = [];
        for (const [group, entries] of groupedModels) {
          const optgroup = document.createElement('optgroup');
          optgroup.label = group;
          for (const entry of entries) {
            const option = document.createElement('option');
            option.value = entry.id;
            option.textContent = entry.label || entry.id;
            option.selected = entry.id === selected;
            optgroup.appendChild(option);
          }
          modelGroups.push(optgroup);
        }
        model.replaceChildren(...modelGroups);
        renderSelectedAccount();
      }
    
      function selectedAccountLabel() {
        return account.options[account.selectedIndex]?.textContent || '未选择账号';
      }
    
      function renderSelectedAccount(extra = '') {
        if (!accountName) return;
        const label = selectedAccountLabel();
        accountName.textContent = `${label}${extra ? `，${extra}` : ''}`;
      }
    
      function formatQuotaReset(value) {
        if (!value) return '暂无重置时间';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '暂无重置时间';
        return `重置 ${date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
      }
    
      function renderQuotaItemIn(targetGrid, key, value, reset) {
        const item = targetGrid?.querySelector(`[data-quota="${key}"]`);
        if (!item) return;
        const percent = Math.max(0, Math.min(100, Number.parseInt(value, 10) || 0));
        item.querySelector('strong').textContent = `${percent}%`;
        item.querySelector('i').style.width = `${percent}%`;
        item.querySelector('small').textContent = formatQuotaReset(reset);
        item.classList.toggle('warning', percent > 0 && percent <= 25);
        item.classList.toggle('empty', percent === 0);
      }
    
      function renderQuotaItem(key, value, reset) {
        renderQuotaItemIn(quotaGrid, key, value, reset);
      }
    
      function renderQuotaErrorIn(targetGrid, message) {
        for (const item of targetGrid?.querySelectorAll('.codex-gateway-quota-item') || []) {
          item.querySelector('strong').textContent = '--';
          item.querySelector('i').style.width = '0%';
          item.querySelector('small').textContent = message;
          item.classList.remove('warning', 'empty');
        }
      }
    
      function renderQuotaError(message) {
        renderQuotaErrorIn(quotaGrid, message);
      }
    
      let quotaRequestId = 0;
      async function refreshSelectedQuota(options = {}) {
        const selectedId = account.value;
        if (!selectedId) {
          renderQuotaError('没有可用账号');
          return null;
        }
        const requestId = ++quotaRequestId;
        quotaGrid?.classList.add('loading');
        refreshQuotaButton.disabled = true;
        if (options.showResult) showResult('正在查询所选账号实时额度...');
        try {
          const response = await window.agyHubAPI.fetchAccountQuota(selectedId);
          if (requestId !== quotaRequestId) return null;
          if (!response || response.success === false) throw new Error(response?.error || '额度查询失败');
          const quota = response.quota || {};
          renderQuotaItem('gemini5h', quota.gemini5h, quota.gemini5hReset);
          renderQuotaItem('geminiWeekly', quota.geminiWeekly, quota.geminiWeeklyReset);
          renderQuotaItem('claude5h', quota.claude5h, quota.claude5hReset);
          renderQuotaItem('claudeWeekly', quota.claudeWeekly, quota.claudeWeeklyReset);
          const geminiScore = Math.min(Number.parseInt(quota.gemini5h, 10) || 0, Number.parseInt(quota.geminiWeekly, 10) || 0);
          const claudeScore = Math.min(Number.parseInt(quota.claude5h, 10) || 0, Number.parseInt(quota.claudeWeekly, 10) || 0);
          const modelOptions = [...model.options].map(option => option.value).filter(Boolean);
          const preferredGemini = modelOptions.find(value => /^gemini-.*-high$/i.test(value))
            || modelOptions.find(value => value.startsWith('gemini-'))
            || 'gemini-3.1-pro-high';
          const preferredClaude = modelOptions.find(value => value.startsWith('claude-sonnet-'))
            || modelOptions.find(value => value.startsWith('claude-'))
            || 'claude-sonnet-4-6';
          const resolvedModel = claudeScore > geminiScore ? preferredClaude : preferredGemini;
          model.dataset.autoResolvedModel = resolvedModel;
          if (model.value === 'agy-auto') {
            renderSelectedAccount(`自动路由：${resolvedModel}`);
          }
          if (options.showResult) showResult(`已刷新 ${selectedAccountLabel()} 的实时额度`, 'success');
          return response;
        } catch (error) {
          if (requestId !== quotaRequestId) return null;
          renderQuotaError('读取失败');
          if (options.showResult) showResult(`额度查询失败：${error.message}`, 'error');
          return null;
        } finally {
          if (requestId === quotaRequestId) {
            quotaGrid?.classList.remove('loading');
            refreshQuotaButton.disabled = false;
          }
        }
      }
    
      let claudeQuotaRequestId = 0;
      let claudeQuotaRefreshAt = 0;
      async function refreshClaudeSelectedQuota(options = {}) {
        const selectedId = claudeDesktopAccount?.value;
        if (!selectedId) {
          renderQuotaErrorIn(claudeGatewayQuotaGrid, '没有可用账号');
          if (claudeGatewayAccountName) claudeGatewayAccountName.textContent = '没有可用账号';
          return null;
        }
        if (!options.force && claudeQuotaRefreshAt && Date.now() - claudeQuotaRefreshAt < (Number(options.maxAgeMs) || 0)) {
          return null;
        }
        const requestId = ++claudeQuotaRequestId;
        const selectedLabel = claudeDesktopAccount.options[claudeDesktopAccount.selectedIndex]?.textContent || selectedId;
        if (claudeGatewayAccountName) claudeGatewayAccountName.textContent = selectedLabel;
        claudeGatewayQuotaGrid?.classList.add('loading');
        if (claudeGatewayRefreshQuotaButton) claudeGatewayRefreshQuotaButton.disabled = true;
        if (options.showResult) showClaudeDesktopResult('正在查询所选账号实时额度...');
        try {
          const response = await window.agyHubAPI.fetchAccountQuota(selectedId);
          if (requestId !== claudeQuotaRequestId) return null;
          if (!response || response.success === false) throw new Error(response?.error || '额度查询失败');
          const quota = response.quota || {};
          renderQuotaItemIn(claudeGatewayQuotaGrid, 'gemini5h', quota.gemini5h, quota.gemini5hReset);
          renderQuotaItemIn(claudeGatewayQuotaGrid, 'geminiWeekly', quota.geminiWeekly, quota.geminiWeeklyReset);
          renderQuotaItemIn(claudeGatewayQuotaGrid, 'claude5h', quota.claude5h, quota.claude5hReset);
          renderQuotaItemIn(claudeGatewayQuotaGrid, 'claudeWeekly', quota.claudeWeekly, quota.claudeWeeklyReset);
          claudeQuotaRefreshAt = Date.now();
          if (options.showResult) showClaudeDesktopResult(`已刷新 ${selectedLabel} 的实时额度`, 'success');
          return response;
        } catch (error) {
          if (requestId !== claudeQuotaRequestId) return null;
          renderQuotaErrorIn(claudeGatewayQuotaGrid, '读取失败');
          if (options.showResult) showClaudeDesktopResult(`额度查询失败：${error.message}`, 'error');
          return null;
        } finally {
          if (requestId === claudeQuotaRequestId) {
            claudeGatewayQuotaGrid?.classList.remove('loading');
            if (claudeGatewayRefreshQuotaButton) claudeGatewayRefreshQuotaButton.disabled = false;
          }
        }
      }
    
      async function loadAccountsInto(target, selectedId) {
        if (!target) return [];
        const response = await window.agyHubAPI.listLocalAccounts();
        if (!response || !response.success) throw new Error(response?.error || '本地账号读取失败');
        const accounts = Array.isArray(response.accounts) ? response.accounts : [];
        target.replaceChildren(...accounts.map(item => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = `${item.email}${item.current ? '（当前）' : ''}`;
          option.selected = item.id === selectedId || (!selectedId && item.current);
          return option;
        }));
        if (!accounts.length) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = '没有可用账号';
          target.appendChild(option);
        }
        return accounts;
      }
    
      async function loadAccounts(selectedId) {
        const accounts = await loadAccountsInto(account, selectedId);
        renderSelectedAccount();
        return accounts;
      }
    
      async function refresh(options = {}) {
        const maxAgeMs = Number(options.maxAgeMs) || 0;
        if (!options.force && gatewayRefreshAt && Date.now() - gatewayRefreshAt < maxAgeMs) return null;
        if (gatewayRefreshPromise) return gatewayRefreshPromise;
    
        gatewayRefreshPromise = (async () => {
          try {
            const status = await window.agyHubAPI.getCodexGatewayStatus();
            renderStatus(status);
            const codexAccountId = status.profiles?.codexAntigravity?.accountId || status.codexAntigravityAccountId || status.accountId;
            await loadAccounts(codexAccountId);
            if (codexAccountId && [...account.options].some(option => option.value === codexAccountId)) {
              account.value = codexAccountId;
            }
            renderSelectedAccount();
            gatewayRefreshAt = Date.now();
            if (options.includeQuota) {
              await refreshSelectedQuota();
              const refreshedStatus = await window.agyHubAPI.getCodexGatewayStatus();
              renderStatus(refreshedStatus);
            }
            if (options.includeClaude) await refreshClaudeDesktopStatus({ force: true });
            return status;
          } catch (error) {
            showResult(`状态读取失败：${error.message}`, 'error');
            return null;
          } finally {
            gatewayRefreshPromise = null;
          }
        })();
        return gatewayRefreshPromise;
      }
    
      async function run(button, pendingText, action, successText, completedText = '') {
        const original = button.textContent;
        let completed = false;
        button.disabled = true;
        button.textContent = pendingText;
        button.classList.add('is-busy');
        button.classList.remove('is-complete');
        button.setAttribute('aria-busy', 'true');
        showResult(pendingText);
        try {
          const response = await action();
          if (!response || response.success === false) {
            if (response?.report) {
              showResult(formatTieredReport(response), tieredReportType(response));
              const failure = new Error(response?.error || response.report.summary || '操作失败');
              failure.reportShown = true;
              throw failure;
            }
            throw new Error(response?.error || '操作失败');
          }
          if (response.status) renderStatus(response.status);
          const message = typeof successText === 'function' ? successText(response) : successText;
          showResult(message, 'success');
          completed = true;
          if (completedText) {
            button.textContent = completedText;
            button.classList.add('is-complete');
          }
          return response;
        } catch (error) {
          if (!error.reportShown) showResult(error.message, 'error');
          return null;
        } finally {
          button.classList.remove('is-busy');
          button.removeAttribute('aria-busy');
          if (!completed || !completedText) button.textContent = original;
          if (button !== startButton || !completed) button.disabled = false;
        }
      }
    
      const startButton = document.getElementById('btn-codex-gateway-start');
      const stopButton = document.getElementById('btn-codex-gateway-stop');
      const testButton = document.getElementById('btn-codex-gateway-test');
      const connectButton = document.getElementById('btn-codex-gateway-connect');
      const restoreButton = document.getElementById('btn-codex-gateway-restore');
      const claudeGatewayState = document.getElementById('claude-gateway-state');
      const claudeGatewayStateTitle = document.getElementById('claude-gateway-state-title');
      const claudeGatewayStateDetail = document.getElementById('claude-gateway-state-detail');
      const claudeGatewayBaseUrl = document.getElementById('claude-gateway-base-url');
      const claudeDesktopAccount = document.getElementById('claude-desktop-account');
      const claudeDesktopModel = document.getElementById('claude-desktop-model');
      const claudeGatewayPort = document.getElementById('claude-gateway-port');
      const claudeDesktopApiKey = document.getElementById('claude-desktop-api-key');
      const claudeGatewayAccountName = document.getElementById('claude-gateway-account-name');
      const claudeGatewayQuotaGrid = document.getElementById('claude-gateway-quota-grid');
      const claudeGatewayRefreshQuotaButton = document.getElementById('btn-claude-gateway-refresh-quota');
      const claudeGatewayStartButton = document.getElementById('btn-claude-gateway-start');
      const claudeGatewayStopButton = document.getElementById('btn-claude-gateway-stop');
      const claudeDesktopStatus = document.getElementById('claude-desktop-status');
      const claudeDesktopResult = document.getElementById('claude-desktop-result');
      const claudeDesktopTestButton = document.getElementById('btn-claude-desktop-test');
      const claudeDesktopConnectButton = document.getElementById('btn-claude-desktop-connect');
      const claudeDesktopRestoreButton = document.getElementById('btn-claude-desktop-restore');
      const providerNameInput = document.getElementById('codex-provider-name');
      const providerProtocol = document.getElementById('codex-provider-protocol');
      const providerUrl = document.getElementById('codex-provider-url');
      const providerKey = document.getElementById('codex-provider-key');
      const providerAuthMode = document.getElementById('codex-provider-auth-mode');
      const providerAuthQuery = document.getElementById('codex-provider-auth-query');
      const providerAuthQueryField = document.getElementById('codex-provider-auth-query-field');
      const providerCustomHeaders = document.getElementById('codex-provider-custom-headers');
      const providerCustomHeadersField = document.getElementById('codex-provider-custom-headers-field');
      const providerFallbackUrls = document.getElementById('codex-provider-fallback-urls');
      const providerModelMode = document.getElementById('codex-provider-model-mode');
      const providerNativeModel = document.getElementById('codex-provider-native-model');
      const providerNativeModelField = document.getElementById('codex-provider-native-model-field');
      const providerCustomModelField = document.getElementById('codex-provider-custom-model-field');
      const providerCustomModels = document.getElementById('codex-provider-custom-models');
      const providerResult = document.getElementById('codex-provider-result');
      const testProviderButton = document.getElementById('btn-test-custom-provider');
      const discoverProviderModelsButton = document.getElementById('btn-discover-provider-models');
      const connectProviderButton = document.getElementById('btn-connect-custom-provider');
      const addProviderButton = document.getElementById('btn-add-custom-provider');
      const cancelProviderButton = document.getElementById('btn-cancel-custom-provider');
      const providerManager = document.getElementById('codex-provider-profile-manager');
      const providerEditor = document.getElementById('codex-provider-editor');
      const providerEditorTitle = document.getElementById('codex-provider-editor-title');
      const providerGrid = document.getElementById('codex-provider-profile-grid');
      const providerEmpty = document.getElementById('codex-provider-profile-empty');
      const diagnosticButton = document.getElementById('btn-copy-gateway-diagnostics');
      const snapshotButton = document.getElementById('btn-gateway-snapshot');
      const timelineButton = document.getElementById('btn-gateway-timeline');
      const insightPanel = document.getElementById('gateway-insight-panel');
      const insightTitle = document.getElementById('gateway-insight-title');
      const insightContent = document.getElementById('gateway-insight-content');
      let testedProviderFingerprint = '';
      let editingProviderId = '';
      let activeProviderId = '';
      const providerOperationResults = new Map();

      const closeInsightPanel = () => { if (insightPanel) insightPanel.hidden = true; };
      const formatInsightTime = value => {
        if (!value) return '--';
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('zh-CN', { hour12: false });
      };
      const gatewayEventLabels = {
        'request.started': '请求开始',
        'request.completed': '请求完成',
        'request.failed': '请求失败',
        'custom.failover': '已切换备用地址',
        'custom.upstream_retry': '正在重试上游',
        request: '请求记录',
        success: '请求成功',
        error: '请求失败'
      };
      document.getElementById('btn-close-gateway-insight')?.addEventListener('click', closeInsightPanel);
      document.addEventListener('keydown', event => { if (event.key === 'Escape') closeInsightPanel(); });
      document.addEventListener('pointerdown', event => {
        if (!insightPanel || insightPanel.hidden || insightPanel.contains(event.target)) return;
        if (snapshotButton?.contains(event.target) || timelineButton?.contains(event.target)) return;
        closeInsightPanel();
      });
      snapshotButton?.addEventListener('click', async () => {
        snapshotButton.disabled = true;
        try {
          const result = await window.agyHubAPI.createGatewayConfigSnapshot('手动快照');
          if (!result?.success) throw new Error(result?.error || '创建失败');
          const listed = await window.agyHubAPI.listGatewayConfigSnapshots();
          insightTitle.textContent = '配置快照';
          const notice = document.createElement('div');
          notice.className = 'gateway-insight-notice';
          notice.textContent = `已创建 ${formatInsightTime(result.snapshot.createdAt)}，包含 ${result.snapshot.fileCount} 个配置文件。`;
          const rows = (listed?.snapshots || []).map(snapshot => {
            const row = document.createElement('div'); row.className = 'gateway-snapshot-row';
            const time = document.createElement('span'); time.textContent = formatInsightTime(snapshot.createdAt);
            const detail = document.createElement('span'); detail.textContent = `${snapshot.label || '配置快照'} · ${snapshot.fileCount} 个文件`;
            const restore = document.createElement('button'); restore.className = 'btn btn-secondary'; restore.type = 'button'; restore.textContent = '恢复';
            restore.addEventListener('click', async () => {
              restore.disabled = true;
              const restored = await window.agyHubAPI.restoreGatewayConfigSnapshot(snapshot.id);
              restore.textContent = restored?.success ? '已恢复，重启生效' : '恢复失败';
              if (!restored?.success) restore.title = restored?.error || '恢复失败';
            });
            row.append(time, detail, restore); return row;
          });
          insightContent.replaceChildren(notice, ...rows);
          insightPanel.hidden = false;
        } catch (error) { showResult(`配置快照失败：${error.message}`, 'error'); }
        finally { snapshotButton.disabled = false; }
      });
      timelineButton?.addEventListener('click', async () => {
        timelineButton.disabled = true;
        try {
          const result = await window.agyHubAPI.getGatewayDiagnostics();
          if (!result?.success) throw new Error(result?.error || '读取失败');
          const logs = Array.isArray(result.report?.gateway?.recentLogs) ? result.report.gateway.recentLogs.slice(-30).reverse() : [];
          insightTitle.textContent = '最近请求时间线（已脱敏）';
          insightContent.replaceChildren(...logs.map(log => {
            const row = document.createElement('div');
            row.className = 'gateway-timeline-row';
            const time = document.createElement('span'); time.textContent = formatInsightTime(log.time || log.timestamp || log.completedAt);
            const rawEvent = log.event || log.status || 'request';
            const event = document.createElement('strong'); event.textContent = gatewayEventLabels[rawEvent] || rawEvent;
            const details = [log.model, log.durationMs != null ? `${log.durationMs} ms` : '', log.message, log.error].filter(Boolean);
            const detail = document.createElement('span'); detail.textContent = details.join(' · ') || (log.requestId ? `请求编号 ${log.requestId}` : '暂无更多信息');
            row.append(time, event, detail); return row;
          }));
          if (!logs.length) insightContent.textContent = '暂时没有可显示的请求记录。';
          insightPanel.hidden = false;
        } catch (error) { showResult(`时间线读取失败：${error.message}`, 'error'); }
        finally { timelineButton.disabled = false; }
      });
    
      function showClaudeDesktopResult(message, type = '') {
        if (!claudeDesktopResult) return;
        claudeDesktopResult.textContent = message;
        claudeDesktopResult.className = `claude-desktop-result${type ? ` ${type}` : ''}`;
      }
    
      function renderClaudeDesktopStatus(status) {
        const actual = status?.actualBaseUrl || '';
        const gateway = status?.gateway || status?.status || {};
        const running = Boolean(gateway.running);
        claudeGatewayState?.classList.toggle('running', running);
        if (claudeGatewayBaseUrl) claudeGatewayBaseUrl.textContent = gateway.claudeBaseUrl || 'http://127.0.0.1:8046';
        if (claudeGatewayPort) claudeGatewayPort.value = String(gateway.port || 8046);
        if (claudeDesktopApiKey) claudeDesktopApiKey.value = gateway.apiKey || '';
        if (claudeGatewayStartButton) {
          claudeGatewayStartButton.textContent = running ? '服务已启动' : '启动服务';
          claudeGatewayStartButton.disabled = running;
          claudeGatewayStartButton.classList.toggle('is-complete', running);
        }
        if (claudeGatewayStopButton) claudeGatewayStopButton.disabled = !running;
        if (claudeDesktopModel && [...claudeDesktopModel.options].some(option => option.value === gateway.claudeModel)) {
          claudeDesktopModel.value = gateway.claudeModel;
        }
        if (claudeDesktopStatus) claudeDesktopStatus.className = 'claude-desktop-status';
        if (status?.connected) {
          if (claudeGatewayStateTitle) claudeGatewayStateTitle.textContent = 'Claude Code 已接入';
          if (claudeGatewayStateDetail) claudeGatewayStateDetail.textContent = status.modelCatalogReady
            ? `${gateway.host || '127.0.0.1'}:${gateway.port || 8046} · Anthropic Messages API`
            : `${gateway.host || '127.0.0.1'}:${gateway.port || 8046} · 模型列表待更新`;
          if (claudeDesktopStatus) {
            claudeDesktopStatus.textContent = status.modelCatalogReady ? '已接入' : '模型列表待更新';
            claudeDesktopStatus.classList.add(status.modelCatalogReady ? 'connected' : 'warning');
          }
          claudeDesktopConnectButton.textContent = status.modelCatalogReady
            ? '已接入 Claude Code'
            : '更新 Claude 模型列表';
          claudeDesktopConnectButton.classList.toggle('is-complete', Boolean(status.modelCatalogReady));
          claudeDesktopConnectButton.disabled = Boolean(status.modelCatalogReady);
          return;
        }
        if (claudeGatewayStateTitle) claudeGatewayStateTitle.textContent = running ? 'Claude 本地服务已运行' : 'Claude 本地服务已停止';
        if (claudeGatewayStateDetail) claudeGatewayStateDetail.textContent = running
          ? `${gateway.host || '127.0.0.1'}:${gateway.port || 8046} · Anthropic Messages API`
          : `端口 ${gateway.port || 8046} 等待启动`;
        claudeDesktopConnectButton.textContent = '接入 Claude Code';
        claudeDesktopConnectButton.classList.remove('is-complete');
        claudeDesktopConnectButton.disabled = false;
        if (status?.active && actual) {
          if (claudeDesktopStatus) {
            claudeDesktopStatus.textContent = '8046 已配置，等待 Claude 就绪';
            claudeDesktopStatus.classList.add('warning');
          }
        } else if (actual) {
          if (claudeDesktopStatus) {
            claudeDesktopStatus.textContent = `实际仍指向 ${new URL(actual).port || actual}`;
            claudeDesktopStatus.classList.add('warning');
          }
        } else if (status?.configured) {
          if (claudeDesktopStatus) {
            claudeDesktopStatus.textContent = '配置未激活';
            claudeDesktopStatus.classList.add('warning');
          }
        } else {
          if (claudeDesktopStatus) claudeDesktopStatus.textContent = '未接入';
        }
      }
    
      async function refreshClaudeDesktopStatus(options = {}) {
        const maxAgeMs = Number(options.maxAgeMs) || 0;
        if (!options.force && claudeStatusCache && Date.now() - claudeStatusRefreshAt < maxAgeMs) {
          renderClaudeDesktopStatus(claudeStatusCache);
          return claudeStatusCache;
        }
        try {
          const response = await window.agyHubAPI.getClaudeDesktopStatus();
          if (!response || response.success === false) throw new Error(response?.error || '状态读取失败');
          claudeStatusCache = response;
          claudeStatusRefreshAt = Date.now();
          const gateway = response.gateway || {};
          const claudeAccountId = gateway.profiles?.claudeAntigravity?.accountId || gateway.claudeAccountId || '';
          await loadAccountsInto(claudeDesktopAccount, claudeAccountId);
          if (claudeAccountId && [...(claudeDesktopAccount?.options || [])].some(option => option.value === claudeAccountId)) {
            claudeDesktopAccount.value = claudeAccountId;
          }
          if (claudeGatewayAccountName) {
            claudeGatewayAccountName.textContent = claudeDesktopAccount?.options[claudeDesktopAccount.selectedIndex]?.textContent || '没有可用账号';
          }
          renderClaudeDesktopStatus(response);
          scheduleAfterPaint(() => refreshClaudeSelectedQuota({ maxAgeMs: 30000 }));
          if (options.showResult) {
            const detail = response.connected
              ? `Claude Desktop 已真实接入\n上游地址：${response.actualBaseUrl}\nClaude 内部中转：${response.runtimeBaseUrl || '已就绪'}\n模型列表：${response.modelCatalogReady ? '已包含全部 AGY 模型' : '仍是旧版，点击“更新 Claude 模型列表”升级'}\n真实配置：${response.registryPath}`
              : response.active
                ? `8046 已写入 Claude 的真实托管配置，但 Claude 内部网关尚未就绪。\n上游地址：${response.actualBaseUrl}\n内部中转：${response.runtimeBaseUrl || '尚未创建'}\n真实配置：${response.registryPath}`
              : response.actualBaseUrl
                ? `Claude Desktop 当前仍指向：${response.actualBaseUrl}\n点击“接入 Claude Code”可修复。`
                : 'Claude Desktop 尚未写入 AGY Hub 配置。';
            showClaudeDesktopResult(detail, response.connected ? 'success' : '');
          }
          return response;
        } catch (error) {
          if (claudeGatewayStateTitle) claudeGatewayStateTitle.textContent = 'Claude 状态检测失败';
          if (claudeGatewayStateDetail) claudeGatewayStateDetail.textContent = error.message;
          if (claudeDesktopStatus) {
            claudeDesktopStatus.textContent = '检测失败';
            claudeDesktopStatus.className = 'claude-desktop-status error';
          }
          if (options.showResult) showClaudeDesktopResult(error.message, 'error');
          return null;
        }
      }
    
      async function runClaudeDesktopAction(button, pendingText, action, successText) {
        const original = button.textContent;
        button.disabled = true;
        button.textContent = pendingText;
        button.classList.add('is-busy');
        showClaudeDesktopResult(pendingText);
        try {
          const response = await action();
          if (!response || response.success === false) {
            if (response?.report) {
              showClaudeDesktopResult(formatTieredReport(response), tieredReportType(response));
              const failure = new Error(response?.error || response.report.summary || '操作失败');
              failure.reportShown = true;
              throw failure;
            }
            throw new Error(response?.error || '操作失败');
          }
          const successResult = typeof successText === 'function' ? successText(response) : successText;
          if (successResult && typeof successResult === 'object') {
            showClaudeDesktopResult(successResult.message, successResult.type || 'success');
          } else {
            showClaudeDesktopResult(successResult, 'success');
          }
          await refreshClaudeDesktopStatus();
          return response;
        } catch (error) {
          if (!error.reportShown) showClaudeDesktopResult(error.message, 'error');
          return null;
        } finally {
          button.classList.remove('is-busy');
          if (!button.classList.contains('is-complete')) {
            button.textContent = original;
            button.disabled = false;
          }
        }
      }
    
      function customProviderSettings() {
        const modelMode = providerModelMode.value;
        return {
          id: editingProviderId,
          providerName: providerNameInput.value.trim(),
          protocol: providerProtocol.value,
          baseUrl: providerUrl.value.trim(),
          apiKey: providerKey.value.trim(),
          authMode: providerAuthMode.value,
          authQueryName: providerAuthQuery.value.trim(),
          customHeaders: providerCustomHeaders.value.trim(),
          fallbackBaseUrls: providerFallbackUrls.value.trim(),
          modelMode,
          model: modelMode === 'openai' ? providerNativeModel.value : '',
          customModels: providerCustomModels.value.trim()
        };
      }
    
      function providerFingerprint() {
        return JSON.stringify(customProviderSettings());
      }
    
      function showProviderResult(message, type = '') {
        providerResult.textContent = message;
        providerResult.className = `provider-result${type ? ` ${type}` : ''}`;
      }
    
      function showProviderManager() {
        providerManager.hidden = false;
        providerEditor.hidden = true;
      }
    
      function showProviderEditor(profile = null) {
        editingProviderId = profile?.id || '';
        providerEditorTitle.textContent = profile ? `编辑 ${profile.providerName}` : '添加自定义 Provider';
        providerNameInput.value = profile?.providerName || 'Sub2API';
        providerProtocol.value = profile?.protocol || 'responses';
        providerUrl.value = profile?.baseUrl || 'http://localhost:8080/v1';
        providerKey.value = '';
        providerKey.placeholder = profile?.keySaved ? `已安全保存 ····${profile.keyTail || ''}（留空保持不变）` : '输入 API Key';
        providerAuthMode.value = profile?.authMode || 'bearer';
        providerAuthQuery.value = profile?.authQueryName || 'key';
        providerCustomHeaders.value = profile?.customHeaders ? JSON.stringify(profile.customHeaders, null, 2) : '';
        providerFallbackUrls.value = Array.isArray(profile?.fallbackBaseUrls) ? profile.fallbackBaseUrls.join('\n') : '';
        providerModelMode.value = profile?.modelMode || 'openai';
        providerNativeModel.value = profile?.model || 'gpt-5.6';
        providerCustomModels.value = profile?.modelMode === 'custom' ? (profile.models || []).join('\n') : '';
        providerKey.type = 'password';
        testedProviderFingerprint = '';
        syncProviderModelMode(false);
        syncProviderAuthMode(false);
        showProviderResult(profile ? '修改后请重新测试，再保存配置。' : '填写配置后先测试连接。');
        providerManager.hidden = true;
        providerEditor.hidden = false;
      }
    
      function profileCard(profile) {
        const card = document.createElement('article');
        card.className = `provider-profile-card${profile.id === activeProviderId ? ' active' : ''}`;
        const modelCount = Array.isArray(profile.models) ? profile.models.length : 0;
        const keyTail = profile.keySaved ? `Key ····${profile.keyTail || ''}` : '未保存 Key';
        const operationResult = providerOperationResults.get(profile.id);
        const healthText = profile.health?.status === 'healthy' ? `健康 · ${profile.health.levelReached || 0}/3` : profile.health?.status === 'unhealthy' ? '需要检查' : '未检测';
        card.innerHTML = `
          <div class="provider-profile-card-head">
            <h4>${escapeHTML(profile.providerName || '未命名 Provider')}</h4>
            <span class="provider-profile-card-badge">${profile.id === activeProviderId ? '当前接入' : escapeHTML(healthText)}</span>
          </div>
          <p class="provider-profile-url" title="${escapeHTML(profile.baseUrl || '')}">${escapeHTML(profile.baseUrl || '')}</p>
          <div class="provider-profile-meta"><span>${escapeHTML(({ responses: 'Responses', 'chat-completions': 'Chat', 'anthropic-messages': 'Anthropic', 'gemini-native': 'Gemini' })[profile.protocol] || 'Provider')}</span><span>${escapeHTML(profile.model || '--')}</span><span>${modelCount} 个模型</span><span>${escapeHTML(keyTail)}</span></div>
          <div class="provider-profile-actions">
            <button class="btn btn-primary${profile.id === activeProviderId ? ' is-complete' : ''}" type="button" data-action="connect">${profile.id === activeProviderId ? '已接入 Codex' : '接入 Codex'}</button>
            <button class="btn btn-secondary" type="button" data-action="test">测试</button>
            <button class="btn btn-secondary" type="button" data-action="edit">编辑</button>
            <button class="btn btn-secondary" type="button" data-action="delete">删除</button>
          </div>
          <div class="provider-profile-result${operationResult ? ` ${operationResult.type}` : ''}" role="status" aria-live="polite"${operationResult ? '' : ' hidden'}>${operationResult ? escapeHTML(operationResult.message) : ''}</div>`;
        card.addEventListener('click', async event => {
          const action = event.target.closest('button')?.dataset.action;
          if (!action) return;
          const settings = {
            ...profile,
            customModels: Array.isArray(profile.models) ? profile.models.join(',') : ''
          };
          if (action === 'edit') return showProviderEditor(profile);
          if (action === 'delete') {
            const response = await window.agyHubAPI.deleteCustomCodexProvider(profile.id);
            if (!response || response.success === false) return showProviderResult(response?.error || '删除失败', 'error');
            if (activeProviderId === profile.id) activeProviderId = '';
            return loadProviderProfiles();
          }
          const button = event.target.closest('button');
          const original = button.textContent;
          const result = card.querySelector('.provider-profile-result');
          const report = (message, type = '') => {
            providerOperationResults.set(profile.id, { message, type });
            result.textContent = message;
            result.className = `provider-profile-result${type ? ` ${type}` : ''}`;
            result.hidden = false;
          };
          button.disabled = true;
          button.classList.add('is-busy');
          button.setAttribute('aria-busy', 'true');
          button.textContent = action === 'test' ? '测试中...' : '接入中...';
          report(action === 'test' ? '正在验证 Responses API 与模型响应…' : '正在启动兼容网关并写入 Codex 配置…');
          try {
            const response = action === 'test'
              ? await window.agyHubAPI.testCustomCodexProvider(settings)
              : await window.agyHubAPI.connectCustomCodexProvider(settings);
            if (!response || response.success === false) {
              if (action === 'test' && response?.report) {
                report(formatTieredReport(response), tieredReportType(response));
                const failure = new Error(response?.error || response.report.summary || '操作失败');
                failure.reportShown = true;
                throw failure;
              }
              throw new Error(response?.error || '操作失败');
            }
            if (action === 'connect') {
              activeProviderId = profile.id;
              await loadProviderProfiles();
              const lifecycleMessage = response.codexApp?.success
                ? response.codexApp.action === 'restarted'
                  ? 'Codex 已自动重启。'
                  : 'Codex 已自动启动。'
                : `配置已保存，但自动启动 Codex 失败：${response.codexApp?.error || '未知错误'}`;
              report(`接入成功 · ${profile.providerName}\n长对话兼容保护已开启。${lifecycleMessage}`, response.codexApp?.success ? 'success' : 'warning');
              await loadProviderProfiles();
            } else {
              report(response.report
                ? formatTieredReport(response)
                : `测试成功 · ${response.model}\nResponses API 已返回有效响应。`, 'success');
              button.textContent = '测试成功';
              button.classList.add('is-complete');
            }
          } catch (error) {
            if (!error.reportShown) report(`${action === 'test' ? '测试' : '接入'}失败 · ${error.message}`, 'error');
          } finally {
            button.classList.remove('is-busy');
            button.removeAttribute('aria-busy');
            button.disabled = false;
            if (!button.classList.contains('is-complete')) button.textContent = original;
          }
        });
        return card;
      }
    
      async function loadProviderProfiles() {
        const response = await window.agyHubAPI.listCustomCodexProviders();
        const profiles = response?.success && Array.isArray(response.profiles) ? response.profiles : [];
        providerGrid.replaceChildren(...profiles.map(profileCard));
        providerEmpty.hidden = profiles.length > 0;
      }
    
      function syncProviderModelMode(markDirty = true) {
        const custom = providerModelMode.value === 'custom';
        providerNativeModelField.hidden = custom;
        providerCustomModelField.hidden = !custom;
        if (markDirty) {
          testedProviderFingerprint = '';
          showProviderResult('配置已更改，请重新测试连接');
        }
      }

      function syncProviderAuthMode(markDirty = true) {
        providerAuthQueryField.hidden = providerAuthMode.value !== 'query';
        providerCustomHeadersField.hidden = providerAuthMode.value !== 'custom';
        if (markDirty) {
          testedProviderFingerprint = '';
          showProviderResult('认证方式已更改，请重新测试连接');
        }
      }
    
      for (const input of [providerNameInput, providerProtocol, providerUrl, providerKey, providerAuthMode, providerAuthQuery, providerCustomHeaders, providerFallbackUrls, providerNativeModel, providerCustomModels]) {
        input?.addEventListener('input', () => { testedProviderFingerprint = ''; });
        input?.addEventListener('change', () => { testedProviderFingerprint = ''; });
      }
      providerModelMode?.addEventListener('change', syncProviderModelMode);
      providerAuthMode?.addEventListener('change', syncProviderAuthMode);
      discoverProviderModelsButton?.addEventListener('click', async () => {
        const original = discoverProviderModelsButton.textContent;
        discoverProviderModelsButton.disabled = true;
        discoverProviderModelsButton.textContent = '获取中...';
        try {
          const response = await window.agyHubAPI.discoverCustomCodexProviderModels(customProviderSettings());
          if (!response?.success) throw new Error(response?.error || '模型列表获取失败');
          if (!response.models?.length) throw new Error('Provider 返回了空模型列表');
          providerModelMode.value = 'custom';
          providerCustomModels.value = response.models.join('\n');
          syncProviderModelMode(false);
          showProviderResult(`已获取 ${response.models.length} 个模型，请选择或保留需要的模型后再测试。`, 'success');
        } catch (error) { showProviderResult(error.message, 'error'); }
        finally { discoverProviderModelsButton.disabled = false; discoverProviderModelsButton.textContent = original; }
      });
      document.getElementById('btn-toggle-provider-key')?.addEventListener('click', () => {
        providerKey.type = providerKey.type === 'password' ? 'text' : 'password';
      });
      addProviderButton?.addEventListener('click', () => showProviderEditor());
      cancelProviderButton?.addEventListener('click', showProviderManager);
    
      testProviderButton?.addEventListener('click', async () => {
        const original = testProviderButton.textContent;
        testProviderButton.disabled = true;
        testProviderButton.textContent = '正在测试...';
        showProviderResult('正在请求 Provider 的 /responses 接口...');
        try {
          const fingerprint = providerFingerprint();
          const response = await window.agyHubAPI.testCustomCodexProvider(customProviderSettings());
          if (!response || response.success === false) {
            if (response?.report) {
              showProviderResult(formatTieredReport(response), tieredReportType(response));
              const failure = new Error(response?.error || response.report.summary || '连接测试失败');
              failure.reportShown = true;
              throw failure;
            }
            throw new Error(response?.error || '连接测试失败');
          }
          testedProviderFingerprint = fingerprint;
          showProviderResult(response.report
            ? formatTieredReport(response)
            : `连接成功\nAPI：${response.baseUrl}/responses\n模型：${response.model}${response.matched ? '\n响应内容验证通过' : '\nProvider 已返回有效响应'}`,
          'success');
        } catch (error) {
          testedProviderFingerprint = '';
          if (!error.reportShown) showProviderResult(`连接失败：${error.message}`, 'error');
        } finally {
          testProviderButton.disabled = false;
          testProviderButton.textContent = original;
        }
      });
    
      connectProviderButton?.addEventListener('click', async () => {
        if (!testedProviderFingerprint || testedProviderFingerprint !== providerFingerprint()) {
          showProviderResult('请先使用当前配置完成连接测试，再保存。', 'error');
          return;
        }
        const original = connectProviderButton.textContent;
        connectProviderButton.disabled = true;
        connectProviderButton.textContent = '正在保存...';
        try {
          const response = await window.agyHubAPI.saveCustomCodexProvider(customProviderSettings());
          if (!response || response.success === false) throw new Error(response?.error || '保存失败');
          editingProviderId = response.profile.id;
          await loadProviderProfiles();
          showProviderManager();
        } catch (error) {
          showProviderResult(`保存失败：${error.message}`, 'error');
        } finally {
          connectProviderButton.disabled = false;
          connectProviderButton.textContent = original;
        }
      });
    
      account.addEventListener('change', async () => {
        const selectedId = account.value;
        if (!selectedId) return;
        account.disabled = true;
        renderSelectedAccount('已选择（未改变当前路由）');
        try {
          await refreshSelectedQuota();
          showResult(`已选择测试/接入账号\n${selectedAccountLabel()}\n只有点击“连接到 Codex”才会改变当前网关路由。`, 'success');
        } catch (error) {
          renderSelectedAccount('额度读取失败');
          showResult(`账号额度读取失败：${error.message}`, 'error');
        } finally {
          account.disabled = false;
        }
      });
    
      refreshQuotaButton.addEventListener('click', () => refreshSelectedQuota({ showResult: true }));
    
      model.addEventListener('change', async () => {
        if (modelControl) modelControl.value = 'gateway';
        showResult(`已选择测试/接入模型：${model.value}\n当前网关路由没有改变。`, 'success');
      });
    
      modelControl?.addEventListener('change', async () => {
        showResult(modelControl.value === 'client'
          ? '已选择“跟随客户端”；点击“连接到 Codex”后生效，当前路由未改变。'
          : `已选择“小助手强制 ${model.value}”；点击“连接到 Codex”后生效，当前路由未改变。`, 'success');
      });
    
      startButton.addEventListener('click', () => run(
        startButton, '正在启动...',
        () => window.agyHubAPI.startCodexGateway(settings()),
        response => `服务启动成功\nAPI：${response.status.baseUrl}\n模型：${response.status.model}`,
        '服务已启动'
      ));
      stopButton.addEventListener('click', () => run(
        stopButton, '正在停止...',
        () => window.agyHubAPI.stopCodexGateway(),
        '服务已停止'
      ));
      testButton.addEventListener('click', () => run(
        testButton, '正在执行三级测试...',
        () => window.agyHubAPI.testCodexGateway(settings()),
        response => response.report ? formatTieredReport(response) : response.message,
        '三级测试通过'
      ));
      connectButton.addEventListener('click', () => run(
        connectButton, '正在备份并写入 Codex...',
        () => window.agyHubAPI.connectCodexGateway(settings()),
        response => {
          const lifecycleMessage = response.codexApp?.success
            ? response.codexApp.action === 'restarted'
              ? 'Codex 已自动重启。'
              : 'Codex 已自动启动。'
            : `配置已写入，但自动启动 Codex 失败：${response.codexApp?.error || '未知错误'}`;
          return `Codex 配置已写入\nProvider：AGY Hub（兼容本地历史）\nAPI：${response.status.baseUrl}\n备份：${response.backupDir}\n${lifecycleMessage}`;
        },
        '已接入 Codex'
      ));
      restoreButton.addEventListener('click', () => run(
        restoreButton, '正在恢复...',
        () => window.agyHubAPI.restoreCodexGateway(),
        response => `Codex 原配置已恢复\n来源：${response.restoredFrom}\n重新启动 Codex 后生效。`
      ));
    
      claudeDesktopAccount?.addEventListener('change', async () => {
        const selectedId = claudeDesktopAccount.value;
        if (!selectedId) return;
        claudeDesktopAccount.disabled = true;
        if (claudeGatewayAccountName) {
          claudeGatewayAccountName.textContent = `${claudeDesktopAccount.options[claudeDesktopAccount.selectedIndex]?.textContent || selectedId}，已选择（未改变当前路由）`;
        }
        try {
          await refreshClaudeSelectedQuota({ force: true });
          showClaudeDesktopResult(`已选择 Claude Code 测试/接入账号\n${claudeDesktopAccount.options[claudeDesktopAccount.selectedIndex]?.textContent || selectedId}\n只有点击“连接到 Claude Code”才会改变当前网关账号。`, 'success');
        } finally {
          claudeDesktopAccount.disabled = false;
        }
      });
    
      claudeGatewayRefreshQuotaButton?.addEventListener('click', () => refreshClaudeSelectedQuota({ force: true, showResult: true }));
    
      claudeGatewayStartButton?.addEventListener('click', () => runClaudeDesktopAction(
        claudeGatewayStartButton,
        '正在启动服务...',
        () => window.agyHubAPI.startCodexGateway(claudeSettings()),
        response => `Claude 本地服务启动成功\nAPI：${response.status.claudeBaseUrl || 'http://127.0.0.1:8046'}\n账号：${claudeDesktopAccount?.options[claudeDesktopAccount.selectedIndex]?.textContent || claudeSettings().accountId}`
      ));
    
      claudeGatewayStopButton?.addEventListener('click', () => runClaudeDesktopAction(
        claudeGatewayStopButton,
        '正在停止服务...',
        () => window.agyHubAPI.stopCodexGateway(),
        '共享本地网关已停止，Codex 与 Claude Code 会同时断开。'
      ));
    
      claudeDesktopTestButton?.addEventListener('click', () => runClaudeDesktopAction(
        claudeDesktopTestButton,
        '正在执行三级测试...',
        () => window.agyHubAPI.testClaudeDesktopGateway(claudeSettings()),
        response => response.report ? formatTieredReport(response) : response.message
      ));
    
      claudeDesktopConnectButton?.addEventListener('click', () => runClaudeDesktopAction(
        claudeDesktopConnectButton,
        '正在接入并启动 Claude...',
        () => window.agyHubAPI.connectClaudeDesktop(claudeSettings()),
        response => {
          const lifecycle = response.lifecycle || {};
          const desktopStatus = response.desktopStatus || {};
          if (lifecycle.success && desktopStatus.connected) {
            const actionText = lifecycle.action === 'restarted'
              ? 'Claude Desktop 已自动重启'
              : 'Claude Desktop 已自动启动';
            return `Claude Desktop 已真实接入\n上游地址：${response.baseUrl}\nClaude 内部中转：${desktopStatus.runtimeBaseUrl}\n${actionText}\n真实配置：${response.registryPath}\n备份：${response.backupDir}`;
          }
          if (lifecycle.success) {
            return {
              type: 'warning',
              message: `8046 已写入 Claude 的真实托管配置，Claude Desktop 也已${lifecycle.action === 'restarted' ? '重启' : '启动'}，但内部网关尚未就绪，暂不标记为已连接。\n真实配置：${response.registryPath}\n内部中转：${desktopStatus.runtimeBaseUrl || '尚未创建'}`
            };
          }
          return {
            type: 'warning',
            message: `8046 已写入 Claude 的真实托管配置，但 Claude Desktop 未能自动启动\n原因：${lifecycle.error || '未找到可用的启动入口'}\n真实配置：${response.registryPath}`
          };
        }
      ));
    
      claudeDesktopRestoreButton?.addEventListener('click', () => runClaudeDesktopAction(
        claudeDesktopRestoreButton,
        '正在恢复原配置...',
        () => window.agyHubAPI.restoreClaudeDesktop(),
        response => `Claude Desktop 原配置已恢复\n来源：${response.restoredFrom}\n请手动重新打开 Claude。`
      ));
    
      claudeDesktopModel?.addEventListener('change', () => {
        showClaudeDesktopResult(`已选择 Claude Code 默认模型：${claudeDesktopModel.options[claudeDesktopModel.selectedIndex]?.textContent || claudeDesktopModel.value}\nClaude Code 内仍可通过真实模型列表随时切换；当前网关路由没有改变。`);
      });
    
      document.getElementById('btn-copy-claude-url')?.addEventListener('click', async () => {
        await navigator.clipboard.writeText(claudeGatewayBaseUrl?.textContent || 'http://127.0.0.1:8046');
        showClaudeDesktopResult('Claude API 地址已复制', 'success');
      });
      document.getElementById('btn-copy-claude-key')?.addEventListener('click', async () => {
        await navigator.clipboard.writeText(claudeDesktopApiKey?.value || '');
        showClaudeDesktopResult('Claude API Key 已复制', 'success');
      });
      document.getElementById('btn-toggle-claude-key')?.addEventListener('click', () => {
        if (claudeDesktopApiKey) claudeDesktopApiKey.type = claudeDesktopApiKey.type === 'password' ? 'text' : 'password';
      });
    
      document.getElementById('btn-copy-codex-url').addEventListener('click', async () => {
        await navigator.clipboard.writeText(baseUrl.textContent);
        showResult('API 地址已复制', 'success');
      });
      document.getElementById('btn-copy-codex-key').addEventListener('click', async () => {
        await navigator.clipboard.writeText(apiKey.value);
        showResult('API Key 已复制', 'success');
      });
      document.getElementById('btn-toggle-codex-key').addEventListener('click', () => {
        apiKey.type = apiKey.type === 'password' ? 'text' : 'password';
      });
      diagnosticButton?.addEventListener('click', async () => {
        const original = diagnosticButton.textContent;
        diagnosticButton.disabled = true;
        diagnosticButton.textContent = '正在生成...';
        diagnosticButton.classList.add('is-busy');
        try {
          const response = await window.agyHubAPI.getGatewayDiagnostics();
          if (!response || response.success === false) throw new Error(response?.error || '诊断报告生成失败');
          await navigator.clipboard.writeText(response.text || JSON.stringify(response.report, null, 2));
          diagnosticButton.textContent = '诊断已复制';
          diagnosticButton.classList.add('is-complete');
          const message = `脱敏诊断报告已复制\n版本、运行路径、三个独立 Profile、配置落盘、最近请求与三级测试已收集。\nAPI Key、Token、账号原文和对话内容不会包含在报告中。`;
          if (activeCodexPage === 'claude') showClaudeDesktopResult(message, 'success');
          else if (activeCodexPage === 'provider') showProviderResult(message, 'success');
          else showResult(message, 'success');
          setTimeout(() => {
            diagnosticButton.textContent = original;
            diagnosticButton.classList.remove('is-complete');
          }, 3000);
        } catch (error) {
          diagnosticButton.textContent = original;
          if (activeCodexPage === 'claude') showClaudeDesktopResult(error.message, 'error');
          else if (activeCodexPage === 'provider') showProviderResult(error.message, 'error');
          else showResult(error.message, 'error');
        } finally {
          diagnosticButton.disabled = false;
          diagnosticButton.classList.remove('is-busy');
        }
      });
      document.addEventListener('agy-codex-tab-opened', () => refreshCodexPage(activeCodexPage));
      if (window.agyHubAPI.onTokenLogUpdate) {
        window.agyHubAPI.onTokenLogUpdate(data => {
          if (data.type === 'stats') renderCodexUsage(data.stats);
        });
      }
      await refresh({ force: true, includeQuota: true, includeClaude: true });
      await loadProviderProfiles();
      await refreshCodexUsage({ force: true });
      setInterval(() => {
        const gatewayPane = document.getElementById('tab-codex-gateway');
        if (gatewayPane?.classList.contains('active') && activeCodexPage === 'overview') {
          scheduleAfterPaint(() => refresh({ force: true, includeQuota: true }));
        }
      }, 60 * 1000);
  }

  return { init };
});
