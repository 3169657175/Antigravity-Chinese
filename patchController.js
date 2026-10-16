(function exposePatchController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyPatchController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createPatchController() {
  async function init(dependencies = {}) {
    const { logToTerminal = () => {} } = dependencies;
    const pathStatusText = document.getElementById('path-status-text');
    const textOriginalVersion = document.getElementById('text-original-version');
    const textPatchVersion = document.getElementById('text-patch-version');
    const inputInstallDir = document.getElementById('input-install-dir');
    const btnInstallPatch = document.getElementById('btn-install-patch');
    const btnCancelPatch = document.getElementById('btn-cancel-patch');
    const btnRestorePrevious = document.getElementById('btn-restore-previous');
    const btnRestoreOriginal = document.getElementById('btn-restore-original');
    const compatibilityStrip = document.getElementById('patch-compatibility-strip');
    const compatibilityTitle = document.getElementById('patch-compatibility-title');
    const compatibilityDetail = document.getElementById('patch-compatibility-detail');
    let appPaths = null;
    const feedback = window.AgyOperationFeedback;

    const resolveAsarPath = () => {
      const selectedPath = inputInstallDir?.value.trim();
      if (!selectedPath) return '';
      return selectedPath.endsWith('app.asar') ? selectedPath : `${selectedPath}\\resources\\app.asar`;
    };

    async function refreshBackupStatus(asarPath) {
      if (!asarPath || !window.agyHubAPI.getPatchBackupStatus) return;
      try {
        const status = await window.agyHubAPI.getPatchBackupStatus(asarPath);
        if (btnRestorePrevious) {
          btnRestorePrevious.disabled = !status.success || !status.hasPrevious;
          btnRestorePrevious.title = status.hasPrevious ? '恢复最近一次注入前的汉化版本' : '尚未生成上一版汉化备份';
        }
        if (btnRestoreOriginal) {
          btnRestoreOriginal.disabled = !status.success || !status.hasOriginal;
          btnRestoreOriginal.title = status.hasOriginal ? '恢复首次保存的官方英文原版' : '首次注入时将自动保存官方英文原版';
        }
      } catch (_) {
        if (btnRestorePrevious) btnRestorePrevious.disabled = true;
      }
    }

    async function detect() {
      try {
        appPaths = await window.agyHubAPI.detectPaths();
        if (appPaths.detected) {
          pathStatusText.textContent = `已检测到 Antigravity 安装在：${appPaths.installDir}`;
          pathStatusText.style.color = 'var(--accent-green)';
          inputInstallDir.value = appPaths.installDir;
          logToTerminal(`[Path] 自动检测安装目录成功，位置：${appPaths.asarPath}`, 'success');
          const version = await window.agyHubAPI.getAsarVersions(appPaths.asarPath);
          if (version.success) {
            textOriginalVersion.textContent = `v${version.originalVersion}`;
            textPatchVersion.textContent = `v${version.patchVersion}`;
            logToTerminal(`[Version] 官方原版: v${version.originalVersion} | 管家补丁: v${version.patchVersion}`);
            if (compatibilityStrip) {
              const known = version.originalVersion !== 'unknown' && version.patchVersion !== 'unknown';
              compatibilityStrip.dataset.state = known ? 'ready' : 'warning';
              compatibilityTitle.textContent = known ? '兼容性预检通过' : '版本信息不完整';
              compatibilityDetail.textContent = known
                ? `Antigravity ${version.originalVersion} · 补丁目标 ${version.patchVersion} · 注入前仍会执行完整结构校验`
                : '可以继续检测，但注入前请确认客户端和补丁版本。';
            }
          }
          await refreshBackupStatus(appPaths.asarPath);
        } else {
          pathStatusText.textContent = '未找到默认安装路径，请手动选择或覆盖。';
          pathStatusText.style.color = 'var(--accent-pink)';
          textOriginalVersion.textContent = 'unknown';
          textPatchVersion.textContent = 'unknown';
          logToTerminal('[Path] 未在默认位置检测到客户端，请手动配置。', 'error');
          if (compatibilityStrip) compatibilityStrip.dataset.state = 'error';
          if (compatibilityTitle) compatibilityTitle.textContent = '未找到可检测的客户端';
          if (compatibilityDetail) compatibilityDetail.textContent = '选择安装目录后会重新执行兼容性预检。';
        }
      } catch (error) {
        logToTerminal(`检测路径出错: ${error.message}`, 'error');
      }
      return appPaths;
    }

    btnInstallPatch?.addEventListener('click', async () => {
      const asarPath = resolveAsarPath();
      if (!asarPath) return feedback?.fail('patch-install', '请选择正确的 Antigravity 安装路径');
      logToTerminal(`[Patch] 正在为 ${inputInstallDir.value.trim()} 注入汉化补丁...`);
      feedback?.begin('patch-install', '注入中文汉化补丁', '正在检查客户端和补丁文件');
      btnInstallPatch.disabled = true;
      btnInstallPatch.textContent = '正在校验并注入...';
      if (btnCancelPatch) {
        btnCancelPatch.disabled = false;
        btnCancelPatch.textContent = '取消注入';
        btnCancelPatch.style.display = 'inline-flex';
      }
      try {
        const result = await window.agyHubAPI.installPatch(asarPath, null, false);
        if (!result.success) throw new Error(result.error);
        logToTerminal(result.msg, 'success');
        feedback?.succeed('patch-install', result.msg);
        await detect();
      } catch (error) {
        logToTerminal(error.message, 'error');
        feedback?.fail('patch-install', `注入失败：${error.message}`);
      } finally {
        btnInstallPatch.disabled = false;
        btnInstallPatch.textContent = '注入中文汉化补丁';
        if (btnCancelPatch) btnCancelPatch.style.display = 'none';
      }
    });

    btnCancelPatch?.addEventListener('click', async () => {
      btnCancelPatch.disabled = true;
      btnCancelPatch.textContent = '正在取消...';
      try {
        const result = await window.agyHubAPI.cancelPatchInstall();
        if (!result.success) throw new Error(result.error);
        logToTerminal(`[Patch] ${result.message}`);
      } catch (error) {
        logToTerminal(`[Patch] ${error.message}`, 'error');
        btnCancelPatch.disabled = false;
        btnCancelPatch.textContent = '取消注入';
      }
    });

    window.agyHubAPI.onOperationProgress?.(data => {
      if (!data || data.id !== 'patch-install' || !btnCancelPatch) return;
      if (data.state !== 'running') {
        btnCancelPatch.style.display = 'none';
        return;
      }
      btnCancelPatch.disabled = data.cancellable === false;
      btnCancelPatch.title = data.cancellable === false
        ? '补丁已进入最终写入阶段，为防止文件损坏不能取消'
        : '安全取消当前注入任务';
    });

    btnRestorePrevious?.addEventListener('click', async () => {
      const asarPath = resolveAsarPath();
      if (!asarPath) return;
      logToTerminal('[Patch] 正在退回上一版汉化...');
      feedback?.begin('patch-previous', '退回上一版汉化', '正在校验并恢复上一版文件');
      btnRestorePrevious.disabled = true;
      try {
        const result = await window.agyHubAPI.restorePreviousPatch(asarPath);
        if (!result.success) throw new Error(result.error);
        logToTerminal(result.msg, 'success');
        feedback?.succeed('patch-previous', '已退回上一版汉化');
        await detect();
      } catch (error) {
        logToTerminal(error.message, 'error');
        feedback?.fail('patch-previous', `回滚失败：${error.message}`);
      } finally {
        await refreshBackupStatus(asarPath);
      }
    });

    btnRestoreOriginal?.addEventListener('click', async () => {
      const asarPath = resolveAsarPath();
      if (!asarPath) return;
      logToTerminal('[Patch] 正在尝试还原官方英文原版...');
      feedback?.begin('patch-original', '还原官方英文原版', '正在校验并恢复英文原版');
      btnRestoreOriginal.disabled = true;
      try {
        const result = await window.agyHubAPI.restoreOriginal(asarPath);
        if (!result.success) throw new Error(result.error);
        logToTerminal(result.msg, 'success');
        feedback?.succeed('patch-original', '还原官方英文原版成功');
        await detect();
      } catch (error) {
        logToTerminal(error.message, 'error');
        feedback?.fail('patch-original', `还原失败：${error.message}`);
      } finally {
        await refreshBackupStatus(asarPath);
      }
    });

    return detect();
  }

  return { init };
});
