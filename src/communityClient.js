const fs = require('fs');
const path = require('path');
const { readJsonSafe, writeJsonAtomic } = require('./fsUtils');

const DEFAULT_API_BASE = 'https://nhw1029.pages.dev/api';

function normalizeApiBase(value) {
  const text = String(value || '').trim().replace(/\/$/, '');
  if (!text) return '';
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:') return '';
    return url.toString().replace(/\/$/, '');
  } catch (_) {
    return '';
  }
}

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
    this.apiBase = normalizeApiBase(options.apiBase || DEFAULT_API_BASE) || DEFAULT_API_BASE;
    const fallback = normalizeApiBase(options.fallbackApiBase || process.env.AGY_COMMUNITY_FALLBACK_API_BASE);
    this.fallbackApiBase = fallback && fallback !== this.apiBase ? fallback : '';
    this.cacheFilePath = options.cacheFilePath || (this.authFilePath ? path.join(path.dirname(this.authFilePath), 'community-read-cache.json') : '');
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

  readCache(key) {
    if (!this.cacheFilePath || !key) return null;
    const cache = readJsonSafe(this.cacheFilePath, {});
    const entry = cache && cache[key];
    return entry && Object.prototype.hasOwnProperty.call(entry, 'data') ? entry : null;
  }

  writeCache(key, data) {
    if (!this.cacheFilePath || !key) return;
    const cache = readJsonSafe(this.cacheFilePath, {}) || {};
    cache[key] = { savedAt: Date.now(), data };
    writeJsonAtomic(this.cacheFilePath, cache);
  }

  async requestOnce(base, resource, options, preparedBody, headers) {
    const url = new URL(String(resource || ''), `${base}/`);
    if (url.origin !== new URL(base).origin || !url.pathname.startsWith('/api/')) throw new Error('社区请求地址不在允许范围内');
    const controller = new AbortController();
    const timeoutMs = Math.max(2500, Math.min(20000, Number(options.timeoutMs) || 8000));
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetch(url.toString(), {
        method: String(options.method || 'GET').toUpperCase(),
        headers,
        body: preparedBody,
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
      return { success: true, ok: true, status: response.status, data, endpoint: url.origin };
    } catch (error) {
      const timeout = error.name === 'AbortError';
      return { success: false, ok: false, status: 0, data: {}, code: timeout ? 'TIMEOUT' : 'NETWORK_ERROR', message: timeout ? '社区请求超时，请检查网络后重试' : '无法连接社区服务，请检查网络后重试', retryable: true };
    } finally {
      clearTimeout(timer);
    }
  }

  async request(resource, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
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

    // 只读请求才允许切到备用源；写请求绝不自动重放，避免网络边界模糊时重复提交。
    const bases = method === 'GET' && this.fallbackApiBase ? [this.apiBase, this.fallbackApiBase] : [this.apiBase];
    let last = null;
    for (const base of bases) {
      last = await this.requestOnce(base, resource, options, body, headers);
      if (last.success) {
        if (method === 'GET' && options.cacheKey) this.writeCache(options.cacheKey, last.data);
        return last;
      }
      if (!last.retryable) return last;
    }

    if (method === 'GET' && options.cacheKey) {
      const cached = this.readCache(options.cacheKey);
      if (cached) {
        return { success: true, ok: true, status: 200, data: cached.data, stale: true, fromCache: true, savedAt: cached.savedAt, warning: last?.message || '正在显示上次成功同步的数据' };
      }
    }
    return last || { success: false, ok: false, status: 0, data: {}, code: 'NETWORK_ERROR', message: '无法连接社区服务', retryable: true };
  }

  async login(username, password) {
    const result = await this.request('/api/auth/login', { method: 'POST', auth: false, body: { username, password } });
    if (!result.success || !result.data?.success) return { ...result, error: result.message || result.data?.error || '登录失败' };
    return { success: true, data: this.saveSession(result.data.data || result.data) };
  }
}

module.exports = { CommunityClient, DEFAULT_API_BASE, normalizeApiBase, classifyCommunityError };
