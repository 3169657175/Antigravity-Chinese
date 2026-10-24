const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROTOCOL_VERSION = 1;
const REQUEST_FILENAME = '.agy-native-switch-request.json';
const RESPONSE_FILENAME = '.agy-native-switch-response.json';

function bridgePaths(accountRoot) {
  const root = path.resolve(String(accountRoot || ''));
  return {
    requestPath: path.join(root, REQUEST_FILENAME),
    responsePath: path.join(root, RESPONSE_FILENAME)
  };
}

function removeQuietly(fsModule, filePath) {
  try { fsModule.rmSync(filePath, { force: true }); } catch (_) {}
}

function writeJsonAtomic(fsModule, filePath, value) {
  fsModule.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    fsModule.writeFileSync(tempPath, `${JSON.stringify(value)}\n`, { encoding: 'utf8', mode: 0o600 });
    fsModule.renameSync(tempPath, filePath);
  } catch (error) {
    removeQuietly(fsModule, tempPath);
    throw error;
  }
}

async function requestNativeAccountSwitch(options = {}) {
  const {
    accountRoot,
    accountId,
    fsModule = fs,
    timeoutMs = 6000,
    pollMs = 80,
    sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
    now = () => Date.now(),
    nonce = crypto.randomBytes(18).toString('hex')
  } = options;
  const id = String(accountId || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('无效账号 ID');
  if (!/^[a-f0-9]{24,64}$/i.test(String(nonce))) throw new Error('无效切换请求标识');
  const { requestPath, responsePath } = bridgePaths(accountRoot);
  removeQuietly(fsModule, requestPath);
  removeQuietly(fsModule, responsePath);
  writeJsonAtomic(fsModule, requestPath, {
    protocol: PROTOCOL_VERSION,
    nonce: String(nonce),
    accountId: id,
    createdAt: now()
  });

  const deadline = now() + Math.max(500, Number(timeoutMs) || 6000);
  try {
    while (now() < deadline) {
      if (fsModule.existsSync(responsePath)) {
        let response = null;
        try { response = JSON.parse(fsModule.readFileSync(responsePath, 'utf8').replace(/^\uFEFF/, '')); }
        catch (_) { response = null; }
        if (response && response.protocol === PROTOCOL_VERSION && response.nonce === String(nonce)) {
          removeQuietly(fsModule, responsePath);
          if (!response.success) throw new Error(response.error || 'Antigravity 内部切换失败');
          return {
            success: true,
            nativeBridge: true,
            restarted: response.restartScheduled !== false,
            restartRequired: false
          };
        }
      }
      await sleep(Math.max(20, Number(pollMs) || 80));
    }
    const error = new Error('Antigravity 未响应内部账号切换请求；已取消外部强制重启以保护登录状态');
    error.code = 'NATIVE_SWITCH_TIMEOUT';
    throw error;
  } finally {
    removeQuietly(fsModule, requestPath);
  }
}

module.exports = {
  PROTOCOL_VERSION,
  REQUEST_FILENAME,
  RESPONSE_FILENAME,
  bridgePaths,
  requestNativeAccountSwitch
};
