const fs = require('fs');
const path = require('path');
const { COMMUNITY_ORIGIN, safeExternalUrl } = require('./urlPolicy.js');

const GENERIC_PATH_ALLOWLIST = [
  /^\/api\/auth\/(?:reset-password|users)(?:\?.*)?$/,
  /^\/api\/announcement(?:\?.*)?$/,
  /^\/api\/feedback\/like(?:\?.*)?$/,
  /^\/api\/reply(?:\/like)?(?:\?.*)?$/
];

function allowedCommunityPath(value) {
  const url = new URL(String(value || ''), COMMUNITY_ORIGIN);
  return url.origin === COMMUNITY_ORIGIN && GENERIC_PATH_ALLOWLIST.some(pattern => pattern.test(`${url.pathname}${url.search}`));
}

function registerCommunityIpc(options) {
  const { ipcMain, client, shell } = options;
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
    const session = client.readSession();
    if (!session?.token) return { success: false, code: 'AUTH_REQUIRED', error: '请先登录后再上传图片' };
    const resolved = path.resolve(String(filePath || ''));
    if (!fs.existsSync(resolved) || !/\.(?:png|jpe?g|gif|webp)$/i.test(resolved)) return { success: false, code: 'INVALID_IMAGE', error: '请选择 PNG、JPG、GIF 或 WebP 图片' };
    if (fs.statSync(resolved).size > 8 * 1024 * 1024) return { success: false, code: 'IMAGE_TOO_LARGE', error: '图片不能超过 8MB' };
    const mime = /\.png$/i.test(resolved) ? 'image/png' : /\.gif$/i.test(resolved) ? 'image/gif' : /\.webp$/i.test(resolved) ? 'image/webp' : 'image/jpeg';
    const form = new FormData();
    form.append('file', new Blob([fs.readFileSync(resolved)], { type: mime }), path.basename(resolved));
    form.append('context', String(context || 'feedback').slice(0, 40));
    const result = await client.request('/api/upload', { method: 'POST', body: form });
    return result.success && result.data?.url ? { success: true, url: result.data.url } : { success: false, code: result.code, error: result.message || result.data?.error || '上传失败' };
  });

  ipcMain.handle('fetch-feedbacks', async (_event, options = {}) => {
    const sort = ['popular', 'unanswered'].includes(options?.sort) ? options.sort : 'newest';
    const result = await client.request(`/api/feedback?sort=${sort}`, { headers: { 'Cache-Control': 'no-cache' } });
    return result.success ? { success: true, data: result.data } : { success: false, code: result.code, error: result.message };
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

module.exports = { registerCommunityIpc, allowedCommunityPath };
