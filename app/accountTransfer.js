const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

function safeId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) throw new Error('无效账号 ID');
  return value;
}

function readToken(detail, safeStorage) {
  let token = detail.token;
  if (detail.token_storage === 'electron-safe-storage-v1') {
    try { token = JSON.parse(safeStorage.decryptString(Buffer.from(detail.token_encrypted, 'base64'))); }
    catch (_) { throw new Error('无法解密此账号凭据，请在原电脑导出可迁移的 JSON 文件'); }
  }
  if (!token || typeof token.refresh_token !== 'string' || !token.refresh_token.trim()) {
    throw new Error('账号缺少有效的 refresh_token，请重新授权后再导出或导入');
  }
  return token;
}

function writeAtomic(file, text) {
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, text, { mode: 0o600 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function registerAccountTransferIpc(options) {
  const { ipcMain, safeStorage } = options;
  const root = options.accountRoot || path.join(os.homedir(), '.gemini/antigravity/tools');
  const details = path.join(root, 'accounts');
  const registryFile = path.join(root, 'accounts.json');
  const readRegistry = () => {
    const registry = fs.existsSync(registryFile) ? JSON.parse(fs.readFileSync(registryFile, 'utf8')) : { accounts: [], current_account_id: '' };
    if (!Array.isArray(registry.accounts)) throw new Error('账号列表格式无效，已停止操作');
    return registry;
  };
  const showDialog = (method, config) => {
    const dialog = options.dialog || require('electron').dialog;
    const parent = options.getMainWindow?.();
    return parent ? dialog[method](parent, config) : dialog[method](config);
  };

  ipcMain.handle('export-local-account', async (_event, id) => {
    try {
      safeId(id);
      if (!readRegistry().accounts.some(account => account.id === id)) throw new Error('账号不存在');
      const detail = JSON.parse(fs.readFileSync(path.join(details, `${id}.json`), 'utf8'));
      const token = readToken(detail, safeStorage);
      const exported = { id, email: detail.email, name: detail.name, token };
      const name = String(detail.email || 'account').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      const selected = await showDialog('showSaveDialog', { title: '导出账号配置文件', defaultPath: `${name}.json`, filters: [{ name: 'JSON 配置文件', extensions: ['json'] }] });
      if (selected.canceled || !selected.filePath) return { success: false, code: 'CANCELED' };
      writeAtomic(selected.filePath, JSON.stringify(exported, null, 2));
      return { success: true };
    } catch (error) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('import-local-account-file', async () => {
    try {
      const selected = await showDialog('showOpenDialog', { title: '导入账号配置文件', filters: [{ name: 'JSON 配置文件', extensions: ['json'] }], properties: ['openFile'] });
      if (selected.canceled || !selected.filePaths?.length) return { success: false, code: 'CANCELED' };
      const file = selected.filePaths[0];
      if (fs.statSync(file).size > 1024 * 1024) throw new Error('账号配置文件过大');
      const input = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
      const email = String(input.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('账号邮箱格式无效');
      const token = readToken(input, safeStorage);
      if (!safeStorage?.isEncryptionAvailable()) throw new Error('系统凭据加密暂不可用，请稍后重试');
      const registry = readRegistry();
      const previous = registry.accounts.find(account => String(account.email).toLowerCase() === email.toLowerCase());
      const id = previous ? safeId(previous.id) : crypto.randomUUID();
      const name = String(input.name || email.split('@')[0]).slice(0, 80);
      const detailFile = path.join(details, `${id}.json`);
      const oldContent = fs.existsSync(detailFile) ? fs.readFileSync(detailFile) : null;
      const oldDetail = oldContent ? JSON.parse(oldContent) : {};
      const detail = { ...oldDetail, id, email, name, token_storage: 'electron-safe-storage-v1', token_encrypted: safeStorage.encryptString(JSON.stringify(token)).toString('base64') };
      delete detail.token;
      if (previous) Object.assign(previous, { email, name });
      else registry.accounts.push({ id, email, name });
      fs.mkdirSync(details, { recursive: true });
      writeAtomic(detailFile, JSON.stringify(detail, null, 2));
      try { writeAtomic(registryFile, JSON.stringify(registry, null, 2)); }
      catch (error) {
        if (oldContent) writeAtomic(detailFile, oldContent);
        else fs.unlinkSync(detailFile);
        throw error;
      }
      return { success: true, email };
    } catch (error) { return { success: false, error: error.message }; }
  });
}

module.exports = { registerAccountTransferIpc };
