const fs = require('fs');
const path = require('path');
const os = require('os');
const { classifyAccountError } = require('./accountErrorClassifier.js');
const { readJsonSafe, writeJsonAtomic } = require('./fsUtils.js');
const { fetchAccountQuota, parseQuotaSummary } = require('./accountQuota.js');
const { fetchLiveQuotaSummary, fetchLiveAvailableModels, clearQuotaBridgeCache } = require('./antigravityQuotaBridge.js');
const { setModelsForAccount } = require('./accountModelAvailability.js');
const { captureAntigravityModelCatalog, describeAntigravityModels } = require('./antigravityModelCatalog.js');
const { writeWindowsAntigravityCredential } = require('./windowsAccountCredential.js');
const { readEvidence, rememberEvidence, decorateQuotaWithEvidence } = require('./argonEvidence.js');
const { readCachedQuota, writeCachedQuota } = require('./accountQuotaCache.js');
const { requestNativeAccountSwitch } = require('./antigravitySwitchBridge.js');

function normalizeAccountEmail(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
}

function getGoogleClientId() {
  const p1 = 'MTA3MTAwNjA2MDU5MS10bWhzc2lu';
  const p2 = 'MmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==';
  return Buffer.from(p1 + p2, 'base64').toString('utf8');
}

function getGoogleClientSecret() {
  const s1 = 'R09DU1BYLUs1';
  const s2 = 'OEZXUjQ4NkxkTEoxbUxCOHNYQzR6NnFEQWY=';
  return Buffer.from(s1 + s2, 'base64').toString('utf8');
}

async function restartAntigravityClient(options = {}) {
  const platform = options.platform || process.platform;
  if (platform !== 'win32') return { restarted: false, restartRequired: true };
  const { execFile, spawn } = require('child_process');
  const fsModule = options.fsModule || fs;
  const sleep = options.sleep || (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const run = options.run || ((file, args, timeout = 10000) => new Promise(resolve => {
    (options.execFile || execFile)(file, args, { windowsHide: true, timeout, maxBuffer: 1024 * 1024 }, (error, stdout = '') => {
      resolve({ error, stdout: String(stdout) });
    });
  }));
  const launchDetached = options.launchDetached || ((executable, args) => new Promise((resolve, reject) => {
    const child = (options.spawn || spawn)(executable, args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  }));

  // Preserve the exact main-process argv. Starting Antigravity.exe with an
  // empty argument list can select another profile and show the login page.
  const queryScript = String.raw`
$ErrorActionPreference = 'Stop'
$p = Get-CimInstance Win32_Process -Filter "Name='Antigravity.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -notmatch '--type=' } |
  Select-Object -First 1
if (-not $p) { Write-Output '{"running":false}'; exit 0 }
$definition = @'
using System;
using System.Runtime.InteropServices;
public static class AgyCommandLineParser {
  [DllImport("shell32.dll", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern IntPtr CommandLineToArgvW(string commandLine, out int argc);
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern IntPtr LocalFree(IntPtr memory);
}
'@
Add-Type -TypeDefinition $definition
$argc = 0
$ptr = [AgyCommandLineParser]::CommandLineToArgvW([string]$p.CommandLine, [ref]$argc)
try {
  $argv = @()
  for ($i = 0; $i -lt $argc; $i++) {
    $argv += [Runtime.InteropServices.Marshal]::PtrToStringUni([Runtime.InteropServices.Marshal]::ReadIntPtr($ptr, $i * [IntPtr]::Size))
  }
  [pscustomobject]@{ running=$true; pid=[int]$p.ProcessId; executable=[string]$p.ExecutablePath; argv=$argv } | ConvertTo-Json -Compress -Depth 4
} finally {
  if ($ptr -ne [IntPtr]::Zero) { [void][AgyCommandLineParser]::LocalFree($ptr) }
}`;
  const query = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(queryScript, 'utf16le').toString('base64')]);
  if (query.error) throw new Error('无法读取 Antigravity 原启动参数，已取消切换以保护登录状态');
  let launchInfo;
  try { launchInfo = JSON.parse(query.stdout.trim()); }
  catch (_) { throw new Error('无法解析 Antigravity 启动参数，已取消切换以保护登录状态'); }
  if (!launchInfo.running) return { restarted: false, restartRequired: false, willApplyOnNextLaunch: true };

  const pid = Number(launchInfo.pid);
  const executable = launchInfo.executable || path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Programs', 'Antigravity', 'Antigravity.exe');
  const args = Array.isArray(launchInfo.argv) ? launchInfo.argv.slice(1) : [];
  if (!Number.isInteger(pid) || pid <= 0 || path.basename(executable).toLowerCase() !== 'antigravity.exe' || !fsModule.existsSync(executable)) {
    throw new Error('Antigravity 主进程信息不完整，已取消切换以保护登录状态');
  }

  const isRunning = async () => {
    const check = await run('tasklist.exe', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], 3000);
    return check.stdout.includes(`"${pid}"`);
  };
  const waitForExit = async (waitMs) => {
    const attempts = Math.max(1, Math.ceil(waitMs / 250));
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!(await isRunning())) return true;
      await sleep(250);
    }
    return !(await isRunning());
  };

  // Account switching is an explicit restart operation. Antigravity's normal
  // close is intercepted by its background/tray preference, so terminate only
  // the verified main PID and its own child tree, then relaunch with the exact
  // original argv. Never kill by image name.
  const forcedTermination = true;
  await run('taskkill.exe', ['/PID', String(pid), '/T', '/F'], 8000);
  const exited = await waitForExit(Number(options.forceWaitMs) || 10000);
  if (!exited) throw new Error('Antigravity 主进程未能退出，账号切换已回滚；请从 Antigravity 内置账号窗口重试');

  try {
    await launchDetached(executable, args);
    return { restarted: true, restartRequired: false, preservedLaunchArguments: true, forcedTermination };
  } catch (_) {
    // The new account is already committed and the old process has exited.
    return { restarted: false, restartRequired: true, preservedLaunchArguments: true, forcedTermination, error: '账号已切换，但自动启动失败；请手动打开 Antigravity' };
  }
}

