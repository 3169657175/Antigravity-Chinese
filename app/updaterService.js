const { normalizeReleaseNotes, isVersionNewer } = require('./updateUtils.js');
const { RELEASE_REPOSITORY, cleanVersion, releaseTagCandidates, releaseUrl } = require('./releaseConfig.js');
const { classify } = require('./errorDiagnostics.js');

const DOWNLOAD_MAX_ATTEMPTS = 3;
const DOWNLOAD_RETRY_DELAYS_MS = Object.freeze([0, 800, 2000]);

function isRetryableDownloadError(error) {
  const value = `${error?.code || ''} ${error?.message || error || ''}`;
  return /ERR_CONNECTION_(?:CLOSED|RESET|ABORTED|TIMED_OUT)|ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ECONNRESET|ECONNABORTED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network error|fetch failed/i.test(value);
}

function waitForRetry(delayMs) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(delayMs) || 0)));
}

async function downloadUpdateWithRetry(options) {
  const download = options.download;
  const onRetry = options.onRetry || (() => {});
  const sleep = options.sleep || waitForRetry;
  const maxAttempts = Math.max(1, Number(options.maxAttempts) || DOWNLOAD_MAX_ATTEMPTS);
  const retryDelays = options.retryDelays || DOWNLOAD_RETRY_DELAYS_MS;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const files = await download();
      return { files, attempts: attempt };
    } catch (error) {
      if (attempt >= maxAttempts || !isRetryableDownloadError(error)) throw error;
      const delayMs = Math.max(0, Number(retryDelays[attempt] ?? retryDelays.at(-1)) || 0);
      await onRetry({ error, attempt: attempt + 1, maxAttempts, delayMs });
      await sleep(delayMs);
    }
  }
  throw new Error('更新下载未能启动');
}

