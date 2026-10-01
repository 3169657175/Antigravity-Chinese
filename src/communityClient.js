const fs = require('fs');
const path = require('path');
const { readJsonSafe, writeJsonAtomic } = require('./fsUtils');

const DEFAULT_API_BASE = 'https://nhw1029.pages.dev/api';

function classifyCommunityError(status, payload, fallback = '') {
  const remote = String(payload && (payload.error || payload.message) || '').trim();
  if (status === 401) return { code: 'AUTH_EXPIRED', message: '登录授权已失效，请重新登录', retryable: false };
  if (status === 403) return { code: 'PERMISSION_DENIED', message: remote || '当前账号没有执行此操作的权限', retryable: false };
  if (status === 404) return { code: 'NOT_FOUND', message: remote || '请求的社区内容不存在或已被删除', retryable: false };
  if (status === 429) return { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试', retryable: true };
  if (status >= 500) return { code: 'SERVER_UNAVAILABLE', message: '社区服务暂时不可用，请稍后重试', retryable: true };
  return { code: 'COMMUNITY_REQUEST_FAILED', message: remote || fallback || `社区请求失败（HTTP ${status}）`, retryable: status === 0 };
}

class CommunityClient {
  constructor(options) {
    this.fetch = options.fetch;
    this.authFilePath = options.authFilePath;
    this.apiBase = String(options.apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
  }

  readSession() {
    const raw = readJsonSafe(this.authFilePath, null);
    const user = raw && (raw.data || raw);
    if (!user || typeof user !== 'object') return null;
    return {
      token: typeof user.token === 'string' ? user.token : '',
      username: typeof user.username === 'string' ? user.username : '',
      role: typeof user.role === 'string' ? user.role : ''
    };
  }

  saveSession(user) {
    const clean = { token: String(user.token || ''), username: String(user.username || ''), role: String(user.role || '') };
    writeJsonAtomic(this.authFilePath, clean);
    return clean;
  }

  clearSession() {
    fs.rmSync(this.authFilePath, { force: true });
  }

  async request(resource, options = {}) {
    const url = new URL(String(resource || ''), `${this.apiBase}/`);
    if (url.origin !== new URL(this.apiBase).origin || !url.pathname.startsWith('/api/')) {
      throw new Error('社区请求地址不在允许范围内');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(3000, Math.min(30000, Number(options.timeoutMs) || 15000)));
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    delete headers.Authorization;
    delete headers.authorization;
    const session = this.readSession();
    if (options.auth !== false && session?.token) headers.Authorization = `Bearer ${session.token}`;
    let body = options.body;
    if (body !== undefined && body !== null && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    try {
      const response = await this.fetch(url.toString(), {
        method: String(options.method || 'GET').toUpperCase(),
        headers,
        body,
        cache: options.cache,
        signal: controller.signal
      });
      const text = await response.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text.slice(0, 500) }; }
      if (!response.ok) {
        const classified = classifyCommunityError(response.status, data);
        return { success: false, ok: false, status: response.status, data, ...classified };
      }
      return { success: true, ok: true, status: response.status, data };
    } catch (error) {
      const message = error.name === 'AbortError' ? '社区请求超时，请检查网络后重试' : '无法连接社区服务，请检查网络后重试';
      return { success: false, ok: false, status: 0, data: {}, code: error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR', message, retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async login(username, password) {
    const result = await this.request('/api/auth/login', { method: 'POST', auth: false, body: { username, password } });
    if (!result.success || !result.data?.success) return { ...result, error: result.message || result.data?.error || '登录失败' };
    return { success: true, data: this.saveSession(result.data.data || result.data) };
  }
}

module.exports = { CommunityClient, DEFAULT_API_BASE, classifyCommunityError };
