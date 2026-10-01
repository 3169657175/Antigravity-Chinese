const { autoUpdater } = require('electron-updater');
const { normalizeReleaseNotes, isVersionNewer } = require('./updateUtils.js');

const UPDATE_REPOSITORY = Object.freeze({ owner: '3169657175', repo: 'any-sub' });

function registerUpdaterService(options) {
  const {
    ipcMain,
    app,
    net,
    getMainWindow,
    prepareForUpdate
  } = options;
  let updateInstallInProgress = false;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  async function fetchGitHubReleaseDetails(version, fallbackNotes) {
    const cleanVersion = String(version || '').replace(/^v/i, '');
    const tag = `v${cleanVersion}`;
    const fallbackUrl = `https://github.com/${UPDATE_REPOSITORY.owner}/${UPDATE_REPOSITORY.repo}/releases/tag/${tag}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await net.fetch(
        `https://api.github.com/repos/${UPDATE_REPOSITORY.owner}/${UPDATE_REPOSITORY.repo}/releases/tags/${encodeURIComponent(tag)}`,
        {
          signal: controller.signal,
          headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'AGY-Hub-Updater' }
        }
      );
      if (!response.ok) throw new Error(`GitHub Release API returned ${response.status}`);
      const release = await response.json();
      return {
        releaseNotes: normalizeReleaseNotes(release.body) || normalizeReleaseNotes(fallbackNotes),
        releaseUrl: release.html_url || fallbackUrl
      };
    } catch (error) {
      console.warn('[Updater] Failed to load GitHub release details:', error.message);
      return { releaseNotes: normalizeReleaseNotes(fallbackNotes), releaseUrl: fallbackUrl };
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
      sendUpdaterMessage({
        status: 'not-available',
        currentVersion,
        version: info.version,
        text: '当前已是最新版本'
      });
      return;
    }
    sendUpdaterMessage({
      status: 'available',
      currentVersion,
      version: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      text: `发现新版本 v${info.version}`
    });
    fetchGitHubReleaseDetails(info.version, info.releaseNotes).then(release => {
      sendUpdaterMessage({ status: 'details', version: info.version, ...release });
    });
  });
  autoUpdater.on('update-not-available', () => sendUpdaterMessage({ status: 'not-available', text: '当前已是最新版本' }));
  autoUpdater.on('error', error => sendUpdaterMessage({ status: 'error', error: error.message, text: `检查更新失败: ${error.message}` }));
  autoUpdater.on('download-progress', progress => sendUpdaterMessage({
    status: 'downloading',
    percent: Math.round(progress.percent),
    bytesPerSecond: progress.bytesPerSecond,
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
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle('start-download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
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