function registerUpdaterService(options) {
  const { autoUpdater } = require('electron-updater');
  const { ipcMain, app, net, getMainWindow, prepareForUpdate } = options;
  let updateInstallInProgress = false;
  let downloadSequenceActive = false;

  // Prefer NSIS blockmap differential updates. electron-updater automatically
  // falls back to the complete installer when either blockmap is unavailable,
  // so a Release missing its sidecar remains installable without forcing every
  // user to download the full ~100 MB package.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.requestHeaders = { 'User-Agent': 'AGY-Hub-Updater/1.4' };

  async function fetchGitHubReleaseDetails(version, fallbackNotes) {
    const clean = cleanVersion(version);
    const tags = releaseTagCandidates(clean);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let lastError = null;
    try {
      for (const tag of tags) {
        try {
          const response = await net.fetch(
            `https://api.github.com/repos/${RELEASE_REPOSITORY.owner}/${RELEASE_REPOSITORY.repo}/releases/tags/${encodeURIComponent(tag)}`,
            {
              signal: controller.signal,
              headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AGY-Hub-Updater' }
            }
          );
          if (response.status === 404) continue;
          if (!response.ok) throw new Error(`GitHub Release API returned ${response.status}`);
          const release = await response.json();
          return {
            releaseNotes: normalizeReleaseNotes(release.body) || normalizeReleaseNotes(fallbackNotes),
            releaseUrl: release.html_url || releaseUrl(tag),
            releaseTag: tag
          };
        } catch (error) {
          lastError = error;
          if (error?.name === 'AbortError') throw error;
        }
      }
      throw lastError || new Error(`找不到 ${clean} 对应的 GitHub Release`);
    } catch (error) {
      console.warn('[Updater] Failed to load GitHub release details:', error.message);
      const fallbackTag = tags[0] || clean;
      return { releaseNotes: normalizeReleaseNotes(fallbackNotes), releaseUrl: releaseUrl(fallbackTag), releaseTag: fallbackTag };
    } finally {
      clearTimeout(timeout);
    }
  }

  function sendUpdaterMessage(payload) {
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('updater-message', payload);
  }

  autoUpdater.on('checking-for-update', () => sendUpdaterMessage({ status: 'checking', text: '正在检查新版本...' }));
  autoUpdater.on('update-available', info => {
    const currentVersion = app.getVersion();
    if (!isVersionNewer(info.version, currentVersion)) {
      sendUpdaterMessage({ status: 'not-available', currentVersion, version: info.version, text: '当前已是最新版本' });
      return;
    }
    sendUpdaterMessage({
      status: 'available',
      currentVersion,
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      downloadMode: 'adaptive',
      text: `发现新版本 v${info.version}`
    });
    fetchGitHubReleaseDetails(info.version, info.releaseNotes).then(release => {
      sendUpdaterMessage({ status: 'details', version: info.version, ...release });
    });
  });
  autoUpdater.on('update-not-available', () => sendUpdaterMessage({ status: 'not-available', text: '当前已是最新版本' }));
  autoUpdater.on('error', error => {
    // downloadUpdate emits an error event before rejecting. While the bounded
    // retry sequence is active, let its final result own the UI notification so
    // a recoverable first attempt does not flash a false failure.
    if (downloadSequenceActive) return;
    const info = classify(error);
    sendUpdaterMessage({ status: 'error', code: info.category === 'network' ? 'NETWORK_ERROR' : 'UPDATER_ERROR', error: info.message, action: info.action, text: `更新失败: ${info.message}` });
  });
  autoUpdater.on('download-progress', progress => sendUpdaterMessage({
    status: 'downloading',
    percent: Math.round(progress.percent),
    bytesPerSecond: Number(progress.bytesPerSecond) || 0,
    transferred: Number(progress.transferred) || 0,
    total: Number(progress.total) || 0,
    downloadMode: 'adaptive',
    text: `正在下载更新: ${Math.round(progress.percent)}%`
  }));
  autoUpdater.on('update-downloaded', info => sendUpdaterMessage({
    status: 'downloaded',
    version: info.version,
    text: '更新包已下载完成，点击立即重启安装'
  }));

  ipcMain.handle('check-app-update', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { success: true, updateInfo: result ? result.updateInfo : null };
    } catch (error) {
      const info = classify(error);
      return { success: false, code: info.category === 'network' ? 'NETWORK_ERROR' : 'UPDATER_ERROR', error: info.message, action: info.action };
    }
  });
  ipcMain.handle('start-download-update', async () => {
    if (downloadSequenceActive) return { success: false, code: 'DOWNLOAD_IN_PROGRESS', error: '更新正在下载中，请勿重复操作' };
    downloadSequenceActive = true;
    try {
      const outcome = await downloadUpdateWithRetry({
        download: () => autoUpdater.downloadUpdate(),
        onRetry: ({ error, attempt, maxAttempts, delayMs }) => {
          const info = classify(error);
          sendUpdaterMessage({
            status: 'retrying',
            attempt,
            maxAttempts,
            delayMs,
            error: info.message,
            text: `连接中断，正在进行第 ${attempt}/${maxAttempts} 次下载尝试`
          });
        }
      });
      return { success: true, mode: 'adaptive', attempts: outcome.attempts };
    } catch (error) {
      const info = classify(error);
      sendUpdaterMessage({
        status: 'error',
        phase: 'download',
        code: info.category === 'network' ? 'NETWORK_ERROR' : 'UPDATER_ERROR',
        error: info.message,
        action: info.action,
        text: `更新下载失败: ${info.message}`
      });
      return { success: false, code: info.category === 'network' ? 'NETWORK_ERROR' : 'UPDATER_ERROR', error: info.message, action: info.action };
    } finally {
      downloadSequenceActive = false;
    }
  });
  ipcMain.handle('quit-and-install-update', async () => {
    if (updateInstallInProgress) return { success: true, alreadyStarted: true };
    updateInstallInProgress = true;
    try {
      await prepareForUpdate();
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return { success: true };
    } catch (error) {
      updateInstallInProgress = false;
      app.isQuiting = false;
      return { success: false, error: error.message };
    }
  });
}

module.exports = {
  DOWNLOAD_MAX_ATTEMPTS,
  DOWNLOAD_RETRY_DELAYS_MS,
  isRetryableDownloadError,
  downloadUpdateWithRetry,
  registerUpdaterService
};
