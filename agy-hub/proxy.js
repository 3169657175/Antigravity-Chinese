const http = require('http');
const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const net = require('net');
const zlib = require('zlib');
const { app, session } = require('electron');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { buildTokenStats, extractOfficialUsage, shouldTrackModelRequest } = require('./tokenUsage');
const { TokenStatsStore } = require('./tokenStatsStore');
const {
  configureAntigravityModelCatalog,
  captureAntigravityModelCatalog
} = require('./antigravityModelCatalog');

const DEFAULT_API_UPSTREAM = 'https://generativelanguage.googleapis.com';
const DEFAULT_CLOUD_UPSTREAM = 'https://daily-cloudcode-pa.googleapis.com';
const MAX_CAPTURE_BYTES = 32 * 1024 * 1024;
const LOCAL_MONITOR_PORTS = new Set([31000, 31001]);

let proxyServers = [];
let activeRoutes = new Map();
let activeMainWindow = null;
let tokenStatsStore = null;

function defaultStats() {
  return buildTokenStats([]);
}

function getTokenStatsStore() {
  if (!tokenStatsStore) {
    const userData = app.getPath('userData');
    tokenStatsStore = new TokenStatsStore({
      snapshotPath: path.join(userData, 'token_stats.json'),
      journalPath: path.join(userData, 'token-events.jsonl')
    });
  }
  return tokenStatsStore;
}

function saveTokenLog(logEntry) {
  try {
    return getTokenStatsStore().record(logEntry);
  } catch (error) {
    console.error('[Token Monitor] Failed to save stats:', error);
    return null;
  }
}

function checkPortAlive(host, port, timeoutMs = 200) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (alive) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(alive);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

function normalizeProxyAddress(rawValue) {
  if (!rawValue) return null;
  try {
    const raw = String(rawValue).startsWith('http') ? String(rawValue) : `http://${rawValue}`;
    const parsed = new URL(raw);
    const port = Number(parsed.port || 80);
    if (!parsed.hostname || !port || LOCAL_MONITOR_PORTS.has(port)) return null;
    return { url: `http://${parsed.hostname}:${port}`, host: parsed.hostname, port };
  } catch (e) {
    return null;
  }
}

async function detectLocalProxy() {
  try {
    if (session && session.defaultSession) {
      const proxyString = await session.defaultSession.resolveProxy(DEFAULT_API_UPSTREAM);
      const proxyPart = String(proxyString || '')
        .split(';')
        .find(part => part.trim().startsWith('PROXY'));
      const candidate = normalizeProxyAddress(proxyPart && proxyPart.replace('PROXY', '').trim());
      if (candidate && await checkPortAlive(candidate.host, candidate.port, 150)) return candidate.url;
    }
  } catch (e) {}

  const envProxies = [
    process.env.HTTP_PROXY,
    process.env.HTTPS_PROXY,
    process.env.ALL_PROXY,
    process.env.http_proxy,
    process.env.https_proxy,
    process.env.all_proxy
  ].filter(Boolean);
  for (const raw of envProxies) {
    const candidate = normalizeProxyAddress(raw);
    if (candidate && await checkPortAlive(candidate.host, candidate.port, 150)) return candidate.url;
  }

  if (process.platform === 'win32') {
    try {
      const { execFileSync } = require('child_process');
      const registry = execFileSync('reg', [
        'query',
        'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings',
        '/v',
        'ProxyServer'
      ], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
      const match = /ProxyServer\s+REG_SZ\s+(.+)/i.exec(registry);
      if (match && match[1]) {
        let value = match[1].trim();
        if (value.includes('=')) {
          const part = value.split(';').find(item => /^(http|https)=/i.test(item));
          if (part) value = part.slice(part.indexOf('=') + 1);
        }
        const candidate = normalizeProxyAddress(value);
        if (candidate && await checkPortAlive(candidate.host, candidate.port, 150)) return candidate.url;
      }
    } catch (e) {}
  }

  for (const port of [7890, 7897, 10809, 10889, 2080, 1080, 7891, 10808, 8888]) {
    if (await checkPortAlive('127.0.0.1', port, 100)) return `http://127.0.0.1:${port}`;
  }
  return null;
}

function notifyFrontend(mainWindow, logEntry, stats) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('token-log-update', { type: 'stats', stats });
    mainWindow.webContents.send('token-log-update', {
      type: 'res',
      timestamp: logEntry.time,
      duration: logEntry.duration,
      promptTokens: logEntry.input,
      completionTokens: logEntry.output,
      cachedTokens: logEntry.cached,
      cacheKnown: Boolean(logEntry.cacheKnown),
      model: logEntry.model,
      estimated: Boolean(logEntry.estimated),
      source: logEntry.source,
      requestPath: logEntry.requestPath,
      contentType: logEntry.contentType,
      usageProtocol: logEntry.usageProtocol,
      accountId: logEntry.accountId
    });
  } catch (e) {}
}

