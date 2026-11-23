const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { buildLocalizationOverlay } = require('./localization');
const { readPatchWorkbenchResource } = require('../patchResourceResolver');

function normalizeVersion(value) {
  const match = String(value || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : 'unknown';
}

function createQuotaSnapshotState(storage) {
  const fields = [
    ['geminiWeekly', 'gemini_weekly'],
    ['gemini5h', 'gemini_5h'],
    ['claudeWeekly', 'claude_weekly'],
    ['claude5h', 'claude_5h'],
    ['argonWeekly', 'argon_weekly']
  ];
  const listeners = new Set();
  let currentAccountId = '';
  let currentSnapshot = null;
  let pendingResult = null;

  const isPercent = value => /^\d+%$/.test(String(value || ''));
  // v3 discards snapshots produced by the legacy binary float scanner.
  const snapshotKey = accountId => `agy_quota_snapshot_v3_${accountId}`;
  const notify = () => {
    for (const listener of listeners) {
      try { listener(currentSnapshot); } catch (_) {}
    }
  };
  const readCachedSnapshot = accountId => {
    if (!accountId || !storage || typeof storage.getItem !== 'function') return null;
    try {
      const parsed = JSON.parse(String(storage.getItem(snapshotKey(accountId)) || 'null'));
      if (!parsed || parsed.accountId !== accountId || !parsed.quota) return null;
      if (Date.now() - Number(parsed.fetchedAt || 0) > 60000) return null;
      const quota = {};
      for (const [field] of fields) {
        if (isPercent(parsed.quota[field])) quota[field] = String(parsed.quota[field]);
      }
      if (Object.keys(quota).length === 0) return null;
      return {
        accountId,
        quota,
        capabilities: { argon: isPercent(quota.argonWeekly) || Boolean(parsed.capabilities && parsed.capabilities.argon) },
        quotaSource: 'local-language-server-cache',
        fetchedAt: Number(parsed.fetchedAt || 0),
        cached: true
      };
    } catch (_) {
      return null;
    }
  };
  const persistSnapshot = snapshot => {
    if (!snapshot || !snapshot.accountId || !storage || typeof storage.setItem !== 'function') return;
    try {
      storage.setItem(snapshotKey(snapshot.accountId), JSON.stringify(snapshot));
      storage.setItem('quota_' + snapshot.accountId + '_checked_at', String(snapshot.fetchedAt || Date.now()));
      storage.setItem('quota_' + snapshot.accountId + '_source', 'language-server');
      storage.setItem('quota_' + snapshot.accountId + '_argon_cap', snapshot.capabilities && snapshot.capabilities.argon ? '1' : '0');
      for (const [field, suffix] of fields) {
        const key = 'quota_' + snapshot.accountId + '_' + suffix;
        const value = snapshot.quota[field];
        if (isPercent(value)) storage.setItem(key, value);
      }
    } catch (_) {}
  };
  const publish = result => {
    if (!result || !result.success || !result.quota) {
      if (currentSnapshot) { currentSnapshot.cached = true; notify(); }
      return currentSnapshot;
    }
    if (!currentAccountId) {
      pendingResult = result;
      return null;
    }
    if (result.accountId && result.accountId !== currentAccountId) return currentSnapshot;
    const previous = currentSnapshot && currentSnapshot.accountId === currentAccountId ? currentSnapshot.quota : {};
    const quota = {};
    for (const [field] of fields) {
      const nextValue = result.quota[field];
      if (isPercent(nextValue)) quota[field] = String(nextValue);
      else if (nextValue === undefined && isPercent(previous[field])) quota[field] = String(previous[field]);
    }
    if (Object.keys(quota).length === 0) return currentSnapshot;
    currentSnapshot = {
      accountId: currentAccountId,
      quota,
      capabilities: {
        argon: isPercent(quota.argonWeekly) || Boolean(result.capabilities && result.capabilities.argon)
      },
      quotaSource: 'local-language-server',
      fetchedAt: Number(result.fetchedAt || Date.now()),
      cached: result.cached === true
    };
    persistSnapshot(currentSnapshot);
    notify();
    return currentSnapshot;
  };
  const setAccount = accountId => {
    const id = String(accountId || '');
    if (id === currentAccountId) return currentSnapshot;
    currentAccountId = id;
    currentSnapshot = readCachedSnapshot(id);
    notify();
    if (pendingResult && id) {
      const result = pendingResult;
      pendingResult = null;
      return publish(result);
    }
    return currentSnapshot;
  };
  const getResult = () => currentSnapshot ? {
    success: true,
    quota: { ...currentSnapshot.quota },
    capabilities: { ...currentSnapshot.capabilities },
    quotaSource: currentSnapshot.quotaSource,
    fetchedAt: currentSnapshot.fetchedAt,
    cached: currentSnapshot.cached === true
  } : { success: false, pending: true, error: 'Language Server 额度尚未就绪' };

  return {
    setAccount,
    publish,
    getSnapshot: () => currentSnapshot,
    getResult,
    getAccountId: () => currentAccountId,
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

function countHits(source, needle) {
  if (!needle) return 0;
  return source.split(needle).length - 1;
}

function requireSingleAnchor(source, anchor, label) {
  const hits = countHits(source, anchor);
  if (hits !== 1) {
    throw new Error(`${label} anchor expected exactly once but found ${hits}: ${anchor.slice(0, 120)}`);
  }
}

function insertAfter(source, anchor, payload, label) {
  requireSingleAnchor(source, anchor, label);
  const index = source.indexOf(anchor) + anchor.length;
  return `${source.slice(0, index)}\n${payload.trim()}\n${source.slice(index)}`;
}

function insertBefore(source, anchor, payload, label) {
  requireSingleAnchor(source, anchor, label);
  const index = source.indexOf(anchor);
  return `${source.slice(0, index)}${payload.trim()}\n${source.slice(index)}`;
}

function insertIntoAppWhenReady(source, payload, label) {
  // Comments and logging setup around this lifecycle hook have changed several
  // times. Match the Electron lifecycle itself so harmless official wording or
  // formatting changes do not break the patch, while still failing closed if
  // the startup structure genuinely changes.
  const pattern = /\belectron_1\.app\s*\.\s*whenReady\s*\(\s*\)\s*\.\s*then\s*\(\s*async\s*\(\s*\)\s*=>\s*\{/g;
  const matches = [...String(source || '').matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`${label} app.whenReady lifecycle expected exactly once but found ${matches.length}`);
  }
  const index = matches[0].index + matches[0][0].length;
  return `${source.slice(0, index)}\n${payload.trim()}\n${source.slice(index)}`;
}

function insertIntoFunctionBody(source, functionName, payload, label) {
  if (!/^[A-Za-z_$][\w$]*$/.test(String(functionName || ''))) {
    throw new Error(`${label} function name is invalid`);
  }
  const pattern = new RegExp(`\\bfunction\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{`, 'g');
  const matches = [...String(source || '').matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`${label} function expected exactly once but found ${matches.length}: ${functionName}`);
  }
  const index = matches[0].index + matches[0][0].length;
  return `${source.slice(0, index)}\n${payload.trim()}\n${source.slice(index)}`;
}

function extractBetween(source, startAnchor, endAnchor, label, options = {}) {
  requireSingleAnchor(source, startAnchor, `${label} start`);
  requireSingleAnchor(source, endAnchor, `${label} end`);
  const start = source.indexOf(startAnchor) + (options.includeStart === false ? startAnchor.length : 0);
  const end = source.indexOf(endAnchor, start);
  if (end <= start) throw new Error(`${label} anchors are out of order`);
  return source.slice(start, end).trim();
}

function replaceBetween(source, startAnchor, endAnchor, payload, label) {
  requireSingleAnchor(source, startAnchor, `${label} start`);
  requireSingleAnchor(source, endAnchor, `${label} end`);
  const start = source.indexOf(startAnchor);
  const end = source.indexOf(endAnchor, start);
  if (end <= start) throw new Error(`${label} anchors are out of order`);
  return `${source.slice(0, start)}${payload.trim()}\n${source.slice(end)}`;
}

function applyLiteralRules(source, rules, relativePath) {
  const applied = [];
  let output = source;
  for (const [index, rule] of rules.entries()) {
    if (!rule || rule.enabled === false) continue;
    if (String(rule.file || '').replace(/\\/g, '/') !== relativePath) continue;
    const find = String(rule.find || '');
    const replace = String(rule.replace || '');
    const hits = countHits(output, find);
    if (hits === 0) {
      const replacementHits = replace ? countHits(output, replace) : 0;
      if (replacementHits > 0) {
        applied.push({ index: index + 1, file: relativePath, description: rule.description || '', hits: 0, alreadyApplied: true });
        continue;
      }
      throw new Error(`Runtime rule ${index + 1} did not match ${relativePath}`);
    }
    if (Number.isInteger(rule.expectedHits) && hits !== rule.expectedHits) {
      throw new Error(`Runtime rule ${index + 1} expected ${rule.expectedHits} matches but found ${hits} in ${relativePath}`);
    }
    output = output.split(find).join(replace);
    applied.push({ index: index + 1, file: relativePath, description: rule.description || '', hits });
  }
  return { source: output, applied };
}

function stripLegacyPatchUpdater(source) {
  let output = String(source || '');
  const callPattern = /^[ \t]*setupVersionUpdater\(\);[ \t]*\r?\n/gm;
  const calls = output.match(callPattern) || [];
  if (calls.length === 0) throw new Error('Legacy patch updater call marker is missing');
  output = output.replace(callPattern, '');

  const updaterPattern = /  function setupVersionUpdater\(\) \{[\s\S]*?setInterval\(injectVersionElement, 2000\);\r?\n  \}\r?\n/;
  const updaterMatches = output.match(new RegExp(updaterPattern.source, 'g')) || [];
  if (updaterMatches.length !== 1) {
    throw new Error(`Legacy patch updater block expected exactly once but found ${updaterMatches.length}`);
  }
  return output.replace(updaterPattern, '');
}

function stripLegacyPatchUpdaterIpc(source) {
  const output = String(source || '');
  const startAnchor = "    electron_1.ipcMain.handle('patch:check-update'";
  const restartAnchor = "    electron_1.ipcMain.handle('patch:restart-app'";
  const start = output.indexOf(startAnchor);
  const restart = output.indexOf(restartAnchor, start + 1);
  if (start < 0 || restart < 0) throw new Error('Legacy patch updater IPC markers are missing');
  const handlerEndMarker = '\n    });';
  const end = output.indexOf(handlerEndMarker, restart);
  if (end < 0) throw new Error('Legacy patch updater restart handler end marker is missing');
  return `${output.slice(0, start)}${output.slice(end + handlerEndMarker.length)}`;
}

function addDeveloperModeGate(source) {
  let output = String(source || '');
  const widgetAnchor = '  function injectQuotaWidget() {';
  requireSingleAnchor(output, widgetAnchor, 'quota widget developer-mode gate');
  output = insertBefore(output, widgetAnchor, [
    '  let agyDeveloperModeCache = { checkedAt: 0, enabled: false };',
    '  function isAgyDeveloperModeEnabled() {',
    '    const now = Date.now();',
    '    if (now - agyDeveloperModeCache.checkedAt < 1500) return agyDeveloperModeCache.enabled;',
    '    agyDeveloperModeCache.checkedAt = now;',
    '    try {',
    "      const fs = require('fs');",
    "      const path = require('path');",
    "      const os = require('os');",
    "      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');",
    "      const configPath = path.join(appData, 'Antigravity', 'agy-hub-integration.json');",
    "      const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\\uFEFF/, ''));",
    '      agyDeveloperModeCache.enabled = Boolean(config && config.developerMode === true);',
    '    } catch (_) {',
    '      agyDeveloperModeCache.enabled = false;',
    '    }',
    '    return agyDeveloperModeCache.enabled;',
    '  }',
    ''
  ].join('\n'), 'quota widget developer-mode helper');

  const themeAnchor = '      const quotaTheme = readQuotaTheme(settingsBtn);';
  requireSingleAnchor(output, themeAnchor, 'quota widget theme anchor');
  output = insertBefore(output, themeAnchor, [
    "      const translationAuditRow = root && root.querySelector('.translation-audit-row');",
    "      if (translationAuditRow) translationAuditRow.style.display = isAgyDeveloperModeEnabled() ? 'flex' : 'none';",
    ''
  ].join('\n'), 'quota widget developer-mode visibility');
  return output;
}

function enhanceThemeSemanticCoverage(source) {
  let output = String(source || '');
  const appRootPredicate = "            return className.includes('h-screen') && className.includes('w-screen') && className.includes('bg-background');";
  requireSingleAnchor(output, appRootPredicate, 'theme app root detection');
  output = output.replace(appRootPredicate, [
    "            return className.includes('agy-shell') || (",
    "                (className.includes('h-screen') || className.includes('h-full'))",
    "                && (className.includes('w-screen') || className.includes('w-full'))",
    "                && className.includes('bg-background')",
    '            );'
  ].join('\n'));
  const viewPattern = /    function detectView\(\) \{[\s\S]*?        return 'new-chat';\r?\n    \}/;
  const viewMatches = output.match(new RegExp(viewPattern.source, 'g')) || [];
  if (viewMatches.length !== 1) throw new Error(`Theme detectView block expected exactly once but found ${viewMatches.length}`);
  output = output.replace(viewPattern, [
    '    function detectView() {',
    "        const settings = document.querySelector('.settings-modal-container');",
    "        if (visible(settings)) return 'settings';",
    "        const mainSignals = Array.from(document.querySelectorAll('h1,h2,h3,input[placeholder],button,p'))",
    '            .filter(element => visible(element) && element.getBoundingClientRect().x > 280)',
    "            .slice(0, 160).map(element => compactText(element)).join(' | ');",
    "        if (/(?:历史对话|Conversation History|Search conversations|搜索对话)/i.test(mainSignals)) return 'history';",
    "        if (/(?:自动化任务|计划任务|Automations|Scheduled Tasks|Search tasks|No (?:automations|scheduled tasks)|搜索任务)/i.test(mainSignals)) return 'scheduled';",
    "        if (/(?:自定义功能|Customizations|Add MCP Servers|Search customizations|添加 MCP 服务)/i.test(mainSignals)) return 'customizations';",
    "        const reviewText = Array.from(document.querySelectorAll('button')).filter(visible).map(compactText).join(' ');",
    "        if (/审核|批准|拒绝|Approve|Reject/.test(reviewText) && document.querySelector('[role=\"article\"]')) return 'review';",
    "        if (/^\\/c\\//.test(location.pathname) || document.querySelector('[role=\"article\"][aria=\"Agent response\"]')) return 'conversation';",
    "        return 'new-chat';",
    '    }'
  ].join('\n'));

  const backdropAnchor = "        const backdrop = document.querySelector('.settings-modal-backdrop');";
  requireSingleAnchor(output, backdropAnchor, 'theme main surface fallback');
  output = insertBefore(output, backdropAnchor, [
    "        const previousMainSurface = document.querySelector('[data-agy-surface=\"main\"]');",
    "        if (previousMainSurface && !visible(previousMainSurface)) previousMainSurface.removeAttribute('data-agy-surface');",
    "        if (!document.querySelector('[data-agy-surface=\"main\"]')) {",
    "            const sidebarRect = sidebar && sidebar.getBoundingClientRect();",
    "            const minX = sidebarRect ? Math.max(240, sidebarRect.right - 4) : Math.max(240, innerWidth * .16);",
    "            const candidates = Array.from(document.querySelectorAll('#root .agy-inset-shell, #root [data-testid=\"home-greeting\"], #root [data-testid=\"conversation-view\"], #root [data-testid=\"sidecars-view\"], #root [data-testid=\"workspace-customizations-view\"], #root main, #root [role=\"main\"], #root [class*=\"flex-1\"], #root [class~=\"bg-background\"]')).map(element => element.closest('.agy-inset-shell') || element).filter((element, index, items) => items.indexOf(element) === index).filter(element => {",
    "                if (!visible(element) || sidebar?.contains(element) || element.closest('.settings-modal-container,[role=\"dialog\"]')) return false;",
    "                const rect = element.getBoundingClientRect();",
    "                return rect.x >= minX && rect.width >= innerWidth * .48 && rect.height >= innerHeight * .52;",
    "            }).sort((a, b) => {",
    "                const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();",
    "                return (br.width * br.height) - (ar.width * ar.height);",
    "            });",
    "            mark(candidates[0], 'surface', 'main');",
    "        }",
    ''
  ].join('\n'), 'theme main surface fallback');

  const cssAnchor = '          #agy-theme-switcher-v2 {';
  requireSingleAnchor(output, cssAnchor, 'theme auxiliary views CSS');
  output = insertBefore(output, cssAnchor, [
    '          /* Antigravity 2.28 mounts an opaque .agy-shell after the splash screen. */',
    '          html.agy-theme-active-v2 #root .agy-shell.bg-background {',
    '            background-color: transparent !important;',
    '            background-image: none !important;',
    '          }',
    '          /* 2.32 moved the opaque canvas background to this inner shell. */',
    '          html.agy-theme-active-v2 #root .agy-inset-shell {',
    '            background-color: transparent !important;',
    '            background-image: none !important;',
    '          }',
    '          /* 2.29 may put bg-background on the marked root itself or on a nested route surface. */',
    '          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-surface="main"].bg-background,',
    '          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-surface="main"][class~="bg-background"],',
    '          html.agy-theme-active-v2[data-agy-view="new-chat"] [data-agy-surface="main"] [class~="bg-background"] {',
    '            background-color: transparent !important;',
    '            background-image: none !important;',
    '          }',
    '          /* Non-chat product views keep the wallpaper visible behind a calm glass surface. */',
    '          html.agy-theme-active-v2[data-agy-view="history"] #agy-theme-wallpaper-v2,',
    '          html.agy-theme-active-v2[data-agy-view="scheduled"] #agy-theme-wallpaper-v2,',
    '          html.agy-theme-active-v2[data-agy-view="customizations"] #agy-theme-wallpaper-v2 { opacity: .72; filter: saturate(.88) brightness(1.015); }',
    '          html.agy-theme-active-v2[data-agy-view="history"] #agy-theme-wallpaper-v2::after,',
    '          html.agy-theme-active-v2[data-agy-view="scheduled"] #agy-theme-wallpaper-v2::after,',
    '          html.agy-theme-active-v2[data-agy-view="customizations"] #agy-theme-wallpaper-v2::after { background: rgba(250,252,250,.14); }',
    '          html.agy-theme-active-v2[data-agy-view="history"] [data-agy-surface="main"],',
    '          html.agy-theme-active-v2[data-agy-view="scheduled"] [data-agy-surface="main"],',
    '          html.agy-theme-active-v2[data-agy-view="customizations"] [data-agy-surface="main"] {',
    '            background: linear-gradient(105deg, color-mix(in srgb, var(--agy-content) 42%, transparent), color-mix(in srgb, var(--agy-warm) 28%, transparent)) !important;',
    '            backdrop-filter: blur(10px) saturate(.98) !important;',
    '            -webkit-backdrop-filter: blur(10px) saturate(.98) !important;',
    '            box-shadow: inset 1px 0 0 color-mix(in srgb, var(--agy-border) 55%, transparent);',
    '          }',
    '          html.agy-theme-active-v2[data-agy-view="history"] [data-agy-surface="main"] [class~="bg-background"],',
    '          html.agy-theme-active-v2[data-agy-view="scheduled"] [data-agy-surface="main"] [class~="bg-background"],',
    '          html.agy-theme-active-v2[data-agy-view="customizations"] [data-agy-surface="main"] [class~="bg-background"] { background-color: transparent !important; }',
    '          /* 2.29 composer uses nested surface-composer / surface-composer-card elements. */',
    '          html.agy-theme-active-v2 [data-agy-component="composer"] {',
    '            border: 1px solid color-mix(in srgb, var(--agy-accent) 30%, transparent) !important;',
    '            border-left-width: 1px !important;',
    '            border-radius: 18px !important;',
    '            box-shadow: 0 10px 30px color-mix(in srgb, var(--agy-shadow) 42%, transparent), inset 0 1px 0 rgba(255,255,255,.32) !important;',
    '            backdrop-filter: blur(18px) saturate(1.04) !important;',
    '            -webkit-backdrop-filter: blur(18px) saturate(1.04) !important;',
    '          }',
    '          html.agy-theme-active-v2 [data-agy-component="composer-inner"] {',
    '            border-radius: 16px !important;',
    '          }',
    ''
  ].join('\n'), 'theme auxiliary views CSS');
  return output;
}

function buildPreload(official, legacy) {
  let payload = legacy.slice(legacy.indexOf("electron_1.contextBridge.exposeInMainWorld('mcpLogger'"));
  if (!payload || payload === legacy) throw new Error('Legacy preload payload marker is missing');
  payload = stripLegacyPatchUpdater(payload);
  payload = addDeveloperModeGate(payload);
  payload = enhanceThemeSemanticCoverage(payload);
  payload = buildLocalizationOverlay(payload);
  payload = enhanceArgonQuotaWidget(payload);
  const anchor = "electron_1.contextBridge.exposeInMainWorld('ide', ideAPI);";
  const output = insertAfter(official, anchor, payload, 'preload extension point');
  return output;
}

function enhanceArgonQuotaWidget(source) {
  let output = String(source || '');
  // The current account has one renderer-side snapshot. Both the sidebar and
  // the detail dialog consume it; neither UI is a data source for the other.
  output = insertBefore(output, '  function injectQuotaWidget() {', `${createQuotaSnapshotState.toString().replace(/^/gm, '  ')}
  const agyQuotaState = createQuotaSnapshotState(localStorage);

  function getAgyCurrentQuotaResult() {
    return agyQuotaState.getResult();
  }

  function applyAgyQuotaResultToCard(card, result) {
    if (!card || !result || !result.success || !result.quota) return;
    const quota = result.quota;
    const pairs = [
      ['claudeWeekly', '.val-c-weekly', '.fill-c-weekly'],
      ['claude5h', '.val-c-5h', '.fill-c-5h'],
      ['geminiWeekly', '.val-g-weekly', '.fill-g-weekly'],
      ['gemini5h', '.val-g-5h', '.fill-g-5h']
    ];
    for (const [field, valueSelector, fillSelector] of pairs) {
      const value = String(quota[field] || '');
      const valueEl = card.querySelector(valueSelector);
      const fillEl = card.querySelector(fillSelector);
      const valid = /^\\d+%$/.test(value);
      if (valueEl) {
        valueEl.textContent = valid ? value : '--';
        valueEl.title = result.cached ? '上次获取的额度，等待 Language Server 刷新' : 'Language Server 实时额度';
      }
      if (fillEl) {
        fillEl.style.width = valid ? value : '0%';
        const pct = parseInt(value) || 0;
        fillEl.style.backgroundColor = pct >= 50 ? '#10b981' : (pct >= 20 ? '#f59e0b' : '#ef4444');
      }
    }
    const argonValue = String(quota.argonWeekly || '');
    const argonItem = card.querySelector('.argon-quota-item');
    const argonValueEl = card.querySelector('.val-argon-weekly');
    const argonFill = card.querySelector('.fill-argon-weekly');
    const hasArgon = /^\\d+%$/.test(argonValue) || Boolean(result.capabilities && result.capabilities.argon);
    if (argonItem) argonItem.style.display = hasArgon ? '' : 'none';
    if (/^\\d+%$/.test(argonValue)) {
      if (argonValueEl) argonValueEl.textContent = argonValue;
      if (argonFill) {
        argonFill.style.width = argonValue;
        const pct = parseInt(argonValue) || 0;
        argonFill.style.backgroundColor = pct >= 50 ? '#10b981' : (pct >= 20 ? '#f59e0b' : '#ef4444');
      }
    }
  }

  function renderAgyQuotaConsumers() {
    try { injectQuotaWidget(); } catch (_) {}
    const root = window.__agyAccountManagerRoot;
    if (!root) return;
    const accountId = agyQuotaState.getAccountId();
    const currentCard = accountId ? root.querySelector('.account-card[data-account-id="' + accountId + '"]') : null;
    applyAgyQuotaResultToCard(currentCard, getAgyCurrentQuotaResult());
  }

  function publishAgyCurrentQuota(result) {
    agyQuotaState.publish(result);
  }

  function requestAgyCurrentQuotaSnapshot() {
    return electron_1.ipcRenderer.invoke('agy:quota:get-current').then(result => {
      publishAgyCurrentQuota(result);
      return result;
    }).catch(() => null);
  }

  function setAgyCurrentQuotaAccount(accountId) {
    const id = String(accountId || '');
    const changed = agyQuotaState.getAccountId() !== id;
    window.antigravityCurrentAccount = id;
    if (id) localStorage.setItem('agy_current_account_id', id);
    else localStorage.removeItem('agy_current_account_id');
    agyQuotaState.setAccount(id);
    if (changed && id) requestAgyCurrentQuotaSnapshot();
  }

  function refreshAgyActiveQuota(force) {
    const id = agyQuotaState.getAccountId();
    const now = Date.now();
    if (!id) return Promise.resolve(getAgyCurrentQuotaResult());
    if (window.__agyQuotaRefreshingId === id) return window.__agyQuotaRefreshPromise || Promise.resolve(getAgyCurrentQuotaResult());
    if (!force && (now - Number(window.__agyQuotaLastRefreshAt || 0)) < 4500) return Promise.resolve(getAgyCurrentQuotaResult());
    window.__agyQuotaLastRefreshAt = now;
    window.__agyQuotaRefreshingId = id;
    window.__agyQuotaRefreshPromise = electron_1.ipcRenderer.invoke('agy:quota:refresh-current').then(result => {
      if (agyQuotaState.getAccountId() === id) publishAgyCurrentQuota(result);
      return getAgyCurrentQuotaResult();
    }).catch(() => getAgyCurrentQuotaResult()).finally(() => {
      if (window.__agyQuotaRefreshingId === id) window.__agyQuotaRefreshingId = null;
      window.__agyQuotaRefreshPromise = null;
    });
    return window.__agyQuotaRefreshPromise;
  }

  agyQuotaState.subscribe(() => renderAgyQuotaConsumers());
  if (!window.__agyQuotaIpcBound) {
    window.__agyQuotaIpcBound = true;
    electron_1.ipcRenderer.on('agy:quota:updated', (_event, result) => publishAgyCurrentQuota(result));
  }
`, 'shared current-account quota state');

  const existingModal = `    const existing = document.getElementById('antigravity-accounts-manager');
    if (existing) {
      existing.remove();
      return;
    }`;
  requireSingleAnchor(output, existingModal, 'account modal shared quota stale root');
  output = output.replace(existingModal, `    const existing = document.getElementById('antigravity-accounts-manager');
    if (existing) {
      window.__agyAccountManagerRoot = null;
      existing.remove();
      return;
    }`);
  const modelReturn = '              return m[1];';
  requireSingleAnchor(output, modelReturn, 'quota widget current model label');
  output = output.replace(modelReturn, '              return text;');

  const values = `      const gWeekly = localStorage.getItem('quota_gemini_weekly') || '--';
      const g5h = localStorage.getItem('quota_gemini_5h') || '--';
      const cWeekly = localStorage.getItem('quota_claude_weekly') || '--';
      const c5h = localStorage.getItem('quota_claude_5h') || '--';`;
  requireSingleAnchor(output, values, 'quota widget legacy cached values');
  output = output.replace(values, `      const agyQuotaResult = getAgyCurrentQuotaResult();
      const agyQuota = agyQuotaResult.success ? agyQuotaResult.quota : {};
      const gWeekly = agyQuota.geminiWeekly || '待查询';
      const g5h = agyQuota.gemini5h || '待查询';
      const cWeekly = agyQuota.claudeWeekly || '待查询';
      const c5h = agyQuota.claude5h || '待查询';
      const argonWeekly = agyQuota.argonWeekly || (agyQuotaResult.success && agyQuotaResult.capabilities && agyQuotaResult.capabilities.argon ? '待确认' : '待查询');
      root.title = agyQuotaResult.cached ? '上次获取的额度，等待 Language Server 刷新' : 'Language Server 实时额度';`);

  const modelFlags = "      const isGemini = currentModel.includes('gemini');";
  requireSingleAnchor(output, modelFlags, 'quota widget model flags');
  output = output.replace(modelFlags, `${modelFlags}\n      const isArgon = isGemini && currentModel.includes('argon');`);

  const geminiBlock = `      if (isGemini) {
        if (titleEl.textContent !== 'gemini') {
          titleEl.textContent = 'gemini';
          titleEl.style.color = '#3b82f6';
        }
        if (weeklyEl.textContent !== gWeekly) weeklyEl.textContent = gWeekly;
        if (hourlyEl.textContent !== g5h) hourlyEl.textContent = g5h;
      } else {`;
  requireSingleAnchor(output, geminiBlock, 'quota widget Gemini render');
  output = output.replace(geminiBlock, `      if (isGemini) {
        const titleText = isArgon ? 'Gemini 4 Argon' : 'gemini';
        if (titleEl.textContent !== titleText) {
          titleEl.textContent = titleText;
          titleEl.style.color = isArgon ? '#8b5cf6' : '#3b82f6';
        }
        const weeklyValue = isArgon ? argonWeekly : gWeekly;
        if (weeklyEl.textContent !== weeklyValue) weeklyEl.textContent = weeklyValue;
        const hourlyRow = root.querySelector('.hourly-row');
        if (hourlyRow) hourlyRow.style.display = isArgon ? 'none' : 'flex';
        if (!isArgon && hourlyEl.textContent !== g5h) hourlyEl.textContent = g5h;
      } else {
        const hourlyRow = root.querySelector('.hourly-row');
        if (hourlyRow) hourlyRow.style.display = 'flex';`);

  const accountLoaded = "            window.antigravityCurrentAccount = res.currentAccountId || '';";
  requireSingleAnchor(output, accountLoaded, 'quota widget account load');
  output = output.replace(accountLoaded, `            setAgyCurrentQuotaAccount(res.currentAccountId || '');`);
  output = output.replaceAll("window.antigravityCurrentAccount = newList.currentAccountId || '';", "setAgyCurrentQuotaAccount(newList.currentAccountId || '');");
  const modalCurrentAccount = '        window.antigravityCurrentAccount = currentId;';
  requireSingleAnchor(output, modalCurrentAccount, 'account modal current account assignment');
  output = output.replace(modalCurrentAccount, '        setAgyCurrentQuotaAccount(currentId);');
  // Repaint the widget quickly without polling cloud quota in the background.
  const widgetTimer = 'setInterval(injectQuotaWidget, 2000);';
  if (countHits(output, widgetTimer) !== 2) throw new Error('Quota widget timers changed unexpectedly');
  output = output.replaceAll(widgetTimer, `${widgetTimer}\n      if (!window.__agyModelSwitchFastHook) { window.__agyModelSwitchFastHook = true; document.addEventListener('click', () => { setTimeout(injectQuotaWidget, 60); }, true); }`);

  const modalRoot = `    host.id = 'antigravity-accounts-manager';
    document.body.appendChild(host);
    const root = host.attachShadow({ mode: 'open' });`;
  requireSingleAnchor(output, modalRoot, 'account modal shared quota root');
  output = output.replace(modalRoot, `${modalRoot}\n    window.__agyAccountManagerRoot = root;`);
  const modalClose = `    const accountListContainer = root.querySelector('.account-list');
    const contentContainer = root.querySelector('.content');
    const close = () => host.remove();`;
  requireSingleAnchor(output, modalClose, 'account modal shared quota cleanup');
  output = output.replace(modalClose, `    const accountListContainer = root.querySelector('.account-list');
    const contentContainer = root.querySelector('.content');
    const close = () => { if (window.__agyAccountManagerRoot === root) window.__agyAccountManagerRoot = null; host.remove(); };`);

  const modalStyleAnchor = '        .btn-switch-card { min-width: 66px; }';
  requireSingleAnchor(output, modalStyleAnchor, 'account modal style anchor');
  output = output.replace(modalStyleAnchor, `${modalStyleAnchor}
        .dialog { border-radius: 14px; box-shadow: 0 24px 64px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.06); }
        .header { padding: 16px 22px; background: color-mix(in srgb, var(--vscode-editor-background, Canvas) 92%, CanvasText 4%); }
        .account-card { border-radius: 10px; padding: 14px 16px; background: color-mix(in srgb, var(--vscode-editor-background, Canvas) 78%, CanvasText 4%); border-color: color-mix(in srgb, CanvasText 12%, transparent); }
        .account-card.current { border-left: 3px solid #3b82f6; background: color-mix(in srgb, #3b82f6 5%, var(--vscode-editor-background, Canvas)); }
        .btn-action { font-weight: 600; border-radius: 6px; padding: 5px 12px; }
        .btn-action.danger-text { color: #f87171 !important; border-color: rgba(239, 68, 68, 0.32) !important; background: rgba(239, 68, 68, 0.08) !important; }
        .btn-action.danger-text:hover { color: #fecaca !important; background: rgba(239, 68, 68, 0.18) !important; border-color: rgba(239, 68, 68, 0.5) !important; }
        .quota-label { font-size: 10px; font-weight: 500; }
        .progress-bar { height: 6px; border-radius: 999px; }
        .progress-fill { border-radius: 999px; }
        .argon-quota-item .quota-label span:first-child { color: #a78bfa; font-weight: 600; }`);

  const loadAccountsStart = `    async function loadAccounts() {
      accountListContainer.innerHTML = '<div class="empty-hint">正在载入中...</div>';
      try {
        const res = await electron_1.ipcRenderer.invoke('accounts:list');`;
  requireSingleAnchor(output, loadAccountsStart, 'account modal loadAccounts start');
  output = output.replace(loadAccountsStart, `    async function loadAccounts(forceIpc, forceQuota) {
      const hasMemoryCache = !forceIpc && Array.isArray(window.antigravityAccounts) && window.antigravityAccounts.length > 0;
      if (!hasMemoryCache) accountListContainer.innerHTML = '<div class="empty-hint">正在载入中...</div>';
      try {
        const res = hasMemoryCache
          ? { accounts: window.antigravityAccounts.slice(), currentAccountId: window.antigravityCurrentAccount || '' }
          : await electron_1.ipcRenderer.invoke('accounts:list');
        if (hasMemoryCache) {
          electron_1.ipcRenderer.invoke('accounts:list').then(fresh => {
            if (!fresh || !Array.isArray(fresh.accounts)) return;
            const prevSig = (window.antigravityCurrentAccount || '') + ':' + (window.antigravityAccounts || []).map(a => a.id + ':' + a.storageState).join(',');
            const nextSig = (fresh.currentAccountId || '') + ':' + fresh.accounts.map(a => a.id + ':' + a.storageState).join(',');
            window.antigravityAccounts = fresh.accounts;
            setAgyCurrentQuotaAccount(fresh.currentAccountId || '');
            if (prevSig !== nextSig) loadAccounts(true, false);
          }).catch(() => {});
        }`);

  const cardAccountId = '          const accId = acc.id;';
  requireSingleAnchor(output, cardAccountId, 'account card cache id');
  output = output.replace(cardAccountId, `${cardAccountId}
          const currentQuotaResult = isCurrent ? getAgyCurrentQuotaResult() : null;
          const currentQuota = currentQuotaResult && currentQuotaResult.success ? currentQuotaResult.quota : null;
          const freshCache = !isCurrent && Number(localStorage.getItem('quota_' + accId + '_checked_at') || 0) > 0;`);
  const cardQuotaValues = [
    ['thisGWeekly', 'geminiWeekly', 'gemini_weekly'],
    ['thisG5h', 'gemini5h', 'gemini_5h'],
    ['thisCWeekly', 'claudeWeekly', 'claude_weekly'],
    ['thisC5h', 'claude5h', 'claude_5h']
  ];
  for (const [variable, field, suffix] of cardQuotaValues) {
    const line = `          const ${variable} = localStorage.getItem('quota_' + accId + '_${suffix}') || (isCurrent ? (localStorage.getItem('quota_${suffix}') || '--') : '--');`;
    requireSingleAnchor(output, line, 'account card value ' + suffix);
    output = output.replace(line, `          const ${variable} = (currentQuota && currentQuota.${field}) || (freshCache ? localStorage.getItem('quota_' + accId + '_${suffix}') : null) || '--';`);
  }

  const c5hCacheLine = "          const thisC5h = (currentQuota && currentQuota.claude5h) || (freshCache ? localStorage.getItem('quota_' + accId + '_claude_5h') : null) || '--';";
  requireSingleAnchor(output, c5hCacheLine, 'account card c5h state line');
  output = output.replace(c5hCacheLine, `${c5hCacheLine}
          const thisArgonWeekly = (currentQuota && currentQuota.argonWeekly) || (freshCache ? localStorage.getItem('quota_' + accId + '_argon_weekly') : null) || '--';
          const thisArgonVerified = /^\\d+%$/.test(String(thisArgonWeekly || ''));
          const thisArgonCap = thisArgonVerified;`);

  const cardClass = "          card.className = `account-card${isCurrent ? ' current' : ''}`;";
  requireSingleAnchor(output, cardClass, 'account card identity');
  output = output.replace(cardClass, `${cardClass}\n          card.dataset.accountId = acc.id;`);

  const cardQuotaEnd = `              <div class="quota-item">
                <div class="quota-label"><span>Gemini 5H 额度</span><span class="val-g-5h">${'${thisG5h}'}</span></div>
                <div class="progress-bar"><div class="progress-fill gemini fill-g-5h" style="width: ${"${thisG5h !== '--' ? thisG5h : '0%'}"}; background-color: ${'${getQuotaColor(thisG5h)}'}"></div></div>
              </div>`;
  requireSingleAnchor(output, cardQuotaEnd, 'account card Gemini 5H quota');
  output = output.replace(cardQuotaEnd, `${cardQuotaEnd}
              <div class="quota-item argon-quota-item" style="display:${"${thisArgonCap ? '' : 'none'}"}; grid-column:1 / -1;">
                <div class="quota-label"><span>Gemini 4 Argon 每周额度</span><span class="val-argon-weekly">${"${thisArgonVerified ? thisArgonWeekly : (thisArgonCap ? '待确认' : '--')}"}</span></div>
                <div class="progress-bar"><div class="progress-fill gemini fill-argon-weekly" style="width:${"${thisArgonVerified ? thisArgonWeekly : '0%'}"}; background-color:${"${thisArgonVerified ? getQuotaColor(thisArgonWeekly) : 'transparent'}"}"></div></div>
              </div>`);

  const storeQuota = "                  localStorage.setItem('quota_' + acc.id + '_claude_5h', qRes.quota.claude5h);";
  requireSingleAnchor(output, storeQuota, 'account card quota persistence');
  output = output.replace(storeQuota, `${storeQuota}
                  localStorage.setItem('quota_' + acc.id + '_checked_at', String(Date.now()));
                  localStorage.setItem('quota_' + acc.id + '_argon_cap', /^\\d+%$/.test(String(qRes.quota.argonWeekly || '')) ? '1' : '0');
                  localStorage.setItem('quota_' + acc.id + '_source', isCurrent ? 'language-server' : String(qRes.quotaSource || 'cloud'));
                  if (/^\\d+%$/.test(String(qRes.quota.argonWeekly || ''))) {
                    const argonItem = card.querySelector('.argon-quota-item');
                    const argonValue = card.querySelector('.val-argon-weekly');
                    const argonFill = card.querySelector('.fill-argon-weekly');
                    if (argonItem) argonItem.style.display = '';
                    const verified = /^\\d+%$/.test(String(qRes.quota.argonWeekly || ''));
                    if (argonValue) argonValue.textContent = qRes.quota.argonWeekly;
                    if (!verified) {
                      localStorage.removeItem('quota_' + acc.id + '_argon_weekly');
                      if (isCurrent && window.antigravityCurrentAccount === acc.id) localStorage.removeItem('quota_argon_weekly');
                    }
                    if (argonFill) { argonFill.style.width = verified ? qRes.quota.argonWeekly : '0%'; argonFill.style.backgroundColor = verified ? getQuotaColor(qRes.quota.argonWeekly) : 'transparent'; }
                    if (verified) {
                      localStorage.setItem('quota_' + acc.id + '_argon_weekly', qRes.quota.argonWeekly);
                      if (isCurrent && window.antigravityCurrentAccount === acc.id) localStorage.setItem('quota_argon_weekly', qRes.quota.argonWeekly);
                    }
                  } else {
                    const argonItem = card.querySelector('.argon-quota-item');
                    if (argonItem) argonItem.style.display = 'none';
                    localStorage.removeItem('quota_' + acc.id + '_argon_weekly');
                    if (isCurrent && window.antigravityCurrentAccount === acc.id) localStorage.removeItem('quota_argon_weekly');
                  }`);
  const modalQuotaInvoke = "electron_1.ipcRenderer.invoke('fetch-account-quota', acc.id)";
  requireSingleAnchor(output, modalQuotaInvoke, 'account modal quota lookup');
  output = output.replace(modalQuotaInvoke, "(isCurrent ? Promise.resolve(getAgyCurrentQuotaResult()) : ((!forceQuota && freshCache) ? Promise.resolve(null) : electron_1.ipcRenderer.invoke('fetch-account-quota', { accountId: acc.id, force: Boolean(forceQuota) })))");
  const modalRefresh = "root.querySelector('.btn-refresh').onclick = loadAccounts;";
  requireSingleAnchor(output, modalRefresh, 'account modal refresh button');
  output = output.replace(modalRefresh, `root.querySelector('.btn-refresh').onclick = async () => {
      const button = root.querySelector('.btn-refresh');
      if (button) button.disabled = true;
      try {
        await refreshAgyActiveQuota(true);
        await loadAccounts(true, true);
      } finally {
        if (button) button.disabled = false;
      }
    };`);
  return output;
}

function enhanceNativeLanguageServerQuota(source) {
  let output = String(source || '');
  const quotaKeys = `        { key: 'gemini-weekly', name: 'gemini_weekly' },
        { key: 'gemini-5h', name: 'gemini_5h' },
        { key: '3p-weekly', name: 'claude_weekly' },
        { key: '3p-5h', name: 'claude_5h' }`;
  requireSingleAnchor(output, quotaKeys, 'native Language Server quota buckets');
  output = output.replace(quotaKeys, `${quotaKeys},
        { key: 'gemini-argon-wtu-weekly', name: 'argon_weekly' }`);

  output = replaceBetween(output, '    let startupQuotaPolled = false;', '    // Accounts list handler', `
    // Startup, manual refresh and the scheduler share one request path.
    void pollLocalQuota();
    startRegularQuotaScheduler();
`, 'native startup quota publish');

  const pollStart = 'async function pollLocalQuota() {';
  const pollEnd = 'function requestGrpc(port, csrf, path, payload) {';
  const nativeQuotaPipeline = `let agyLocalQuotaPollInFlight = null;
let agyCurrentQuotaSnapshot = null;

function publishCurrentLanguageServerQuota(quotas) {
    const result = quotas;
    if (result.success) agyCurrentQuotaSnapshot = result;
    else if (agyCurrentQuotaSnapshot) agyCurrentQuotaSnapshot.cached = true;
    // 2.34 uses BaseWindow + WebContentsView, absent from BrowserWindow.getAllWindows().
    for (const contents of electron_1.webContents.getAllWebContents()) {
        if (contents.isDestroyed()) continue;
        try { contents.send('agy:quota:updated', result); } catch (_) {}
    }
    return result;
}

function currentQuotaAccountId() {
    try {
        const file = require('path').join(require('os').homedir(), '.gemini/antigravity/tools/accounts.json');
        return String(JSON.parse(require('fs').readFileSync(file, 'utf8')).current_account_id || '');
    } catch (_) { return ''; }
}

async function pollLocalQuota() {
    if (agyLocalQuotaPollInFlight) return agyLocalQuotaPollInFlight;
    agyLocalQuotaPollInFlight = (async () => {
        try {
            const languageServer = require('./languageServer');
            const port = languageServer.getLsPort();
            const csrf = (languageServer.getLsCsrfToken || languageServer.getLsCsrf)();
            const accountId = currentQuotaAccountId();
            appendQuotaDebugLog(\`[MAIN_POLL_TICK] port=\${port} csrf=\${Boolean(csrf)}\\n\`);
            if (!port || !csrf) throw new Error('Language Server 尚未就绪');
            const summary = await requestQuotaJson(port, csrf);
            if (accountId !== currentQuotaAccountId() || port !== languageServer.getLsPort()) {
                return { success: false, error: '账号或 Language Server 已切换，请重试' };
            }
            const result = require('./accountQuota').buildLanguageServerQuotaResult(summary);
            if (!result.capabilities.argon) result.quota.argonWeekly = '--';
            return publishCurrentLanguageServerQuota({ ...result, accountId, fetchedAt: Date.now() });
        } catch (e) {
            appendQuotaDebugLog(\`[MAIN_POLL_ERR] execution error: \${e.message}\\n\`);
            console.error('pollLocalQuota execution error:', e);
            return publishCurrentLanguageServerQuota({ success: false, error: e.message });
        }
    })();
    try {
        return await agyLocalQuotaPollInFlight;
    } finally {
        agyLocalQuotaPollInFlight = null;
    }
}

`;
  output = replaceBetween(output, pollStart, pollEnd, nativeQuotaPipeline, 'native Language Server quota pipeline');
  output += `
function requestQuotaJson(port, csrf) {
    return new Promise((resolve, reject) => {
        const req = require('https').request({
            hostname: '127.0.0.1', port,
            path: '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
            method: 'POST', rejectUnauthorized: false,
            headers: { 'Content-Type': 'application/json', 'x-codeium-csrf-token': csrf }
        }, res => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('error', reject);
            res.on('end', () => {
                if (res.statusCode !== 200) return reject(new Error('Language Server HTTP ' + res.statusCode));
                try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
                catch (_) { reject(new Error('Language Server 额度响应格式无效')); }
            });
        });
        req.setTimeout(5000, () => req.destroy(new Error('Language Server 额度请求超时')));
        req.on('error', reject);
        req.end(JSON.stringify({ forceRefresh: true }));
    });
}
`;

  const accountsListAnchor = '    // Accounts list handler';
  requireSingleAnchor(output, accountsListAnchor, 'native current quota IPC insertion');
  output = output.replace(accountsListAnchor, `    electron_1.ipcMain.handle('agy:quota:get-current', async () => agyCurrentQuotaSnapshot && agyCurrentQuotaSnapshot.accountId === currentQuotaAccountId() ? agyCurrentQuotaSnapshot : { success: false, pending: true, error: 'Language Server 额度尚未就绪' });
    electron_1.ipcMain.handle('agy:quota:refresh-current', async () => pollLocalQuota());

${accountsListAnchor}`);
  return output;
}

function buildNativeLocalization(legacy = '') {
  const normalized = legacy.replace(/\r\n/g, '\n');
  const begin = normalized.indexOf('  const dictionary = {'), end = normalized.indexOf('\n  };', begin);
  const context = {dictionary:{}};
  if (legacy) {
    if (begin < 0 || end < begin) throw new Error('Native localization legacy dictionary is missing');
    vm.runInNewContext(normalized.slice(begin,end+5)+'\nglobalThis.dictionary=dictionary;',context,{timeout:1000});
  }
  const messages = {...context.dictionary, ...JSON.parse(readPatchWorkbenchResource('locales/zh-CN.json')).messages};
  const native = readPatchWorkbenchResource('injections/native-localization.js');
  const marker = '/*__AGY_NATIVE_MESSAGES__*/ {}';
  requireSingleAnchor(native,marker,'native localization catalog');
  return native.replace(marker,JSON.stringify(messages));
}

function buildMain(official, legacy, legacyPreload = '') {
  const header = extractBetween(legacy, 'const agyThemePath = require("path");', 'const gotTheLock = electron_1.app.requestSingleInstanceLock();', 'main AGY header');
  const autoProxy = extractBetween(
    legacy,
    '    // Auto-Proxy Injection for Electron Main Session (Codex / Webview)',
    '    // Initialize electron-log and override console',
    'main auto proxy'
  );
  let output = insertBefore(official, 'const gotTheLock = electron_1.app.requestSingleInstanceLock();', header, 'main imports');
  output = insertBefore(output, 'const gotTheLock = electron_1.app.requestSingleInstanceLock();', buildNativeLocalization(legacyPreload), 'native dialog and menu localization');
  output = insertIntoAppWhenReady(output, autoProxy, 'main proxy setup');
  output = insertAfter(
    output,
    "electron_1.app.on('before-quit', async (event) => {",
    '    global.isQuitting = true;',
    'main graceful background quit state'
  );
  return output;
}

function buildTray(official, legacy) {
  const functionEnd = '\n}\n/**\n * Updates the active agents count in the tray menu.';
  const desiredSetup = extractBetween(
    legacy,
    '    const translatedActions = actions.map',
    functionEnd,
    'tray translated menu and activation handlers'
  );
  // Replace only the menu setup. New official helpers (2.17's WSL insertion,
  // for example) and all subsequent functions must remain in the module.
  const setup = '    contextMenu = electron_1.Menu.buildFromTemplate(actions);\n    tray.setContextMenu(contextMenu);';
  requireSingleAnchor(official, setup, 'official tray menu setup');
  let output = official.replace(setup, `    ${desiredSetup}`);
  const officialLabel = "countItem.label =\n                (count > 0 ? `${count}` : 'No') +\n                    ' agent' +\n                    (count === 1 ? '' : 's') +\n                    ' running';";
  requireSingleAnchor(output, officialLabel, 'official tray agent label');
  output = output.replace(officialLabel, "countItem.label = count > 0 ? `${count} 个智能体运行中` : '没有智能体在运行';");
  assertTrayModuleLoads(output, official);
  return output;
}

// Syntax checks cannot detect exports pointing at deleted declarations. Load
// only this small module against inert dependencies, never the real Electron.
function assertTrayModuleLoads(source, officialSource = source) {
  function load(code) {
    const exports = {};
    const dependencies = {
      electron: {},
      path,
      './utils': {},
      './languageServer': {}
    };
    new vm.Script(code, { filename: 'dist/tray.js' }).runInNewContext({
      exports,
      module: { exports },
      __dirname: '/validation/dist',
      require(name) {
        if (!Object.hasOwn(dependencies, name)) throw new Error(`Unexpected tray dependency: ${name}`);
        return dependencies[name];
      }
    }, { timeout: 1000 });
    return exports;
  }
  const expected = load(officialSource);
  const actual = load(source);
  for (const name of ['createTray', 'updateTrayAgentCount']) {
    if (typeof actual[name] !== 'function') throw new Error(`Missing tray function: ${name}`);
  }
  for (const key of new Set(['createTray', 'updateTrayAgentCount', ...Object.keys(expected)])) {
    if (!Object.hasOwn(actual, key) || typeof actual[key] !== typeof expected[key]) {
      throw new Error(`Tray patch removed or changed official export: ${key}`);
    }
  }
  return Object.keys(actual);
}

function buildUtils(official, legacy) {
  const backgroundLifecycle = extractBetween(
    legacy,
    "    win.on('close', (event) => {",
    '    void win.loadURL(url);',
    'window background lifecycle'
  );
  const backgroundPreference = extractBetween(
    legacy,
    'function shouldRunInBackground() {',
    '/**\n * Focuses a window if it exists, or creates a new one.',
    'window background preference'
  );
  const loadPoints = [...official.matchAll(/^[ \t]*void\s+(?:win\.loadURL\(\s*url\s*\)|loadHubWindowUrl\(\s*win\s*,\s*url\s*,[^\n]+\));/gm)];
  if (loadPoints.length !== 1) throw new Error(`window close-to-tray extension point expected exactly once but found ${loadPoints.length}`);
  let output = insertBefore(
    official,
    loadPoints[0][0],
    backgroundLifecycle,
    'window close-to-tray extension point'
  );
  output = insertBefore(
    output,
    '/**\n * Focuses a window if it exists, or creates a new one.',
    backgroundPreference,
    'window background preference extension point'
  );
  return output;
}

function buildIpcHandlers(official, legacy) {
  const top = extractBetween(legacy, 'const accountVault_1 = require("./accountVault");', 'const electron_updater_1 = require("electron-updater");', 'ipc helper block');
  const prefix = extractBetween(legacy, "    const GOOGLE_OAUTH_CLIENT_ID = '", '    // Dialog', 'ipc account prefix');
  const suffixStart = '    // Custom telemetry logger for Antigravity Quota';
  const suffixIndex = legacy.indexOf(suffixStart);
  const helpersBoundary = '\n}\n\nasync function pollLocalQuota()';
  requireSingleAnchor(legacy, helpersBoundary, 'legacy IPC registration end');
  const registrationEnd = legacy.indexOf(helpersBoundary);
  if (suffixIndex < 0 || registrationEnd <= suffixIndex) throw new Error('Legacy ipc suffix markers are missing');
  const suffix = stripLegacyPatchUpdaterIpc(legacy.slice(suffixIndex, registrationEnd).trim());
  const helpers = legacy.slice(registrationEnd + 2);
  let output = insertAfter(official, 'const electron_1 = require("electron");', top, 'ipc imports');
  // Never append registrations to the file's last brace: official functions may
  // return a controller, or add new helpers after registerIpcHandlers (2.34).
  output = insertIntoFunctionBody(output, 'registerIpcHandlers', '    registerAgyIpcHandlers(storageManager);', 'ipc register prefix');
  output += `\nfunction registerAgyIpcHandlers(storageManager) {\n${prefix}\n${suffix}\n}\n${helpers}`;
  output = hardenAccountSwitch(output);
  output = enhanceNativeLanguageServerQuota(output);
  const quotaHandlerStart = "    electron_1.ipcMain.handle('fetch-account-quota', async (event, accountId) => {\n        try {";
  requireSingleAnchor(output, quotaHandlerStart, 'quota IPC request normalization');
  output = output.replace(quotaHandlerStart, `    electron_1.ipcMain.handle('fetch-account-quota', async (event, request) => {
        try {
            const quotaRequest = request && typeof request === 'object' ? request : { accountId: request };
            const accountId = String(quotaRequest.accountId || '');
            const forceQuotaRefresh = quotaRequest.force === true;
            if (!/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) throw new Error('无效账号 ID');`);
  output = replaceBetween(output, '            // A. 静默换取 access_token', '        } catch (err) {\n            return { success: false, error: err.message };\n        }\n    });\n\n    // 注入：export-local-account', [
    '            const registryPath = path.join(accountRoot, "accounts.json");',
    '            const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : {};',
    '            const isCurrentAccount = String(registry.current_account_id || "") === String(accountId);',
    '            const quotaCacheMod = require("./accountQuotaCache");',
    '            if (!forceQuotaRefresh) {',
    '                const cachedQuota = quotaCacheMod.readCachedQuota({ accountRoot, accountId, refreshToken: tokenObj.refresh_token });',
    '                if (cachedQuota) return cachedQuota;',
    '            }',
    '            const accountQuotaMod = require("./accountQuota");',
    '            const liveQuota = isCurrentAccount ? await require("./antigravityQuotaBridge").fetchLiveQuotaSummary({ cacheKey: String(accountId), timeoutMs: 2200, maxAttempts: 2 }).catch(() => null) : null;',
    '            const localSummary = isCurrentAccount && liveQuota?.summary ? accountQuotaMod.parseQuotaSummary(liveQuota.summary) : {};',
    '            const hasCompleteLocal = ["gemini5h", "geminiWeekly", "claude5h", "claudeWeekly"].every(f => localSummary[f] !== undefined);',
    '            let accessToken = "local-language-service";',
    '            if (!hasCompleteLocal) {',
    '                const tokenCache = global.__agyOAuthTokenCache || (global.__agyOAuthTokenCache = new Map());',
    '                const cacheKey = `${accountId}:${String(tokenObj.refresh_token).slice(-16)}`;',
    '                const cachedToken = tokenCache.get(cacheKey);',
    '                if (cachedToken && Date.now() < cachedToken.expiresAt) {',
    '                    accessToken = cachedToken.accessToken;',
    '                } else {',
    '                    const tokenUrl = "https://oauth2.googleapis.com/token";',
    '                    const params = new URLSearchParams();',
    '                    params.append("client_id", "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com");',
    '                    params.append("client_secret", "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");',
    '                    params.append("refresh_token", tokenObj.refresh_token);',
    '                    params.append("grant_type", "refresh_token");',
    '                    const tokenRes = await net.fetch(tokenUrl, {',
    '                        method: "POST",',
    '                        headers: { "Content-Type": "application/x-www-form-urlencoded" },',
    '                        body: params.toString(),',
    '                        signal: AbortSignal.timeout(4500)',
    '                    });',
    '                    if (!tokenRes.ok) {',
    '                        const errTxt = await tokenRes.text();',
    '                        throw new Error(`令牌获取失败: ${errTxt}`);',
    '                    }',
    '                    const tokenData = await tokenRes.json();',
    '                    accessToken = tokenData.access_token;',
    '                    tokenCache.set(cacheKey, { accessToken, expiresAt: Date.now() + 45 * 60 * 1000 });',
    '                }',
    '            }',
    '            const result = await require("./accountQuota").fetchAccountQuota({',
    '                fetch: net.fetch.bind(net), accessToken,',
    '                projectId: tokenObj.project_id || detail.project_id,',
    '                clientVersion: liveQuota?.appVersion,',
    '                supplementalQuotaSummary: isCurrentAccount ? liveQuota?.summary : null,',
    '                timeoutMs: 6500, requestTimeoutMs: 3000',
    '            });',
    '            if (isCurrentAccount) {',
    '                const latest = JSON.parse(fs.readFileSync(registryPath, "utf8"));',
    '                if (String(latest.current_account_id || "") !== String(accountId)) return { success: false, code: "ACCOUNT_CHANGED", error: "当前账号已改变，请刷新额度" };',
    '            }',
    '            let scopedResult = result;',
    '            try {',
    '                const evidence = require("./argonEvidence");',
    '                const home = require("os").homedir();',
    '                if (result.success && result.capabilities && result.capabilities.argon) {',
    '                    evidence.rememberEvidence(home, accountId, tokenObj.refresh_token, result);',
    '                } else if (result.success) {',
    '                    scopedResult = evidence.decorateQuotaWithEvidence(result, evidence.readEvidence(home, accountId, tokenObj.refresh_token));',
    '                }',
    '            } catch (_) { /* optional local positive evidence cache */ }',
    '            if (scopedResult.success) {',
    '                const cachedAt = Date.now();',
    '                quotaCacheMod.writeCachedQuota({ accountRoot, accountId, refreshToken: tokenObj.refresh_token, result: scopedResult, now: cachedAt });',
    '                scopedResult = { ...scopedResult, fromCache: false, cachedAt, quotaCacheVersion: 1 };',
    '            }',
    '            return scopedResult;'
  ].join('\n'), 'shared per-account quota query');
  output = replaceBetween(output, '    // 注入：export-local-account', '    // Accounts switch handler', `
    require('./accountTransfer').registerAccountTransferIpc({
        ipcMain: electron_1.ipcMain, safeStorage: electron_1.safeStorage,
        dialog: electron_1.dialog
    });
`, 'shared account file transfer');
  return addNativeSwitchRequestBridge(output);
}

function hardenAccountSwitch(source) {
  const output = String(source || '');
  const startMarker = '            // Kill old language_server.exe immediately to free up gRPC ports before relaunch';
  const returnMarker = '            return { success: true };';
  const start = output.indexOf(startMarker);
  if (start < 0) {
    if (output.includes('[Account Switch] Relaunching the full Antigravity process')) return output;
    throw new Error('Legacy accounts:switch lifecycle block is missing');
  }
  const end = output.indexOf(returnMarker, start);
  if (end < 0) throw new Error('Legacy accounts:switch return marker is missing');
  const safeLifecycle = [
    '            // Restart the whole Electron process so the Language Server crash counter is reset.',
    "            console.log('[Account Switch] Relaunching the full Antigravity process after credential update.');",
    '            setTimeout(() => {',
    '                global.isQuitting = true;',
    '                electron_1.app.relaunch();',
    '                electron_1.app.exit(0);',
    '            }, 250);',
    '            '
  ].join('\n');
  let hardened = `${output.slice(0, start)}${safeLifecycle}${output.slice(end)}`;
  hardened = hardened.replace(/\s*try \{\s*execSync\('taskkill \/F \/IM language_server\.exe'\);\s*\} catch \(e\) \{\}/g, '');
  hardened = hardened.replace(/win\.reload\(\);/g, "global.isQuitting = true;\n                    electron_1.app.relaunch();\n                    electron_1.app.exit(0);");
  return hardened;
}

function addNativeSwitchRequestBridge(source) {
  const output = String(source || '');
  const startMarker = "    electron_1.ipcMain.handle('accounts:switch', async (_event, accountId) => {";
  const endMarker = '    // Debug logging helper';
  requireSingleAnchor(output, startMarker, 'native account switch handler');
  requireSingleAnchor(output, endMarker, 'native account switch bridge insertion');
  const start = output.indexOf(startMarker);
  const end = output.indexOf(endMarker, start);
  const handlerBlock = output.slice(start, end);
  const closeMarker = '\n    });';
  const close = handlerBlock.lastIndexOf(closeMarker);
  if (close < 0 || handlerBlock.slice(close + closeMarker.length).trim()) {
    throw new Error('Native account switch handler end changed unexpectedly');
  }
  const handlerBody = handlerBlock.slice(startMarker.length, close);
  const replacement = `    const agyPerformNativeAccountSwitch = async (accountId) => {${handlerBody}
    };
    electron_1.ipcMain.handle('accounts:switch', async (_event, accountId) => agyPerformNativeAccountSwitch(accountId));

    // AGY Hub asks the running Antigravity main process to execute the same
    // account switch as the injected dialog. Only account ids and a one-time
    // nonce cross this user-local bridge; OAuth tokens never do.
    (function installAgyNativeSwitchRequestBridge() {
        const fsSync = require('fs');
        const bridgePath = require('path');
        const bridgeOs = require('os');
        const bridgeRoot = bridgePath.join(bridgeOs.homedir(), '.gemini', 'antigravity', 'tools');
        const requestPath = bridgePath.join(bridgeRoot, '.agy-native-switch-request.json');
        const responsePath = bridgePath.join(bridgeRoot, '.agy-native-switch-response.json');
        let busy = false;
        const removeQuietly = filePath => { try { fsSync.rmSync(filePath, { force: true }); } catch (_) {} };
        const writeResponse = value => {
            const tempPath = responsePath + '.' + process.pid + '.' + Date.now() + '.tmp';
            try {
                fsSync.writeFileSync(tempPath, JSON.stringify(value) + '\\n', { encoding: 'utf8', mode: 0o600 });
                fsSync.renameSync(tempPath, responsePath);
            } catch (error) {
                removeQuietly(tempPath);
                console.warn('[AGY Account Bridge] response write failed:', error && error.message ? error.message : error);
            }
        };
        const poll = async () => {
            if (busy || !fsSync.existsSync(requestPath)) return;
            let request;
            try { request = JSON.parse(fsSync.readFileSync(requestPath, 'utf8').replace(/^\\uFEFF/, '')); }
            catch (_) { removeQuietly(requestPath); return; }
            const valid = request
                && request.protocol === 1
                && /^[a-f0-9]{24,64}$/i.test(String(request.nonce || ''))
                && /^[A-Za-z0-9_-]{1,128}$/.test(String(request.accountId || ''))
                && Number.isFinite(Number(request.createdAt))
                && Math.abs(Date.now() - Number(request.createdAt)) <= 30000;
            removeQuietly(requestPath);
            if (!valid) return;
            busy = true;
            try {
                const result = await agyPerformNativeAccountSwitch(String(request.accountId));
                writeResponse({ protocol: 1, nonce: String(request.nonce), success: Boolean(result && result.success), error: result && result.error ? String(result.error) : '', restartScheduled: Boolean(result && result.success), completedAt: Date.now() });
            } catch (error) {
                writeResponse({ protocol: 1, nonce: String(request.nonce), success: false, error: String(error && error.message ? error.message : error), restartScheduled: false, completedAt: Date.now() });
            } finally {
                busy = false;
            }
        };
        const timer = setInterval(poll, 200);
        if (timer && typeof timer.unref === 'function') timer.unref();
        poll();
    })();

`;
  return `${output.slice(0, start)}${replacement}${output.slice(end)}`;
}

function assertOfficialLanguageServerRouting(source) {
  const usesOfficialDefaults = /\blsDefaults_1\.baseLsArgs\b/.test(source);
  const hasExplicitOfficialEndpoints = source.includes('https://generativelanguage.googleapis.com')
    && source.includes('https://daily-cloudcode-pa.googleapis.com');
  if (!usesOfficialDefaults && !hasExplicitOfficialEndpoints) {
    throw new Error('languageServer official endpoint configuration is unrecognized');
  }
}

function buildLanguageServerStartOverlay(officialStart) {
  let output = officialStart;
  requireSingleAnchor(output, 'function startLanguageServer(', 'official languageServer start function');
  assertOfficialLanguageServerRouting(output);

  if (!/\basync\s+function\s+startLanguageServer\s*\(/.test(output)) {
    output = output.replace('function startLanguageServer(', 'async function startLanguageServer(');
  }
  const signatureEnd = output.indexOf('\n');
  if (signatureEnd < 0) throw new Error('Official languageServer start function signature is incomplete');
  const signature = output.slice(0, signatureEnd);
  output = insertAfter(output, signature, [
    '    let proxyString = null;',
    '    try {',
    "        proxyString = await electron_1.session.defaultSession.resolveProxy('https://generativelanguage.googleapis.com').catch(() => null);",
    '    } catch (err) {',
    "        console.warn('[Proxy Auto-Detect] Failed to resolve system proxy; official endpoints remain active:', err && err.message ? err.message : err);",
    '    }',
    "    console.log('[Network] Language Server keeps official API endpoints; token monitoring is out-of-band.');"
  ].join('\n'), 'languageServer routing overlay');

  // Antigravity 2.29 moved shell environment loading to an async prefetch flow.
  // Match the semantic environment merge inside startLanguageServer instead of
  // tying the overlay to either shellEnvSync() or takeShellEnv(). Keep the
  // match deliberately narrow so an unknown future spawn layout fails safely.
  const envPattern = /^([ \t]*)(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\{\s*\.\.\.process\.env\s*,\s*\.\.\.[^;\r\n]+\};[ \t]*$/gm;
  const envMatches = [...output.matchAll(envPattern)];
  if (envMatches.length !== 1) {
    throw new Error(`languageServer process environment merge expected exactly once but found ${envMatches.length}`);
  }
  const envMatch = envMatches[0];
  const indent = envMatch[1];
  const envName = envMatch[2];
  const envAnchor = envMatch[0];
  const proxyOverlay = [
    `${indent}if (proxyString && typeof proxyString === 'string') {`,
    `${indent}    const proxyPart = proxyString.split(';').map(part => part.trim()).find(part => /^(?:PROXY|HTTPS?)\\s+/i.test(part));`,
    `${indent}    if (proxyPart) {`,
    `${indent}        const match = /^(?:PROXY|HTTPS?)\\s+(.+)$/i.exec(proxyPart);`,
    `${indent}        const addr = match && match[1] ? match[1].trim() : '';`,
    `${indent}        if (addr && !/(?:^|:)3100[01]$/.test(addr)) {`,
    `${indent}            ${envName}['HTTP_PROXY'] = \`http://\${addr}\`;`,
    `${indent}            ${envName}['HTTPS_PROXY'] = \`http://\${addr}\`;`,
    `${indent}            console.log(\`[Proxy Auto-Detect] Set HTTP_PROXY/HTTPS_PROXY = http://\${addr}\`);`,
    `${indent}        } else if (addr) {`,
    `${indent}            console.warn(\`[Proxy Auto-Detect] Ignored token-monitor endpoint \${addr}; keeping core networking independent.\`);`,
    `${indent}        }`,
    `${indent}    }`,
    `${indent}}`
  ].join('\n');
  output = insertAfter(output, envAnchor, proxyOverlay, 'languageServer proxy environment overlay');
  return output;
}

function buildLanguageServer(official, legacy) {
  const nativeCsrf = official.includes('exports.getLsCsrfToken = getLsCsrfToken;');
  let output = insertAfter(official, 'exports.getLsPort = getLsPort;', nativeCsrf ? 'exports.getLsCsrf = getLsCsrfToken;' : 'exports.getLsCsrf = getLsCsrf;', 'languageServer export');
  if (!nativeCsrf) {
  output = insertAfter(output, 'let _lsPort = 0;', "let _lsCsrf = '';", 'languageServer csrf state');
  const getter = extractBetween(legacy, 'function getLsCsrf() {', '/** Clears the language server process reference', 'languageServer csrf getter');
  output = insertBefore(output, '/** Clears the language server process reference', getter, 'languageServer csrf getter target');
  }
  const asyncStartAnchor = 'async function startLanguageServer(';
  const syncStartAnchor = 'function startLanguageServer(';
  const startAnchor = countHits(output, asyncStartAnchor) === 1 ? asyncStartAnchor : syncStartAnchor;
  const officialStart = extractBetween(output, startAnchor, '/** Sets whether the termination was intentional', 'official startLanguageServer');
  const overlaidStart = buildLanguageServerStartOverlay(officialStart);
  output = replaceBetween(output, startAnchor, '/** Sets whether the termination was intentional', overlaidStart, 'official startLanguageServer');
  if (!nativeCsrf) output = insertAfter(output, '    setIntentionalTermination(false); // Reset', '    _lsCsrf = csrf;', 'languageServer csrf assignment');
  return output;
}

function syntaxCheck(relativePath, source) {
  new vm.Script(source, { filename: relativePath });
}

function assertUniqueIpcHandlers(relativePath, source) {
  const channels = new Map();
  const pattern = /ipcMain\.handle\(\s*(['"])([^'"]+)\1/g;
  for (const match of source.matchAll(pattern)) {
    channels.set(match[2], (channels.get(match[2]) || 0) + 1);
  }
  const duplicates = [...channels.entries()].filter(([, count]) => count > 1);
  if (duplicates.length) {
    throw new Error(`${relativePath} registers duplicate ipcMain handlers: ${duplicates.map(([name, count]) => `${name} (${count})`).join(', ')}`);
  }
}

function buildCompatibleTree(options) {
  const { officialDir, legacyDir, runtimeRules = [] } = options;
  const files = {
    'dist/preload.js': buildPreload,
    'dist/main.js': buildMain,
    'dist/tray.js': buildTray,
    'dist/utils.js': buildUtils,
    'dist/ipcHandlers.js': buildIpcHandlers,
    'dist/languageServer.js': buildLanguageServer
  };
  const report = { files: [], appliedRuntimeRules: [] };
  for (const [relativePath, builder] of Object.entries(files)) {
    const officialPath = path.join(officialDir, ...relativePath.split('/'));
    const legacyPath = path.join(legacyDir, ...relativePath.split('/'));
    if (!fs.existsSync(officialPath)) throw new Error(`Official client is missing required capability: ${relativePath}`);
    if (!fs.existsSync(legacyPath)) throw new Error(`Legacy payload is missing: ${relativePath}`);
    const normalizeSource = source => source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const official = normalizeSource(fs.readFileSync(officialPath, 'utf8'));
    const legacy = normalizeSource(fs.readFileSync(legacyPath, 'utf8'));
    let rebuilt = builder(official, legacy, relativePath === 'dist/main.js' ? fs.readFileSync(path.join(legacyDir,'dist/preload.js'),'utf8') : undefined);
    const ruled = applyLiteralRules(rebuilt, runtimeRules, relativePath);
    rebuilt = ruled.source;
    syntaxCheck(relativePath, rebuilt);
    if (relativePath === 'dist/tray.js') assertTrayModuleLoads(rebuilt, official);
    assertUniqueIpcHandlers(relativePath, rebuilt);
    fs.writeFileSync(officialPath, rebuilt, 'utf8');
    report.appliedRuntimeRules.push(...ruled.applied);
    report.files.push({ file: relativePath, officialBytes: Buffer.byteLength(official), rebuiltBytes: Buffer.byteLength(rebuilt) });
  }
  const legacyVault = path.join(legacyDir, 'dist', 'accountVault.js');
  if (fs.existsSync(legacyVault)) {
    const targetVault = path.join(officialDir, 'dist', 'accountVault.js');
    fs.copyFileSync(legacyVault, targetVault);
    syntaxCheck('dist/accountVault.js', fs.readFileSync(targetVault, 'utf8'));
    report.files.push({ file: 'dist/accountVault.js', addedByPatch: true, rebuiltBytes: fs.statSync(targetVault).size });
  }
  const quotaSource = readPatchWorkbenchResource('accountQuota.js');
  syntaxCheck('dist/accountQuota.js', quotaSource);
  fs.writeFileSync(path.join(officialDir, 'dist', 'accountQuota.js'), quotaSource, 'utf8');
  report.files.push({ file: 'dist/accountQuota.js', addedByPatch: true, rebuiltBytes: Buffer.byteLength(quotaSource) });
  const quotaCacheSource = readPatchWorkbenchResource('accountQuotaCache.js');
  syntaxCheck('dist/accountQuotaCache.js', quotaCacheSource);
  fs.writeFileSync(path.join(officialDir, 'dist', 'accountQuotaCache.js'), quotaCacheSource, 'utf8');
  report.files.push({ file: 'dist/accountQuotaCache.js', addedByPatch: true, rebuiltBytes: Buffer.byteLength(quotaCacheSource) });
  const evidenceSource = readPatchWorkbenchResource('argonEvidence.js');
  syntaxCheck('dist/argonEvidence.js', evidenceSource);
  fs.writeFileSync(path.join(officialDir, 'dist', 'argonEvidence.js'), evidenceSource, 'utf8');
  report.files.push({ file: 'dist/argonEvidence.js', addedByPatch: true, rebuiltBytes: Buffer.byteLength(evidenceSource) });
  const quotaBridgeSource = readPatchWorkbenchResource('antigravityQuotaBridge.js');
  syntaxCheck('dist/antigravityQuotaBridge.js', quotaBridgeSource);
  fs.writeFileSync(path.join(officialDir, 'dist', 'antigravityQuotaBridge.js'), quotaBridgeSource, 'utf8');
  report.files.push({ file: 'dist/antigravityQuotaBridge.js', addedByPatch: true, rebuiltBytes: Buffer.byteLength(quotaBridgeSource) });
  const transferSource = readPatchWorkbenchResource('accountTransfer.js');
  syntaxCheck('dist/accountTransfer.js', transferSource);
  fs.writeFileSync(path.join(officialDir, 'dist', 'accountTransfer.js'), transferSource, 'utf8');
  report.files.push({ file: 'dist/accountTransfer.js', addedByPatch: true, rebuiltBytes: Buffer.byteLength(transferSource) });
  return report;
}

module.exports = {
  normalizeVersion,
  countHits,
  insertIntoFunctionBody,
  applyLiteralRules,
  buildCompatibleTree,
  buildPreload,
  stripLegacyPatchUpdater,
  stripLegacyPatchUpdaterIpc,
  addDeveloperModeGate,
  buildMain,
  buildNativeLocalization,
  buildTray,
  assertTrayModuleLoads,
  buildUtils,
  buildIpcHandlers,
  createQuotaSnapshotState,
  hardenAccountSwitch,
  addNativeSwitchRequestBridge,
  enhanceNativeLanguageServerQuota,
  buildLanguageServer,
  buildLanguageServerStartOverlay,
  assertOfficialLanguageServerRouting,
  assertUniqueIpcHandlers
};
