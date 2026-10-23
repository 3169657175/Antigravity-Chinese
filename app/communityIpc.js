const fs = require('fs');
const path = require('path');
const { COMMUNITY_ORIGIN, safeExternalUrl } = require('./urlPolicy.js');

const GENERIC_PATH_ALLOWLIST = [
  /^\/api\/auth\/(?:reset-password|users)(?:\?.*)?$/,
  /^\/api\/announcement(?:\?.*)?$/,
  /^\/api\/feedback\/like(?:\?.*)?$/,
  /^\/api\/reply(?:\/like)?(?:\?.*)?$/
];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function normalizeImageBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  return Buffer.alloc(0);
}

function detectImageMime(value) {
  const bytes = normalizeImageBytes(value);
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}

function extensionForMime(mime) {
  return mime === 'image/png' ? '.png' : mime === 'image/gif' ? '.gif' : mime === 'image/webp' ? '.webp' : '.jpg';
}

function allowedCommunityPath(value) {
  const url = new URL(String(value || ''), COMMUNITY_ORIGIN);
  return url.origin === COMMUNITY_ORIGIN && GENERIC_PATH_ALLOWLIST.some(pattern => pattern.test(`${url.pathname}${url.search}`));
}

function registerCommunityIpc(options) {
  const { ipcMain, client, shell } = options;
  async function uploadBytes(value, filename, context) {
    const session = client.readSession();
    if (!session?.token) return { success: false, code: 'AUTH_REQUIRED', error: '请先登录后再上传图片' };
    const bytes = normalizeImageBytes(value);
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) return { success: false, code: bytes.length ? 'IMAGE_TOO_LARGE' : 'INVALID_IMAGE', error: bytes.length ? '图片不能超过 8MB' : '图片内容为空' };
    const mime = detectImageMime(bytes);
    if (!mime) return { success: false, code: 'INVALID_IMAGE', error: '只支持 PNG、JPG、GIF 或 WebP 图片' };
    const base = path.basename(String(filename || 'clipboard-image'), path.extname(String(filename || ''))).replace(/[^\w.-]+/g, '-').slice(0, 60) || 'image';
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mime }), `${base}${extensionForMime(mime)}`);
    form.append('context', String(context || 'feedback').slice(0, 40));
    const result = await client.request('/api/upload', { method: 'POST', body: form, timeoutMs: 15000 });
    return result.success && result.data?.url ? { success: true, url: result.data.url } : { success: false, code: result.code, error: result.message || result.data?.error || '上传失败' };
  }
  if (options.registerLegacy !== false) {
  ipcMain.handle('get-auth-session', async () => {
    const data = client.readSession();
    return data ? { success: true, data } : { success: false, code: 'NO_SESSION' };
  });
  ipcMain.handle('auth-login', (_event, username, password) => client.login(String(username || ''), String(password || '')));
  ipcMain.handle('auth-register', async (_event, username, password) => {
    const result = await client.request('/api/auth/register', { method: 'POST', auth: false, body: { username, password } });
    return result.success && result.data?.success ? { success: true } : { success: false, code: result.code, error: result.message || result.data?.error || '注册失败' };
  });
  ipcMain.handle('auth-logout', async () => { client.clearSession(); return { success: true }; });

  ipcMain.handle('upload-image', async (_event, filePath, context = 'feedback') => {
    const resolved = path.resolve(String(filePath || ''));
    if (!fs.existsSync(resolved) || !/\.(?:png|jpe?g|gif|webp)$/i.test(resolved)) return { success: false, code: 'INVALID_IMAGE', error: '请选择 PNG、JPG、GIF 或 WebP 图片' };
    return uploadBytes(fs.readFileSync(resolved), path.basename(resolved), context);
  });
  ipcMain.handle('upload-image-data', (_event, bytes, filename, context = 'feedback') => uploadBytes(bytes, filename, context));

  ipcMain.handle('fetch-feedbacks', async (_event, options = {}) => {
    const sort = ['popular', 'unanswered'].includes(options?.sort) ? options.sort : 'newest';
    if (options?.preferCache) {
      const cached = client.readCache(`feedback:${sort}`);
      if (cached) return { success: true, data: cached.data, stale: true, fromCache: true, savedAt: cached.savedAt, warning: '正在后台同步最新讨论' };
    }
    const result = await client.request(`/api/feedback?sort=${sort}`, { headers: { 'Cache-Control': 'no-cache' }, cacheKey: `feedback:${sort}` });
    return result.success ? { success: true, data: result.data, stale: Boolean(result.stale), warning: result.warning || '' } : { success: false, code: result.code, error: result.message };
  });
  ipcMain.handle('submit-feedback', async (_event, content, imageUrl) => {
    if (!client.readSession()?.token) return { success: false, code: 'AUTH_REQUIRED', error: '请先登录您的极客账号' };
    const result = await client.request('/api/feedback', { method: 'POST', body: { content: String(content || '').slice(0, 500), image_url: String(imageUrl || '').slice(0, 2000) } });
    return result.success && result.data?.success ? { success: true } : { success: false, code: result.code, error: result.message || result.data?.error || '发送失败' };
  });
  ipcMain.handle('delete-feedback', async (_event, feedbackId) => {
    const result = await client.request(`/api/feedback?id=${encodeURIComponent(String(feedbackId || ''))}`, { method: 'DELETE' });
    return result.success && result.data?.success ? { success: true } : { success: false, code: result.code, error: result.message || result.data?.error || '删除失败' };
  });
  }
  ipcMain.handle('community-request', async (_event, resource, requestOptions = {}) => {
    if (!allowedCommunityPath(resource)) return { success: false, ok: false, status: 400, code: 'PATH_NOT_ALLOWED', message: '该社区接口不在允许列表中', data: {} };
    const method = String(requestOptions.method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'DELETE'].includes(method)) return { success: false, ok: false, status: 405, code: 'METHOD_NOT_ALLOWED', message: '不允许的社区请求方法', data: {} };
    return client.request(resource, { method, body: requestOptions.body, cache: requestOptions.cache });
  });
  if (options.registerExternal !== false) ipcMain.handle('open-external-url', async (_event, value) => {
    try {
      const url = safeExternalUrl(value);
      if (!url) throw new Error('只允许打开 HTTP 或 HTTPS 链接');
      if (!['https:', 'http:'].includes(url.protocol)) throw new Error('只允许打开 HTTP 或 HTTPS 链接');
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, code: 'INVALID_EXTERNAL_URL', error: error.message };
    }
  });
}

module.exports = { registerCommunityIpc, allowedCommunityPath, detectImageMime, normalizeImageBytes, MAX_IMAGE_BYTES };
