const { autoUpdater } = require('electron-updater');
const { normalizeReleaseNotes, isVersionNewer } = require('./updateUtils.js');
const { RELEASE_REPOSITORY, cleanVersion, releaseTagCandidates, releaseUrl } = require('./releaseConfig.js');
const { classify } = require('./errorDiagnostics.js');

function registerUpdaterService(options) {
  const { ipcMain, app, net, getMainWindow, prepareForUpdate } = options;
  let updateInstallInProgress = false;

  // GitHub Release 在部分网络下，NSIS blockmap 差分下载会产生大量 Range 请求，
  // 实测比浏览器直接下载完整安装包更慢。1.3.0 起强制完整下载，仍由
  // electron-updater 校验 latest.yml 中的 SHA512 并保持原安装流程。
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.requestHeaders = { 'User-Agent': 'AGY-Hub-Updater/1.3' };

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
      downloadMode: 'full',
      text: `发现新版本 v${info.version}`
    });
    fetchGitHubReleaseDetails(info.version, info.releaseNotes).then(release => {
      sendUpdaterMessage({ status: 'details', version: info.version, ...release });
    });
  });
  autoUpdater.on('update-not-available', () => sendUpdaterMessage({ status: 'not-available', text: '当前已是最新版本' }));
  autoUpdater.on('error', error => { const info = classify(error); sendUpdaterMessage({ status: 'error', code: info.category === 'network' ? 'NETWORK_ERROR' : 'UPDATER_ERROR', error: info.message, action: info.action, text: `更新失败: ${info.message}` }); });
  autoUpdater.on('download-progress', progress => sendUpdaterMessage({
    status: 'downloading',
    percent: Math.round(progress.percent),
    bytesPerSecond: Number(progress.bytesPerSecond) || 0,
    transferred: Number(progress.transferred) || 0,
    total: Number(progress.total) || 0,
    downloadMode: 'full',
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
    try {
      await autoUpdater.downloadUpdate();
      return { success: true, mode: 'full' };
    } catch (error) {
      const info = classify(error);
      return { success: false, code: info.category === 'network' ? 'NETWORK_ERROR' : 'UPDATER_ERROR', error: info.message, action: info.action };
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

module.exports = { registerUpdaterService };
