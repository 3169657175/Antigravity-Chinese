const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const QUOTA_RPC_PATH = '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';
const CACHE_TTL_MS = 2500;
let cachedResult = null;
let cachedAt = 0;
let pendingRequest = null;

function isLoopbackUrl(value, protocols = ['http:', 'https:']) {
  try {
    const url = new URL(String(value || ''));
    return protocols.includes(url.protocol) && ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  } catch (_) {
    return false;
  }
}

function requestText(urlValue, options = {}) {
  const url = new URL(urlValue);
  const transport = url.protocol === 'https:' ? https : http;
  const timeoutMs = Math.max(250, Number(options.timeoutMs) || 1500);
  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      rejectUnauthorized: options.rejectUnauthorized !== false
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          reject(new Error(`Antigravity local service returned HTTP ${response.statusCode || 0}`));
          return;
        }
        resolve(body);
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('Antigravity local service timed out')));
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

async function requestJson(url, options = {}) {
  return JSON.parse(await requestText(url, options));
}

function parseAppConfig(html) {
  const match = String(html || '').match(/window\.__APP_CONFIG__\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (!match) throw new Error('Antigravity local runtime configuration was not found');
  const config = JSON.parse(match[1]);
  if (!config.csrfToken) throw new Error('Antigravity local CSRF token was not found');
  return config;
}

async function discoverRuntime(options = {}) {
  const appData = options.appData || process.env.APPDATA || '';
  const portFile = options.portFile || path.join(appData, 'Antigravity', 'DevToolsActivePort');
  const requestJsonFn = options.requestJson || requestJson;
  const requestTextFn = options.requestText || requestText;
  if (!fs.existsSync(portFile)) throw new Error('Antigravity is not running');
  const [portLine] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
  const port = Number(portLine);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Antigravity debug port is invalid');
  const debugUrl = `http://127.0.0.1:${port}/json/list`;
  const targets = await requestJsonFn(debugUrl, { timeoutMs: options.timeoutMs });
  const target = (Array.isArray(targets) ? targets : []).find(item => item?.type === 'page' && isLoopbackUrl(item.url, ['https:']));
  if (!target) throw new Error('Antigravity local language service was not found');
  const targetUrl = new URL(target.url);
  const pageHtml = await requestTextFn(targetUrl.href, { timeoutMs: options.timeoutMs, rejectUnauthorized: false });
  const config = parseAppConfig(pageHtml);
  return { origin: targetUrl.origin, csrfToken: String(config.csrfToken), appVersion: String(config.appVersion || '') };
}

async function readLiveQuota(options = {}) {
  const requestJsonFn = options.requestJson || requestJson;
  const runtime = await discoverRuntime(options);
  if (!isLoopbackUrl(runtime.origin, ['https:'])) throw new Error('Antigravity local service address is not loopback');
  const response = await requestJsonFn(`${runtime.origin}${QUOTA_RPC_PATH}`, {
    method: 'POST',
    timeoutMs: options.timeoutMs,
    rejectUnauthorized: false,
    headers: {
      'Content-Type': 'application/json',
      'x-codeium-csrf-token': runtime.csrfToken
    },
    body: '{}'
  });
  const summary = response?.response || response;
  if (!Array.isArray(summary?.groups)) throw new Error('Antigravity local quota response is incomplete');
  return { summary, appVersion: runtime.appVersion };
}

async function fetchLiveQuotaSummary(options = {}) {
  const now = Date.now();
  if (!options.force && cachedResult && now - cachedAt < CACHE_TTL_MS) return cachedResult;
  if (!options.force && pendingRequest) return pendingRequest;
  pendingRequest = readLiveQuota(options)
    .then(result => {
      cachedResult = result;
      cachedAt = Date.now();
      return result;
    })
    .finally(() => { pendingRequest = null; });
  return pendingRequest;
}

function clearQuotaBridgeCache() {
  cachedResult = null;
  cachedAt = 0;
  pendingRequest = null;
}

module.exports = { fetchLiveQuotaSummary, discoverRuntime, parseAppConfig, isLoopbackUrl, clearQuotaBridgeCache };
