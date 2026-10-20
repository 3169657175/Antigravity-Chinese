(function exposeAppShellController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyAppShellController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createAppShellController() {
  function init() {

      // ----------------------------------------
      // 自动更新逻辑 (electron-updater)
      // ----------------------------------------
      const btnCheckUpdate = document.getElementById('btn-check-update');
      const updateModal = document.getElementById('update-modal');
      const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
      const btnUpdateCancel = document.getElementById('btn-update-cancel');
      const btnUpdateAction = document.getElementById('btn-update-action');
      const updateCurrentVersion = document.getElementById('update-current-version');
      const updateLatestVersion = document.getElementById('update-latest-version');
      const updateReleaseNotes = document.getElementById('update-release-notes');
      const updateModalTitle = document.getElementById('update-modal-title');
      const updateModalSummary = document.getElementById('update-modal-summary');
      const updateModalStatus = document.getElementById('update-modal-status');
      const updateProgressSection = document.getElementById('update-progress-section');
      const updateProgressText = document.getElementById('update-progress-text');
      const updateProgressPercent = document.getElementById('update-progress-percent');
      const updateProgressBar = document.getElementById('update-progress-bar');
      let updateAction = 'check';
      let currentAppVersion = '--';
      const ui = window.AgyUiFeedback || { notify: (message, type) => console[type === 'error' ? 'error' : 'log'](message) };
      const diagnostics = window.AgyErrorDiagnostics || { classify: input => ({ title: '操作失败', message: String(input?.message || input?.error || input || '未知错误') }) };
      const notifyError = (input, fallbackTitle = '操作失败') => { const info = diagnostics.classify(input); ui.notify(info.message, 'error', { title: info.title || fallbackTitle }); return info; };

      function formatDownloadSpeed(bytesPerSecond) {
        const value = Math.max(0, Number(bytesPerSecond) || 0);
        if (!value) return '';
        if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB/s`;
        return `${Math.max(1, Math.round(value / 1024))} KB/s`;
      }
    
      function versionLabel(version) {
        const clean = String(version || '--').replace(/^v/i, '');
        return clean === '--' ? 'v--' : `v${clean}`;
      }

      async function loadCurrentAppVersion() {
        try {
          const version = await window.agyHubAPI.getAppVersion();
          currentAppVersion = String(version || '--').replace(/^v/i, '') || '--';
          const badge = document.getElementById('app-version-badge');
          if (badge) badge.textContent = `${versionLabel(currentAppVersion)} Stable`;
        } catch (_) {
          currentAppVersion = '--';
        }
        return currentAppVersion;
      }
    
      function setUpdateModalVisible(visible) {
        if (updateModal) updateModal.style.display = visible ? 'flex' : 'none';
      }
    
      function setUpdateAction(action, label, disabled = false) {
        updateAction = action;
        if (btnUpdateAction) {
          btnUpdateAction.textContent = label;
          btnUpdateAction.disabled = disabled;
        }
      }
    
      function showAvailableUpdate(data) {
        if (updateModalTitle) updateModalTitle.textContent = '检测到新版本';
        if (updateCurrentVersion) updateCurrentVersion.textContent = versionLabel(data.currentVersion);
        if (updateLatestVersion) updateLatestVersion.textContent = versionLabel(data.version);
        if (updateModalSummary) updateModalSummary.textContent = `检测到有更新，建议升级到 ${versionLabel(data.version)}`;
        if (updateReleaseNotes) {
          updateReleaseNotes.textContent = String(data.releaseNotes || '').trim() || '本次更新未提供详细说明。';
        }
        if (updateModalStatus) updateModalStatus.textContent = '';
        if (updateProgressSection) updateProgressSection.hidden = true;
        if (btnUpdateCancel) btnUpdateCancel.disabled = false;
        if (btnCloseUpdateModal) btnCloseUpdateModal.disabled = false;
        setUpdateAction('download', '更新');
        setUpdateModalVisible(true);
      }
    
      function showCheckingUpdate() {
        if (updateModalTitle) updateModalTitle.textContent = '正在检查更新';
        if (updateModalSummary) updateModalSummary.textContent = '正在连接 GitHub Release，请稍候…';
        if (updateCurrentVersion) updateCurrentVersion.textContent = versionLabel(currentAppVersion);
        if (updateLatestVersion) updateLatestVersion.textContent = 'v--';
        if (updateReleaseNotes) updateReleaseNotes.textContent = '正在读取版本信息与更新说明…';
        if (updateModalStatus) updateModalStatus.textContent = '检查过程在后台进行，无需重复点击。';
        if (updateProgressSection) updateProgressSection.hidden = true;
        if (btnUpdateCancel) btnUpdateCancel.disabled = false;
        if (btnCloseUpdateModal) btnCloseUpdateModal.disabled = false;
        setUpdateAction('checking', '正在检查…', true);
        setUpdateModalVisible(true);
      }
    
      async function runUpdateAction() {
        if (updateAction === 'close') {
          closeUpdateModal();
          return;
        }
        if (updateAction === 'download') {
          setUpdateAction('downloading', '正在下载...', true);
          if (updateProgressSection) updateProgressSection.hidden = false;
          if (updateModalStatus) updateModalStatus.textContent = '将直接下载完整安装包，已关闭 GitHub blockmap 差分下载以提升速度。';
          const result = await window.agyHubAPI.startDownloadUpdate();
          if (!result || !result.success) {
            setUpdateAction('download', '重新下载');
            if (updateModalStatus) updateModalStatus.textContent = `下载失败：${result && result.error ? result.error : '未知错误'}`;
          }
          return;
        }
    
        if (updateAction === 'install') {
          setUpdateAction('installing', '正在退出并安装...', true);
          if (btnUpdateCancel) btnUpdateCancel.disabled = true;
          if (btnCloseUpdateModal) btnCloseUpdateModal.disabled = true;
          if (updateModalStatus) updateModalStatus.textContent = '正在关闭托盘与后台服务，请稍候...';
          const result = await window.agyHubAPI.quitAndInstallUpdate();
          if (result && result.success === false) {
            if (btnUpdateCancel) btnUpdateCancel.disabled = false;
            if (btnCloseUpdateModal) btnCloseUpdateModal.disabled = false;
            setUpdateAction('install', '重试安装');
            if (updateModalStatus) updateModalStatus.textContent = `启动安装失败：${result.error || '未知错误'}`;
          }
        }
      }
    
      function closeUpdateModal() {
        if (updateAction === 'installing') return;
        setUpdateModalVisible(false);
      }
    
      btnCloseUpdateModal?.addEventListener('click', closeUpdateModal);
      btnUpdateCancel?.addEventListener('click', closeUpdateModal);
      btnUpdateAction?.addEventListener('click', runUpdateAction);
      loadCurrentAppVersion();
      updateModal?.addEventListener('click', event => {
        if (event.target === updateModal) closeUpdateModal();
      });
    
      if (btnCheckUpdate) {
        btnCheckUpdate.addEventListener('click', async () => {
          if (updateAction === 'download' || updateAction === 'install') {
            if (updateAction === 'download') setUpdateModalVisible(true);
            else await runUpdateAction();
            return;
          }
          btnCheckUpdate.disabled = true;
          btnCheckUpdate.textContent = '检查中...';
          showCheckingUpdate();
          try {
            const res = await window.agyHubAPI.checkAppUpdate();
            if (!res.success) {
              notifyError({ code: res.code || 'NETWORK_ERROR', message: res.error || '无法连接 GitHub Release' }, '检查更新失败');
              btnCheckUpdate.disabled = false;
              btnCheckUpdate.textContent = '检查更新';
            }
          } catch (e) {
            notifyError(e, '检查更新异常');
            btnCheckUpdate.disabled = false;
            btnCheckUpdate.textContent = '检查更新';
          }
        });
      }
    
      if (window.agyHubAPI && window.agyHubAPI.onUpdaterMessage) {
        window.agyHubAPI.onUpdaterMessage((data) => {
          console.log('[Updater]', data);
          const btn = document.getElementById('btn-check-update');
          if (!btn) return;
          
          if (data.status === 'checking') {
            btn.textContent = '检查中...';
            btn.disabled = true;
            if (!updateModal || updateModal.style.display === 'none') showCheckingUpdate();
          } else if (data.status === 'available') {
            btn.textContent = `下载 v${data.version}`;
            btn.disabled = false;
            updateAction = 'download';
            showAvailableUpdate(data);
          } else if (data.status === 'not-available') {
            btn.textContent = '已是最新版';
            btn.disabled = false;
            updateAction = 'check';
            if (updateModalTitle) updateModalTitle.textContent = '当前已是最新版';
            if (updateModalSummary) updateModalSummary.textContent = '无需更新，可以继续使用当前版本。';
            if (updateLatestVersion) updateLatestVersion.textContent = updateCurrentVersion?.textContent || 'v--';
            if (updateReleaseNotes) updateReleaseNotes.textContent = '当前版本已经是 GitHub Release 中的最新版本。';
            if (updateModalStatus) updateModalStatus.textContent = '';
            setUpdateAction('close', '知道了');
            setTimeout(() => { btn.textContent = '检查更新'; }, 3000);
          } else if (data.status === 'details') {
            if (data.releaseNotes && updateReleaseNotes) updateReleaseNotes.textContent = data.releaseNotes;
          } else if (data.status === 'downloading') {
            btn.textContent = `已下载 ${data.percent}%`;
            btn.disabled = true;
            updateAction = 'downloading';
            if (updateProgressSection) updateProgressSection.hidden = false;
            const speed = formatDownloadSpeed(data.bytesPerSecond);
            if (updateProgressText) updateProgressText.textContent = speed ? `正在高速下载完整安装包 · ${speed}` : '正在下载完整安装包';
            if (updateProgressPercent) updateProgressPercent.textContent = `${data.percent}%`;
            if (updateProgressBar) updateProgressBar.style.width = `${Math.max(0, Math.min(100, Number(data.percent) || 0))}%`;
            if (btnUpdateAction) {
              btnUpdateAction.textContent = `正在下载 ${data.percent}%`;
              btnUpdateAction.disabled = true;
            }
          } else if (data.status === 'downloaded') {
            btn.textContent = '立即重启安装';
            btn.disabled = false;
            updateAction = 'install';
            if (updateProgressSection) updateProgressSection.hidden = false;
            if (updateProgressText) updateProgressText.textContent = '更新包已下载完成';
            if (updateProgressPercent) updateProgressPercent.textContent = '100%';
            if (updateProgressBar) updateProgressBar.style.width = '100%';
            if (updateModalStatus) updateModalStatus.textContent = '点击“立即重启安装”后，管家会自动退出后台并完成更新。';
            setUpdateAction('install', '立即重启安装');
            setUpdateModalVisible(true);
          } else if (data.status === 'error') {
            if (updateModalTitle) updateModalTitle.textContent = '检查更新失败';
            if (updateModalSummary) updateModalSummary.textContent = '暂时无法连接更新服务。';
            const info = diagnostics.classify({ code: data.code, message: data.error || data.text });
            if (updateReleaseNotes) updateReleaseNotes.textContent = `${info.message}\n\n建议：${info.action}`;
            if (updateModalStatus) updateModalStatus.textContent = info.message;
            ui.notify(info.message, 'error', { title: info.title });
            const modalOpen = Boolean(updateModal && updateModal.style.display !== 'none');
            if (modalOpen) setUpdateAction('download', '重新下载');
            btn.textContent = '检查更新';
            btn.disabled = false;
            if (modalOpen) setUpdateAction('close', '关闭');
            else updateAction = 'check';
          }
        });
      }
      // ----------------------------------------
      // 窗口全屏/还原按钮 (btn-maximize)
      // ----------------------------------------
      const btnMaximize = document.getElementById('btn-maximize');
      if (btnMaximize) {
        btnMaximize.addEventListener('click', () => {
          if (window.agyHubAPI && window.agyHubAPI.maximizeWindow) {
            window.agyHubAPI.maximizeWindow();
          }
        });
      }
    
      // ----------------------------------------
      // 亮色/暗色主题切换 (btn-toggle-light-dark)
      // ----------------------------------------
      const btnToggleLightDark = document.getElementById('btn-toggle-light-dark');
      const sunIcon = document.getElementById('theme-icon-sun');
      const moonIcon = document.getElementById('theme-icon-moon');
    
      // 初始化上次选择的主题
      const savedThemeMode = localStorage.getItem('agy_hub_color_theme');
      if (savedThemeMode === 'light') {
        document.body.classList.add('light-theme');
        if (sunIcon && moonIcon) {
          sunIcon.style.display = 'inline';
          moonIcon.style.display = 'none';
        }
      }
    
      if (btnToggleLightDark) {
        btnToggleLightDark.addEventListener('click', () => {
          const isLight = document.body.classList.toggle('light-theme');
          if (isLight) {
            localStorage.setItem('agy_hub_color_theme', 'light');
            if (sunIcon && moonIcon) {
              sunIcon.style.display = 'inline';
              moonIcon.style.display = 'none';
            }
          } else {
            localStorage.setItem('agy_hub_color_theme', 'dark');
            if (sunIcon && moonIcon) {
              sunIcon.style.display = 'none';
              moonIcon.style.display = 'inline';
            }
          }
        });
      }
  }

  return { init };
});
