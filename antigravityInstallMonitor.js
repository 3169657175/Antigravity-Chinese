const { execFile } = require('child_process');
const INSTALLER_NAME = /^(?=.*antigravity)(?=.*(?:setup|install|update|uninstall)).*\.exe$/i;
function isAntigravityInstallerActive(tasklistCsv = '') {
  return String(tasklistCsv).split(/\r?\n/).some(row => {
    const match = row.match(/^\s*\"([^\"]+)\"/);
    return !!(match && INSTALLER_NAME.test(match[1]));
  });
}
function createAntigravityInstallMonitor(options = {}) {
  const run = options.execFile || execFile;
  const onChange = options.onChange || (() => {});
  const intervalMs = options.intervalMs || 4000;
  let active = false, inFlight = null, timer = null, stopped = false;
  function poll() {
    if (stopped) return Promise.resolve(active);
    if (inFlight) return inFlight;
    inFlight = new Promise(resolve => {
      run('tasklist', ['/fo', 'csv', '/nh'], { timeout: 4000, maxBuffer: 4 * 1024 * 1024, windowsHide: true }, (error, stdout) => {
        if (!error && !stopped) {
          const next = isAntigravityInstallerActive(stdout);
          if (active !== next) { active = next; onChange(active); }
        }
        resolve(active);
      });
    }).finally(() => { inFlight = null; });
    return inFlight;
  }
  return {
    start() { if (!timer) { stopped = false; poll(); timer = setInterval(poll, intervalMs); if (timer.unref) timer.unref(); } },
    stop() { stopped = true; if (timer) clearInterval(timer); timer = null; },
    isInstalling() { return active; },
    poll
  };
}
module.exports = { createAntigravityInstallMonitor, isAntigravityInstallerActive };