async function isAntigravityClientRunning(options = {}) {
  if ((options.platform || process.platform) !== 'win32') return false;
  const { execFile } = require('child_process');
  const run = options.run || ((file, args) => new Promise(resolve => {
    (options.execFile || execFile)(file, args, { windowsHide: true, timeout: 3000, maxBuffer: 256 * 1024 }, (error, stdout = '') => {
      resolve({ error, stdout: String(stdout) });
    });
  }));
  const result = await run('tasklist.exe', ['/FI', 'IMAGENAME eq Antigravity.exe', '/FO', 'CSV', '/NH']);
  return !result.error && /Antigravity\.exe/i.test(result.stdout);
}

function registerAccountIpc(options) {
  const { ipcMain, app, net, safeStorage, getMainWindow } = options;
  const writeCredential = options.writeCredential || writeWindowsAntigravityCredential;
  const restartClient = options.restartClient || restartAntigravityClient;
  const isClientRunning = options.isClientRunning || isAntigravityClientRunning;
  const nativeSwitch = options.nativeSwitch || requestNativeAccountSwitch;

  function accountTokenFromDetail(detail) {
    if (!detail || typeof detail !== 'object') return null;
    let candidates = [
      detail.token, detail.account_token, detail.accountToken,
      detail.credentials?.token, detail.auth?.token, detail.keyring?.token, detail.login?.token
    ];
    if (detail.token_encrypted && safeStorage && typeof safeStorage.decryptString === 'function') {
      try {
        candidates.push(JSON.parse(safeStorage.decryptString(Buffer.from(detail.token_encrypted, 'base64'))));
      } catch (_) {}
    }
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const token = { ...candidate };
      if (!token.access_token && typeof token.accessToken === 'string') token.access_token = token.accessToken;
      if (!token.refresh_token && typeof token.refreshToken === 'string') token.refresh_token = token.refreshToken;
      if (!token.expiry_timestamp && token.expiry) {
        const parsed = Date.parse(token.expiry);
        if (!Number.isNaN(parsed)) token.expiry_timestamp = Math.floor(parsed / 1000);
      }
      if (!token.expiry_timestamp && token.expires_at) {
        const parsed = typeof token.expires_at === 'number' ? token.expires_at : Date.parse(token.expires_at) / 1000;
        if (Number.isFinite(parsed)) token.expiry_timestamp = Math.floor(parsed);
      }
      if (!token.expiry_timestamp) token.expiry_timestamp = Math.floor(Date.now() / 1000) + Number(token.expires_in || 3599);
      if (!token.token_type) token.token_type = 'Bearer';
      if (token.access_token && token.refresh_token) return token;
    }
    return null;
  }

