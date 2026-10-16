const QUIT_FOR_UPDATE_ARGUMENT = '--quit-for-update';

function hasQuitForUpdateArgument(commandLine) {
  return Array.isArray(commandLine)
    && commandLine.some(argument => String(argument) === QUIT_FOR_UPDATE_ARGUMENT);
}

function createAppShutdownCoordinator(options) {
  const {
    app,
    stopRuntime,
    destroyTray,
    timeoutMs = 5000,
    setTimer = setTimeout,
    clearTimer = clearTimeout
  } = options;
  let shutdownPromise = null;

  function prepare() {
    app.isQuiting = true;
    if (shutdownPromise) return shutdownPromise;
    destroyTray();

    let timeout;
    const runtimeStop = Promise.resolve()
      .then(() => stopRuntime())
      .catch(error => {
        console.warn('[Shutdown] Runtime cleanup failed:', error && error.message ? error.message : error);
      });
    const timeoutStop = new Promise(resolve => {
      timeout = setTimer(resolve, timeoutMs);
    });

    shutdownPromise = Promise.race([runtimeStop, timeoutStop])
      .finally(() => clearTimer(timeout));
    return shutdownPromise;
  }

  async function quit() {
    await prepare();
    app.quit();
  }

  return { prepare, quit };
}

module.exports = {
  QUIT_FOR_UPDATE_ARGUMENT,
  hasQuitForUpdateArgument,
  createAppShutdownCoordinator
};