function notifyStatus(mainWindow, message) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try {
    mainWindow.webContents.send('token-log-update', {
      type: 'system',
      timestamp: new Date().toISOString(),
      message
    });
  } catch (e) {}
}

function recordTokenLog(logEntry) {
  const stats = saveTokenLog(logEntry);
  if (stats) notifyFrontend(activeMainWindow, logEntry, stats);
  return stats;
}

function toFiniteNumber(value) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : undefined;
}

function firstNumber(object, keys) {
  for (const key of keys) {
    if (!object || object[key] === undefined) continue;
    const value = toFiniteNumber(object[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function usageFromObject(value, depth = 0, seen = new Set()) {
  if (!value || typeof value !== 'object' || depth > 12 || seen.has(value)) return null;
  seen.add(value);

  const candidates = [];
  if (Array.isArray(value)) candidates.push(...value);
  else {
    for (const key of ['usageMetadata', 'usage_metadata', 'usage', 'tokenUsage', 'token_usage']) {
      if (value[key] && typeof value[key] === 'object') candidates.push(value[key]);
    }
    candidates.push(value);
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const input = firstNumber(candidate, [
      'promptTokenCount', 'prompt_token_count', 'prompt_tokens', 'inputTokenCount',
      'input_token_count', 'input_tokens', 'inputTokens', 'promptTokens'
    ]);
    const output = firstNumber(candidate, [
      'candidatesTokenCount', 'candidates_token_count', 'completion_tokens',
      'outputTokenCount', 'output_token_count', 'output_tokens', 'outputTokens', 'completionTokens'
    ]);
    const cachedDetails = candidate.prompt_tokens_details || candidate.input_tokens_details || {};
    const cached = firstNumber(candidate, [
      'cachedContentTokenCount', 'cached_content_token_count', 'cachedTokenCount',
      'cached_token_count', 'cached_tokens', 'cachedTokens'
    ]) ?? firstNumber(cachedDetails, ['cached_tokens', 'cachedTokens']);

    if (input !== undefined || output !== undefined || cached !== undefined) {
      return { input: input || 0, output: output || 0, cached: cached || 0 };
    }
  }

  if (!Array.isArray(value)) {
    for (const child of Object.values(value)) {
      const usage = usageFromObject(child, depth + 1, seen);
      if (usage) return usage;
    }
  }
  return null;
}

function mergeUsage(current, next) {
  if (!next) return current;
  if (!current) return next;
  return {
    input: Math.max(current.input || 0, next.input || 0),
    output: Math.max(current.output || 0, next.output || 0),
    cached: Math.max(current.cached || 0, next.cached || 0)
  };
}

function extractUsageFromText(text) {
  if (!text || !text.trim()) return null;
  let usage = null;
  const tryJson = (candidate) => {
    try {
      usage = mergeUsage(usage, usageFromObject(JSON.parse(candidate)));
    } catch (e) {}
  };

  tryJson(text.trim());
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line === 'data: [DONE]') continue;
    if (line.startsWith('data:')) line = line.slice(5).trim();
    if (line) tryJson(line);
  }

  if (!usage) {
    const prompt = /["'](?:promptTokenCount|prompt_token_count|prompt_tokens|inputTokenCount|input_tokens)["']\s*:\s*(\d+)/i.exec(text);
    const output = /["'](?:candidatesTokenCount|candidates_token_count|completion_tokens|outputTokenCount|output_tokens)["']\s*:\s*(\d+)/i.exec(text);
    const cached = /["'](?:cachedContentTokenCount|cached_content_token_count|cached_tokens)["']\s*:\s*(\d+)/i.exec(text);
    if (prompt || output || cached) {
      usage = {
        input: prompt ? Number(prompt[1]) : 0,
        output: output ? Number(output[1]) : 0,
        cached: cached ? Number(cached[1]) : 0
      };
    }
  }
  return usage;
}

function decodeResponse(buffer, encoding) {
  return new Promise((resolve) => {
    const normalized = String(encoding || '').trim().toLowerCase();
    const done = (error, decoded) => resolve(error ? buffer : decoded);
    if (normalized.includes('br')) return zlib.brotliDecompress(buffer, done);
    if (normalized.includes('gzip')) return zlib.gunzip(buffer, done);
    if (normalized.includes('deflate')) return zlib.inflate(buffer, done);
    resolve(buffer);
  });
}

function estimateTokens(buffer) {
  if (!buffer || buffer.length === 0) return 0;
  const text = buffer.toString('utf8').replace(/[\u0000-\u0008\u000e-\u001f]/g, '');
  const meaningfulLength = text.trim().length;
  return Math.max(1, Math.ceil((meaningfulLength || buffer.length) / 3.5));
}

function extractModel(requestBody) {
  try {
    const parsed = JSON.parse(requestBody.toString('utf8'));
    const visit = (value, depth = 0) => {
      if (!value || typeof value !== 'object' || depth > 8) return null;
      if (typeof value.model === 'string') return value.model;
      for (const child of Object.values(value)) {
        const result = visit(child, depth + 1);
        if (result) return result;
      }
      return null;
    };
    return visit(parsed) || 'Antigravity Model';
  } catch (e) {
    return 'Antigravity Model';
  }
}

function shouldTrackRequest(method, requestUrl, service) {
  return shouldTrackModelRequest(method, requestUrl, service);
}

function createForwardOptions(request, upstreamUrl, outboundProxy) {
  const headers = { ...request.headers, host: upstreamUrl.host };
  delete headers.connection;
  delete headers['proxy-connection'];
  const options = { method: request.method, headers };
  if (outboundProxy && upstreamUrl.protocol === 'https:') {
    options.agent = new HttpsProxyAgent(outboundProxy);
  }
  return options;
}

function handleManualReport(req, res, mainWindow) {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const logEntry = {
        id: Date.now().toString(),
        time: new Date().toISOString(),
        model: payload.model || 'Manual report',
        input: toFiniteNumber(payload.promptTokens ?? payload.input) || 0,
        output: toFiniteNumber(payload.completionTokens ?? payload.output) || 0,
        cached: toFiniteNumber(payload.cachedTokens ?? payload.cached) || 0,
        cacheKnown: Boolean(payload.cacheKnown),
        duration: toFiniteNumber(payload.duration) || 0,
        estimated: Boolean(payload.estimated),
        source: payload.source || 'manual'
      };
      const stats = saveTokenLog(logEntry);
      notifyFrontend(mainWindow, logEntry, stats);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
}

function createReverseProxyServer(route, mainWindow) {
  const server = http.createServer((req, res) => {
    const currentRoute = activeRoutes.get(route.port) || route;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (route.port === 31000 && req.url === '/report-token' && req.method === 'POST') {
      handleManualReport(req, res, mainWindow);
      return;
    }

    const startedAt = Date.now();
    const requestChunks = [];
    req.on('data', chunk => requestChunks.push(chunk));
    req.on('end', async () => {
      const requestBody = Buffer.concat(requestChunks);
      let upstreamUrl;
      try {
        upstreamUrl = new URL(req.url, currentRoute.upstream);
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid upstream URL', message: error.message }));
        return;
      }

      const outboundProxy = await detectLocalProxy();
      const requestLibrary = upstreamUrl.protocol === 'https:' ? https : http;
      const upstreamRequest = requestLibrary.request(
        upstreamUrl,
        createForwardOptions(req, upstreamUrl, outboundProxy),
        (upstreamResponse) => {
          res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
          const responseChunks = [];
          let capturedBytes = 0;
          let captureOverflow = false;

          upstreamResponse.on('data', (chunk) => {
            res.write(chunk);
            if (!captureOverflow && capturedBytes + chunk.length <= MAX_CAPTURE_BYTES) {
              responseChunks.push(chunk);
              capturedBytes += chunk.length;
            } else {
              captureOverflow = true;
            }
          });

          upstreamResponse.on('end', async () => {
            res.end();
            if ((upstreamResponse.statusCode || 500) < 200 || (upstreamResponse.statusCode || 500) >= 300) return;

            const trackUsage = shouldTrackRequest(req.method, req.url, currentRoute.service);
            const capturesModelCatalog = currentRoute.service === 'cloud-code'
              && /\/v1internal:fetchAvailableModels(?:\?|$)/i.test(String(req.url || ''));
            if (!trackUsage && !capturesModelCatalog) return;
            if (captureOverflow) return;

            const compressed = Buffer.concat(responseChunks);
            const decoded = await decodeResponse(compressed, upstreamResponse.headers['content-encoding']);
            const contentType = String(upstreamResponse.headers['content-type'] || '');
            if (capturesModelCatalog && /json/i.test(contentType)) {
              configureAntigravityModelCatalog(app.getPath('userData'));
              const catalog = captureAntigravityModelCatalog(decoded, {
                source: 'antigravity-proxy',
                endpoint: req.url
              });
              if (catalog.updated) {
                console.log(`[Model Catalog] Captured ${catalog.models.length} Antigravity models from fetchAvailableModels`);
              }
            }
            if (!trackUsage) return;
            const officialUsage = extractOfficialUsage(decoded, contentType);
            const logEntry = {
              id: Date.now().toString(),
              time: new Date().toISOString(),
              model: extractModel(requestBody),
              input: officialUsage ? officialUsage.input : estimateTokens(requestBody),
              output: officialUsage ? officialUsage.output : estimateTokens(decoded),
              cached: officialUsage ? officialUsage.cached : 0,
              cacheKnown: Boolean(officialUsage && officialUsage.cacheKnown),
              duration: Date.now() - startedAt,
              estimated: !officialUsage,
              source: currentRoute.service,
              captureOverflow,
              requestPath: req.url,
              contentType,
              responseBytes: decoded.length,
              usageProtocol: officialUsage ? officialUsage.protocol : 'unparsed'
            };
            if (logEntry.input > 0 || logEntry.output > 0) {
              const stats = saveTokenLog(logEntry);
              notifyFrontend(mainWindow, logEntry, stats);
            }
          });
        }
      );

      upstreamRequest.on('error', (error) => {
        console.error(`[Token Monitor] ${currentRoute.service} proxy failed:`, error);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Proxy Gateway Connection Failed', message: error.message }));
        } else {
          res.end();
        }
      });
      if (requestBody.length > 0) upstreamRequest.write(requestBody);
      upstreamRequest.end();
    });
  });

  server.on('connect', async (req, clientSocket, head) => {
    const [targetHost, rawPort] = String(req.url || '').split(':');
    const targetPort = Number(rawPort || 443);
    if (!targetHost || !targetPort) {
      clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
      return;
    }
    const outboundProxy = await detectLocalProxy();
    if (outboundProxy) {
      const parsed = new URL(outboundProxy);
      const proxySocket = net.connect(Number(parsed.port || 80), parsed.hostname, () => {
        proxySocket.write(`CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\n\r\n`);
      });
      let connected = false;
      proxySocket.on('data', (chunk) => {
        if (!connected) {
          connected = true;
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          if (head && head.length) proxySocket.write(head);
          clientSocket.pipe(proxySocket);
          proxySocket.pipe(clientSocket);
        }
      });
      proxySocket.on('error', () => clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
      clientSocket.on('error', () => proxySocket.destroy());
      return;
    }

    const serverSocket = net.connect(targetPort, targetHost, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head && head.length) serverSocket.write(head);
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
    });
    serverSocket.on('error', () => clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n'));
    clientSocket.on('error', () => serverSocket.destroy());
  });
  return server;
}

function startProxy(mainWindow, port = 31000, upstream = DEFAULT_API_UPSTREAM) {
  activeMainWindow = mainWindow || activeMainWindow;
  const apiPort = Number(port) || 31000;
  const routes = [
    { port: apiPort, upstream: upstream || DEFAULT_API_UPSTREAM, service: 'generative-language' },
    { port: apiPort + 1, upstream: DEFAULT_CLOUD_UPSTREAM, service: 'cloud-code' }
  ];

  if (proxyServers.length > 0) {
    const samePorts = routes.every(route => activeRoutes.has(route.port));
    if (samePorts) {
      activeRoutes = new Map(routes.map(route => [route.port, route]));
      notifyStatus(activeMainWindow, `Token monitor active on ${apiPort}/${apiPort + 1}`);
      return;
    }
    for (const server of proxyServers) {
      try { server.close(); } catch (e) {}
    }
    proxyServers = [];
  }

  activeRoutes = new Map(routes.map(route => [route.port, route]));
  for (const route of routes) {
    const server = createReverseProxyServer(route, activeMainWindow);
    server.on('error', error => {
      console.error(`[Token Monitor] Failed to listen on ${route.port}:`, error);
      notifyStatus(activeMainWindow, `Token monitor port ${route.port} failed: ${error.message}`);
    });
    server.listen(route.port, '127.0.0.1', () => {
      console.log(`[Token Monitor] ${route.service} listening on 127.0.0.1:${route.port} -> ${route.upstream}`);
      notifyStatus(activeMainWindow, `${route.service} monitor ready on ${route.port}`);
    });
    proxyServers.push(server);
  }
}

function stopProxy() {
  for (const server of proxyServers) {
    try { server.close(); } catch (e) {}
  }
  proxyServers = [];
  activeRoutes = new Map();
  try { tokenStatsStore?.flush(); } catch (error) { console.error('[Token Store] Final flush failed:', error); }
}

function getInitialStats() {
  try {
    return getTokenStatsStore().getStats();
  } catch (e) {}
  return defaultStats();
}

function getProxyStatus() {
  const routes = Array.from(activeRoutes.values()).map(route => ({
    port: route.port,
    service: route.service,
    upstream: route.upstream
  }));
  const listeningPorts = proxyServers
    .filter(server => server.listening)
    .map(server => {
      const address = server.address();
      return address && typeof address === 'object' ? address.port : null;
    })
    .filter(Boolean);

  return {
    ready: routes.length > 0 && routes.every(route => listeningPorts.includes(route.port)),
    listeningPorts,
    routes
  };
}

module.exports = { startProxy, stopProxy, getInitialStats, getProxyStatus, recordTokenLog };