function getGoogleClientId() {
    const p1 = 'MTA3MTAwNjA2MDU5MS10bWhzc2lu';
    const p2 = 'MmgyMWxjcmUyMzV2dG9sb2poNGc0MDNlcC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==';
    return Buffer.from(p1 + p2, 'base64').toString('utf8');
  }
  
  function getGoogleClientSecret() {
    const s1 = 'R09DU1BYLUs1';
    const s2 = 'OEZXUjQ4NkxkTEoxbUxCOHNYQzR6NnFEQWY=';
    return Buffer.from(s1 + s2, 'base64').toString('utf8');
  }
  
  // 读取 Antigravity 本地账号元数据。Token 永远不会离开主进程。
  ipcMain.handle('list-local-accounts', async () => {
    try {
      const accountRoot = path.join(app.getPath('home'), '.gemini/antigravity/tools');
      const registryPath = path.join(accountRoot, 'accounts.json');
      const detailRoot = path.join(accountRoot, 'accounts');
  
      if (!fs.existsSync(accountRoot)) {
        fs.mkdirSync(accountRoot, { recursive: true });
      }
      if (!fs.existsSync(detailRoot)) {
        fs.mkdirSync(detailRoot, { recursive: true });
      }
  
      let registry = readJsonSafe(registryPath, { accounts: [], current_account_id: '' }, { preserveCorrupted: true });
      if (!Array.isArray(registry.accounts)) {
        registry.accounts = [];
      }
  
      let dirty = false;
  
      // 🌟 自动全盘扫描 accounts 物理文件夹下的所有 *.json 文件，实现客户端/小助手双向自动反向同步与补全！
      const fileAccountMap = new Map(); // email.toLowerCase() -> 最新的物理凭据信息
      if (fs.existsSync(detailRoot)) {
        const files = fs.readdirSync(detailRoot).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const fileId = path.basename(file, '.json');
          const detailPath = path.join(detailRoot, file);
          try {
            const stat = fs.statSync(detailPath);
            const detail = readJsonSafe(detailPath, null, { preserveCorrupted: true });
            if (!detail) continue;
            let tokenObj = null;
            if (detail.token_storage === 'electron-safe-storage-v1' && typeof detail.token_encrypted === 'string') {
              try {
                const decrypted = safeStorage.decryptString(Buffer.from(detail.token_encrypted, 'base64'));
                tokenObj = JSON.parse(decrypted);
              } catch (_) {}
            }
            if (!tokenObj) tokenObj = detail.token;
  
            if (tokenObj && tokenObj.refresh_token) {
              const rawEmail = detail.email || tokenObj.email || '';
              const email = normalizeAccountEmail(rawEmail).slice(0, 254);
              if (!email) continue;
  
              const fallbackName = email.includes('@') ? email.split('@')[0] : '未命名账号';
              const name = String(detail.name || fallbackName).slice(0, 80);
  
              const existing = fileAccountMap.get(email.toLowerCase());
              if (!existing || stat.mtimeMs > existing.mtimeMs) {
                fileAccountMap.set(email.toLowerCase(), {
                  id: fileId,
                  email,
                  name,
                  mtimeMs: stat.mtimeMs
                });
              }
            }
          } catch (_) {}
        }
      }
  
      // 根据全量最新物理文件重新建构/平滑同步 registry.accounts 列表
      const newAccountsList = [];
      const processedEmails = new Set();
  
      // 先保留并更新已在 registry.accounts 中的有效账号（将 ID 自动提速更新为最新的物理文件 ID）
      for (const entry of Array.isArray(registry.accounts) ? registry.accounts : []) {
        const entryEmail = normalizeAccountEmail(entry.email || '').toLowerCase();
        if (!entryEmail) continue;
  
        const newestPhysical = fileAccountMap.get(entryEmail);
        if (newestPhysical) {
          if (!processedEmails.has(entryEmail)) {
            if (entry.id !== newestPhysical.id) dirty = true;
            newAccountsList.push({
              id: newestPhysical.id,
              email: newestPhysical.email,
              name: entry.name || newestPhysical.name
            });
            processedEmails.add(entryEmail);
          }
        }
      }
  
      // 再追加全新的物理账号文件（客户端中刚刚登录的新邮箱账号）
      for (const [emailKey, physical] of fileAccountMap.entries()) {
        if (!processedEmails.has(emailKey)) {
          newAccountsList.push({
            id: physical.id,
            email: physical.email,
            name: physical.name
          });
          processedEmails.add(emailKey);
          dirty = true;
        }
      }
  
      registry.accounts = newAccountsList;
  
      const currentAccountId = typeof registry.current_account_id === 'string'
        ? registry.current_account_id
        : '';
      
      const validAccounts = [];
  
      for (const entry of Array.isArray(registry.accounts) ? registry.accounts : []) {
        if (!entry || typeof entry.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(entry.id)) {
          dirty = true;
          continue;
        }
  
        let detail = {};
        const detailPath = path.join(detailRoot, `${entry.id}.json`);
        let hasDetailFile = false;
        try {
          if (fs.existsSync(detailPath)) {
            detail = readJsonSafe(detailPath, null, { preserveCorrupted: true }) || {};
            hasDetailFile = Object.keys(detail).length > 0;
          }
        } catch (_) {}
  
        // 提取 Token，判断凭证是否存在
        let tokenObj = null;
        if (detail.token_storage === 'electron-safe-storage-v1' && typeof detail.token_encrypted === 'string') {
          try {
            const decrypted = safeStorage.decryptString(Buffer.from(detail.token_encrypted, 'base64'));
            tokenObj = JSON.parse(decrypted);
          } catch (_) {}
        }
        if (!tokenObj) tokenObj = detail.token;
  
        const hasRefreshToken = tokenObj && tokenObj.refresh_token;
  
        // 如果物理凭据文件丢失，或者凭据中没有 refresh_token，视为废弃账证！
        if (!hasDetailFile || !hasRefreshToken) {
          // 如果它不是当前正在使用的账号，在物理和逻辑上彻底删除它！
          if (entry.id !== currentAccountId) {
            dirty = true;
            try {
              if (hasDetailFile) {
                fs.unlinkSync(detailPath);
              }
            } catch (_) {}
            continue; // 不放入活下来的列表
          }
        }
  
        const email = normalizeAccountEmail(entry.email || detail.email || '').slice(0, 254);
        const fallbackName = email.includes('@') ? email.split('@')[0] : '未命名账号';
        const name = String(entry.name || detail.name || fallbackName).slice(0, 80);
        
        let storageState = 'missing';
        if (!hasRefreshToken) {
          storageState = 'missing';
        } else if (
          detail.token_storage === 'electron-safe-storage-v1' &&
          typeof detail.token_encrypted === 'string' &&
          detail.token_encrypted.length > 0
        ) {
          storageState = 'encrypted';
        } else {
          storageState = 'legacy';
        }
  
        validAccounts.push({
          id: entry.id,
          name,
          email,
          current: entry.id === currentAccountId,
          storageState
        });
      }
  
      // 如果发现废弃僵尸账号并完成了物理剔除，重新覆写 accounts.json
      if (dirty) {
        registry.accounts = registry.accounts.filter(acc => 
          validAccounts.some(v => v.id === acc.id) || acc.id === currentAccountId
        );
        writeJsonAtomic(registryPath, registry);
        console.log("[CleanUp] Successfully purged discarded zombie account credentials from registry.");
      }
  
      validAccounts.sort((left, right) => {
        if (left.current !== right.current) return left.current ? -1 : 1;
        return left.email.localeCompare(right.email, 'zh-CN');
      });
  
      return { success: true, accounts: validAccounts, currentAccountId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
  
  // ==========================================
  // 网页与桌面结合：Cloudflare Pages 互通接口
  // ==========================================
  let oauthServer = null;
  let currentOauthState = null;
  const oauthTokenCache = new Map();
  
  // A. 注入 fetch-account-quota 用以向小助手卡片拉取配额
  ipcMain.handle('fetch-account-quota', async (event, request) => {
    let fallbackCachedQuota = null;
    try {
      const quotaRequest = request && typeof request === 'object' ? request : { accountId: request };
      const accountId = String(quotaRequest.accountId || '');
      const force = quotaRequest.force === true;
      if (typeof accountId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) throw new Error('无效账号 ID');
      const userHome = app.getPath('home');
      const accountRoot = path.join(userHome, '.gemini/antigravity/tools');
      const registry = readJsonSafe(path.join(accountRoot, 'accounts.json'), { current_account_id: '' }, { preserveCorrupted: true });
      const isCurrentAccount = String(registry?.current_account_id || '') === accountId;
      // Respect the home directory owning this account registry. In tests and
      // Windows multi-user environments, APPDATA can refer to another user.
      const roaming = path.join(userHome, 'AppData', 'Roaming');
      const envRoaming = process.env.APPDATA || '';
      const localAppData = envRoaming && path.resolve(envRoaming).toLowerCase().startsWith(path.resolve(userHome).toLowerCase() + path.sep)
        ? envRoaming : roaming;
      const detailPath = path.join(accountRoot, 'accounts', `${accountId}.json`);
      if (!fs.existsSync(detailPath)) {
        throw new Error('凭证文件缺失');
      }
      const detail = readJsonSafe(detailPath, null, { preserveCorrupted: true });
      if (!detail) throw new Error('账号凭据损坏，请重新登录授权');
      
      let tokenObj;
      if (detail.token_storage === 'electron-safe-storage-v1' && typeof detail.token_encrypted === 'string') {
        try {
          const decrypted = safeStorage.decryptString(Buffer.from(detail.token_encrypted, 'base64'));
          tokenObj = JSON.parse(decrypted);
        } catch (e) {
          console.error('[fetch-quota] Failed to decrypt safe token:', e);
        }
      }
      if (!tokenObj) tokenObj = detail.token;
  
      if (!tokenObj || !tokenObj.refresh_token) {
        throw new Error('无有效刷新令牌');
      }

      fallbackCachedQuota = readCachedQuota({ accountRoot, accountId, refreshToken: tokenObj.refresh_token });
      if (!force) {
        if (fallbackCachedQuota) return fallbackCachedQuota;
      }

      // Only a cache miss or an explicit refresh performs live I/O. Inactive
      // accounts remain scoped to their own OAuth token; the active account may
      // also use its Language Server as a supplemental source.
      const liveQuotaPromise = isCurrentAccount
        ? fetchLiveQuotaSummary({ appData: localAppData, cacheKey: accountId, timeoutMs: 2200, maxAttempts: 2 }).catch(() => null)
        : Promise.resolve(null);
  
      const liveQuota = await liveQuotaPromise;
      const localSummaryQuota = isCurrentAccount && liveQuota?.summary ? parseQuotaSummary(liveQuota.summary) : {};
      const hasCompleteLocalQuota = ['gemini5h', 'geminiWeekly', 'claude5h', 'claudeWeekly']
        .every(field => localSummaryQuota[field] !== undefined);

      let accessToken = 'local-language-service';
      try {
        // Always obtain this account's OAuth access token. A complete local
        // quota summary must not skip the cloud query: Argon is hidden from
        // the desktop Language Server response and only appears under the CLI UA.
        const tokenUrl = 'https://oauth2.googleapis.com/token';
        const params = new URLSearchParams();
        params.append('client_id', getGoogleClientId());
        params.append('client_secret', getGoogleClientSecret());
        params.append('refresh_token', tokenObj.refresh_token);
        params.append('grant_type', 'refresh_token');

        const tokenCacheKey = `${accountId}:${String(tokenObj.refresh_token).slice(-24)}`;
        const cachedToken = oauthTokenCache.get(tokenCacheKey);
        if (cachedToken && Date.now() < cachedToken.expiresAt) {
          accessToken = cachedToken.accessToken;
        } else {
          const tokenRes = await net.fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
            signal: AbortSignal.timeout(4500)
          });
          if (!tokenRes.ok) {
            const errTxt = await tokenRes.text();
            throw new Error(`令牌获取失败: ${errTxt}`);
          }
          const tokenData = await tokenRes.json();
          if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
            throw new Error('OAuth 未返回 access_token');
          }
          accessToken = tokenData.access_token;
          oauthTokenCache.set(tokenCacheKey, { accessToken, expiresAt: Date.now() + 45 * 60 * 1000 });
        }
      } catch (error) {
        if (!hasCompleteLocalQuota) throw error;
        // Keep ordinary local quota usable if OAuth is temporarily unavailable;
        // Cloud Code will fail read-only and the response remains explicitly
        // unconfirmed for any cloud-only quota/model capability.
        console.warn('[fetch-quota] Cloud OAuth refresh failed; using local quota fallback:', error.message);
      }
  
      let quotaResult = await fetchAccountQuota({
        fetch: net.fetch.bind(net), accessToken,
        projectId: tokenObj.project_id || detail.project_id,
        clientVersion: liveQuota?.appVersion,
        supplementalQuotaSummary: isCurrentAccount ? liveQuota?.summary : null,
        timeoutMs: 6500,
        requestTimeoutMs: 3000
      });
      // A slow result from a previous active account must never be rendered
      // after the user switched to another account.
      if (isCurrentAccount) {
        const latest = readJsonSafe(path.join(accountRoot, 'accounts.json'), {}, { preserveCorrupted: true });
        if (String(latest?.current_account_id || '') !== accountId) {
          return { success: false, code: 'ACCOUNT_CHANGED', error: '当前账号已改变，请刷新额度' };
        }
      }
      if (quotaResult.success) {
        if (quotaResult.availableModels?.length) {
          const scoped = setModelsForAccount(accountId, quotaResult.availableModels, 'oauth-cloud');
          if (scoped?.modelIds?.length) quotaResult.availableModels = scoped.modelIds;
        }
        if (isCurrentAccount && !quotaResult.availableModels?.length) {
          try {
            const live = await fetchLiveAvailableModels({ appData: localAppData, timeoutMs: 2200 });
            if (Array.isArray(live.modelIds) && live.modelIds.length) {
              captureAntigravityModelCatalog({ models: Object.fromEntries(live.modelIds.map(id => [id, {}])) }, {
                stateDir: app.getPath('userData'), source: 'local-language-server'
              });
              // Cloud Code is the per-account source of truth. The active
              // Language Server is only a fallback when the cloud catalog is
              // empty; otherwise it could replace another account's model set.
              if (!quotaResult.availableModels?.length) {
                const scoped = setModelsForAccount(accountId, live.modelIds, 'local-language-server');
                quotaResult.availableModels = scoped?.modelIds || live.modelIds;
                quotaResult.availableModelsSource = 'local-language-server';
              }
            }
          } catch (_) { /* current IDE is closed or model metadata is not ready */ }
        }
        if (quotaResult.availableModels?.length) {
          quotaResult.availableModelEntries = describeAntigravityModels(quotaResult.availableModels);
        }
        try {
          if (quotaResult.capabilities?.argon === true && /^\d+%$/.test(String(quotaResult.quota?.argonWeekly || ''))) {
            rememberEvidence(userHome, accountId, tokenObj.refresh_token, quotaResult);
          } else {
            quotaResult = decorateQuotaWithEvidence(
              quotaResult, readEvidence(userHome, accountId, tokenObj.refresh_token)
            );
          }
        } catch (e) {
          // Cache failure must never turn a valid live quota into an error.
          console.warn('[argon-evidence] Positive evidence cache unavailable');
        }
        const cachedAt = Date.now();
        writeCachedQuota({ accountRoot, accountId, refreshToken: tokenObj.refresh_token, result: quotaResult, now: cachedAt });
        quotaResult = { ...quotaResult, fromCache: false, cachedAt, quotaCacheVersion: 1 };
      }
      return quotaResult;
    } catch (err) {
      const accountError = classifyAccountError(err);
      console.warn(`[fetch-quota] ${accountError.code}: ${accountError.diagnosticCode}`);
      if (fallbackCachedQuota && accountError.retryable) {
        return {
          ...fallbackCachedQuota,
          stale: true,
          refreshFailed: true,
          refreshError: accountError.message,
          refreshErrorCode: accountError.code
        };
      }
      return { success: false, error: accountError.message, ...accountError };
    }
  });
  
  // B. 注入 oauth:start-login
  ipcMain.handle('oauth:start-login', async (event) => {
    try {
      const http = require('http');
      const { shell } = require('electron');
      
      const port = await new Promise((resolve) => {
        const srv = http.createServer();
        srv.listen(0, '127.0.0.1', () => {
          const p = srv.address().port;
          srv.close(() => resolve(p));
        });
      });
  
      const state = 'state_' + Math.random().toString(36).substring(2, 10);
      const redirectUri = `http://localhost:${port}/oauth-callback`;
      
      const scopes = [
        'openid',
        'https://www.googleapis.com/auth/cloud-platform',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/cclog',
        'https://www.googleapis.com/auth/experimentsandconfigs'
      ].join(' ');
  
      const client_id = getGoogleClientId();
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;
  
      currentOauthState = {
        port,
        state,
        redirectUri,
        client_id
      };
  
      if (oauthServer) {
        try { oauthServer.close(); } catch(e){}
      }
  
      oauthServer = http.createServer(async (req, res) => {
        const url = require('url');
        const reqUrl = url.parse(req.url, true);
        
        if (reqUrl.pathname === '/oauth-callback') {
          const code = reqUrl.query.code;
          const receivedState = reqUrl.query.state;
          
          if (receivedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>❌ 授权失败</h1><p>CSRF 状态令牌匹配失败，安全验证不通过。</p>');
            return;
          }
          
          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            
            const htmlContent = `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Google 授权成功</title>
    <style>
      body {
        margin: 0; padding: 0; display: flex; justify-content: center; align-items: center;
        min-height: 100vh; background: #080b11;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #fff; overflow: hidden;
        background-image: 
          radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
          radial-gradient(at 50% 0%, hsla(225,39%,30%,0.2) 0, transparent 50%), 
          radial-gradient(at 100% 0%, hsla(339,49%,30%,0.15) 0, transparent 50%);
      }
      .card {
        background: rgba(255, 255, 255, 0.02);
        backdrop-filter: blur(25px);
        -webkit-backdrop-filter: blur(25px);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 24px; padding: 48px 40px; text-align: center;
        box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
        max-width: 420px; width: 90%; z-index: 10;
        animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .icon-container {
        position: relative; width: 80px; height: 80px; margin: 0 auto 28px;
      }
      .icon-glow {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: linear-gradient(135deg, #00f2fe, #4facfe);
        border-radius: 50%; filter: blur(12px); opacity: 0.55;
        animation: pulse 2.5s infinite alternate;
      }
      .icon {
        position: relative; width: 100%; height: 100%;
        background: linear-gradient(135deg, #00f2fe, #4facfe);
        border-radius: 50%; display: flex; align-items: center; justify-content: center;
        font-size: 36px; color: #fff;
      }
      h1 {
        font-size: 26px; font-weight: 800; margin: 0 0 14px; letter-spacing: -0.5px;
        background: linear-gradient(to right, #ffffff, #c7d2fe);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      }
      p {
        font-size: 14px; color: #94a3b8; line-height: 1.7; margin: 0 0 32px;
      }
      .status {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 8px 18px; background: rgba(34, 197, 94, 0.08);
        color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.2);
        border-radius: 30px; font-size: 12px; font-weight: 600;
        letter-spacing: 0.5px;
      }
      .dot {
        width: 6px; height: 6px; background-color: #22c55e; border-radius: 50%;
        animation: blink 1.2s infinite;
      }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse {
        from { transform: scale(0.95); opacity: 0.4; }
        to { transform: scale(1.1); opacity: 0.7; }
      }
      @keyframes blink {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-container">
        <div class="icon-glow"></div>
        <div class="icon">✓</div>
      </div>
      <h1>Google 授权成功</h1>
      <p>已成功获取 Code 凭据！桌面管家正在后台安全地换取 Token 并为您导入账号，现在可以安全关闭此页面了。</p>
      <div class="status"><span class="dot"></span>正在安全导入中</div>
    </div>
    <script>setTimeout(function(){ window.close(); }, 1800);</script>
  </body>
  </html>`;
            res.end(htmlContent);
            
            const mainWindow = getMainWindow();
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('oauth:code-captured', { code });
            }
  
            setTimeout(() => {
              if (oauthServer) {
                oauthServer.close();
                oauthServer = null;
              }
            }, 1000);
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<h1>❌ 授权失败</h1><p>Google 未返回有效的 Code。</p>');
          }
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
  
      oauthServer.listen(port, '127.0.0.1');
      await shell.openExternal(authUrl);
  
      return { success: true, authUrl, redirectUri };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // C. 注入 oauth:submit-code (修复：取消登录添加账号后主动篡位 current_account_id 的夺权 Bug)
  ipcMain.handle('oauth:submit-code', async (event, codeRaw) => {
    try {
      const { net } = require('electron');
      if (!currentOauthState) {
        throw new Error('未检测到有效的授权会话，请先点击【开始授权链接】。');
      }
  
      if (!codeRaw) {
        throw new Error('接收到的 Authorization Code 为空');
      }
  
      let code = codeRaw.trim();
      if (code.includes('code=')) {
        const match = code.match(/[?&]code=([^&]+)/);
        if (match) {
          code = match[1];
        }
      }
  
      const params = new URLSearchParams();
      params.append('client_id', currentOauthState.client_id);
      params.append('client_secret', getGoogleClientSecret());
      params.append('code', code);
      params.append('redirect_uri', currentOauthState.redirectUri);
      params.append('grant_type', 'authorization_code');
  
      const tokenRes = await net.fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });
  
      if (!tokenRes.ok) {
        const errTxt = await tokenRes.text();
        throw new Error(`Token 兑换失败: ${errTxt}`);
      }
      const tokenData = await tokenRes.json();
  
      if (!tokenData.refresh_token) {
        throw new Error('Google 授权服务未返回长期 refresh_token，请尝试在 Google 账号的安全中心撤销对小助手的授权，然后重新点击【开始 OAuth 授权】登录！');
      }
  
      const userRes = await net.fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      let email = 'unknown@gmail.com';
      let name = 'Google 用户';
      if (userRes.ok) {
        const userData = await userRes.json();
        email = userData.email || email;
        name = userData.name || userData.given_name || email.split('@')[0];
      }
  
      const newId = 'user_' + Date.now() + Math.random().toString(36).substring(2, 6);
      const userHome = os.homedir();
      const accountRoot = path.join(userHome, '.gemini/antigravity/tools');
      const detailRoot = path.join(accountRoot, 'accounts');
      const registryPath = path.join(accountRoot, 'accounts.json');
  
      if (!fs.existsSync(detailRoot)) {
        fs.mkdirSync(detailRoot, { recursive: true });
      }
  
      const detailPath = path.join(detailRoot, `${newId}.json`);
      const newDetail = {
        id: newId,
        email: email,
        name: name,
        token: {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expiry_timestamp: Math.floor(Date.now() / 1000) + tokenData.expires_in
        }
      };
  
      writeJsonAtomic(detailPath, newDetail);
  
      let registry = readJsonSafe(registryPath, { accounts: [], current_account_id: '' }, { preserveCorrupted: true });
      if (!Array.isArray(registry.accounts)) {
        registry.accounts = [];
      }
  
      const existingIndex = registry.accounts.findIndex(acc => acc.email.toLowerCase() === email.toLowerCase());
      if (existingIndex !== -1) {
        const oldId = registry.accounts[existingIndex].id;
        registry.accounts[existingIndex].id = newId;
        registry.accounts[existingIndex].name = name;
        try {
          fs.unlinkSync(path.join(detailRoot, `${oldId}.json`));
        } catch (_) {}
      } else {
        registry.accounts.push({
          id: newId,
          email: email,
          name: name
        });
      }
  
      // 修复：添加账号不应该篡位修改 current_account_id
      // registry.current_account_id = newId; 
      
      writeJsonAtomic(registryPath, registry);
  
      if (oauthServer) {
        try { oauthServer.close(); } catch(e){}
        oauthServer = null;
      }
      currentOauthState = null;
  
      return { success: true, email, name };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  // D. 注入 switch-local-account 以供小助手前台正常切换账号，双击直接热瞬切
  ipcMain.handle('switch-local-account', async (event, accountId) => {
    try {
      if (typeof accountId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(accountId)) throw new Error('无效账号 ID');
      const userHome = app.getPath('home');
      const accountRoot = path.join(userHome, '.gemini/antigravity/tools');
      const registryPath = path.join(accountRoot, 'accounts.json');
  
      if (!fs.existsSync(registryPath)) {
        throw new Error('注册表文件缺失');
      }
  
      let registry = readJsonSafe(registryPath, null, { preserveCorrupted: true });
      if (!registry || !Array.isArray(registry.accounts)) throw new Error('账号索引损坏，请重新登录授权');
      if (!registry.accounts.some(account => String(account.id) === String(accountId))) {
        throw new Error('账号不存在或已被删除');
      }
      if (String(registry.current_account_id || '') === accountId) {
        return { success: true, alreadyCurrent: true, restarted: false };
      }
      const detailPath = path.join(accountRoot, 'accounts', `${accountId}.json`);
      const detail = readJsonSafe(detailPath, null, { preserveCorrupted: true });
      if (!detail) throw new Error('账号凭据文件缺失或损坏，账号未切换');
      const tokenObj = accountTokenFromDetail(detail);
      if (!tokenObj) throw new Error('目标账号凭据无法读取或缺少刷新令牌，账号未切换');
      const previousAccountId = String(registry.current_account_id || '');
      const previousDetail = previousAccountId
        ? readJsonSafe(path.join(accountRoot, 'accounts', `${previousAccountId}.json`), null, { preserveCorrupted: true })
        : null;
      const previousToken = accountTokenFromDetail(previousDetail);
      if (previousAccountId && !previousToken) {
        throw new Error('当前账号凭据不可读取，已取消切换以避免覆盖后无法恢复登录状态');
      }

      // A running Antigravity must perform the switch inside its own Electron
      // process. That is the same path used by the injected account dialog: it
      // updates Credential Manager, commits the registry and calls app.relaunch.
      // Externally killing the process after CredWrite can make the next boot
      // discard the session and show the login page even when the credential is
      // byte-for-byte correct.
      if (await isClientRunning()) {
        const lifecycle = await nativeSwitch({ accountRoot, accountId });
        clearQuotaBridgeCache();
        return { success: true, credentialUpdated: true, ...lifecycle };
      }

      let credentialWritten = false;
      try {
        // When Antigravity is not running there is no in-process bridge to
        // notify. It is safe to stage the native credential and registry for
        // the next launch because no live keyring owner can overwrite them.
        await writeCredential(tokenObj);
        credentialWritten = true;
        registry.current_account_id = accountId;
        writeJsonAtomic(registryPath, registry);
        clearQuotaBridgeCache();
        return { success: true, credentialUpdated: true, restarted: false, restartRequired: false, willApplyOnNextLaunch: true };
      } catch (error) {
        // Before a successful relaunch, roll both sources back together. The
        // restart routine only throws if the original process is still alive
        // or could not be inspected; a launch failure after close is reported
        // as restartRequired and leaves the new account ready for next launch.
        registry.current_account_id = previousAccountId;
        try { writeJsonAtomic(registryPath, registry); } catch (_) {}
        if (credentialWritten && previousToken) {
          try { await writeCredential(previousToken); }
          catch (_) { throw new Error(`${error.message}; 且旧账号凭据回滚失败，请从 Antigravity 内置账号窗口恢复`); }
        }
        clearQuotaBridgeCache();
        throw error;
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  
  
}

module.exports = { normalizeAccountEmail, getGoogleClientId, getGoogleClientSecret, restartAntigravityClient, isAntigravityClientRunning, registerAccountIpc };
