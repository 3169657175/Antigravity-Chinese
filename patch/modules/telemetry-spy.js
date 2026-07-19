/**
 * modules/telemetry-spy.js
 * Antigravity-Chinese v2 - 缃戠粶娴侀噺鐩戝惉妯″潡
 * 鐙珛妯″潡锛屾棤澶栭儴渚濊禆
 * 鎻愪緵锛歳unGrpcSniff, startStartupSniff, parseAndStoreQuotaJson
 * 閫氳繃 webFrame.executeJavaScript 娉ㄥ叆 Fetch/XHR/WebSocket/EventSource Spy
 */

function runGrpcSniff() {
  const log = (msg) => {
    try { electron_1.ipcRenderer.invoke('debug:log', '[preload] ' + msg); } catch(e) {}
  };
  log('runGrpcSniff called');
  if (window.antigravitySniffingInProgress) { log('Sniff already in progress, skipping'); return; }
  window.antigravitySniffingInProgress = true;
  log('Invoking accounts:sniff...');
  electron_1.ipcRenderer.invoke('accounts:sniff').then(sniffRes => {
    window.antigravitySniffingInProgress = false;
    log('accounts:sniff result: ' + JSON.stringify(sniffRes));
    if (sniffRes && sniffRes.success && (sniffRes.newlySaved || sniffRes.updatedCurrent)) {
      log('Sniff registered change, reloading accounts...');
      electron_1.ipcRenderer.invoke('accounts:list').then(newList => {
        window.antigravityAccounts = newList.accounts || [];
        window.antigravityCurrentAccount = newList.currentAccountId || '';
        log('Accounts reloaded, current=' + window.antigravityCurrentAccount);
        injectQuotaWidget();
      });
    }
  }).catch(err => {
    window.antigravitySniffingInProgress = false;
    log('Sniff invoke error: ' + err.message);
  });
}

let startupSniffInterval;
function startStartupSniff() {
  const log = (msg) => {
    try { electron_1.ipcRenderer.invoke('debug:log', '[preload-startup] ' + msg); } catch(e) {}
  };
  log('startStartupSniff initiated');
  let tries = 0;
  startupSniffInterval = setInterval(() => {
    tries++;
    if (window.antigravitySniffingInProgress) return;
    window.antigravitySniffingInProgress = true;
    log('Startup sniff try #' + tries);
    electron_1.ipcRenderer.invoke('accounts:sniff').then(sniffRes => {
      window.antigravitySniffingInProgress = false;
      log('Startup sniff try #' + tries + ' response: ' + JSON.stringify(sniffRes));
      if (sniffRes && sniffRes.success) {
        log('Startup sniff succeeded, clearing startup loop.');
        clearInterval(startupSniffInterval);
        electron_1.ipcRenderer.invoke('accounts:list').then(newList => {
          window.antigravityAccounts = newList.accounts || [];
          window.antigravityCurrentAccount = newList.currentAccountId || '';
          log('Startup accounts synced, current=' + window.antigravityCurrentAccount);
          injectQuotaWidget();
        });
      }
      if (tries >= 15) { log('Startup sniff reached maximum tries, clearing.'); clearInterval(startupSniffInterval); }
    }).catch(err => {
      window.antigravitySniffingInProgress = false;
      log('Startup sniff error: ' + err.message);
      if (tries >= 15) clearInterval(startupSniffInterval);
    });
  }, 2000);
}

// Network Telemetry Spy (注入到渲染进程隔离环境)
function injectTelemetrySpy() {
  try {
    const spyCode = `
      (() => {
        function logUrl(url, method, responseText) {
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              const short = responseText ? responseText.slice(0, 200) : '';
              window.mcpLogger.writeLog('[NET] ' + method + ' ' + url + '\\n  body=' + short + '\\n');
            }
          } catch(e) {}
        }

        function parseAndStoreQuotaJson(json) {
          try {
            function deepSearch(obj) {
              if (!obj || typeof obj !== 'object') return;
              for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                  const val = obj[key];
                  if (key === 'gemini' || key === 'geminiModels' || key.includes('gemini')) {
                    extractGroupQuota(val, 'gemini');
                  } else if (key === 'claude' || key === 'claudeGpt' || key.includes('claude') || key.includes('gpt')) {
                    extractGroupQuota(val, 'claude');
                  } else {
                    deepSearch(val);
                  }
                }
              }
            }

            function extractGroupQuota(groupObj, type) {
              if (!groupObj || typeof groupObj !== 'object') return;
              let weeklyUsed = null;
              let fiveHourUsed = null;
              for (const k in groupObj) {
                const sub = groupObj[k];
                if (sub && typeof sub === 'object') {
                  const p = sub.percentUsed !== undefined ? sub.percentUsed : sub.percent_used;
                  if (p !== undefined) {
                    if (k.toLowerCase().includes('week')) weeklyUsed = p;
                    else if (k.toLowerCase().includes('five') || k.toLowerCase().includes('5h') || k.toLowerCase().includes('hour')) fiveHourUsed = p;
                  }
                }
              }
              if (weeklyUsed !== null) {
                const pct = Math.max(0, Math.min(100, Math.round((1 - weeklyUsed) * 100))) + '%';
                localStorage.setItem('quota_' + type + '_weekly', pct);
                localStorage.setItem('quota_' + type + '_ts', Date.now()); // 鍐欏叆鏃堕棿鎴筹紝闃叉薄鏌撳垽鏂敤
              }
              if (fiveHourUsed !== null) {
                const pct = Math.max(0, Math.min(100, Math.round((1 - fiveHourUsed) * 100))) + '%';
                localStorage.setItem('quota_' + type + '_5h', pct);
              }
            }

            deepSearch(json);
          } catch (e) {}
        }

        // Fetch Spy
        const origFetch = window.fetch;
        window.fetch = async function(...args) {
          const url = args[0];
          const options = args[1] || {};
          const method = options.method || 'GET';
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[FETCH_REQ] url=' + url + ' method=' + method + '\\n');
            }
          } catch(e) {}
          const res = await origFetch.apply(this, args);
          try {
            if (typeof url === 'string') {
              const clone = res.clone();
              const text = await clone.text();
              logUrl(url, method, text);
              if (text.includes('limit') || text.includes('quota') || text.includes('percentUsed')) {
                try { const json = JSON.parse(text); parseAndStoreQuotaJson(json); } catch(e) {}
              }
            }
          } catch (e) {}
          return res;
        };

        // XMLHttpRequest Spy
        const origSend = XMLHttpRequest.prototype.send;
        const origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          this._url = url;
          this._method = method;
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[XHR_REQ] url=' + url + ' method=' + method + '\\n');
            }
          } catch(e) {}
          return origOpen.apply(this, [method, url, ...args]);
        };
        XMLHttpRequest.prototype.send = function(...args) {
          const self = this;
          this.addEventListener('load', function() {
            try {
              const text = self.responseText;
              logUrl(self._url, self._method, text);
              if (text.includes('limit') || text.includes('quota') || text.includes('percentUsed')) {
                try { const json = JSON.parse(text); parseAndStoreQuotaJson(json); } catch(e) {}
              }
            } catch(e) {}
          });
          return origSend.apply(this, args);
        };

        // WebSocket Spy
        const OrigWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[WS_OPEN] url=' + url + '\\n');
            }
          } catch(e) {}
          const ws = new OrigWebSocket(url, protocols);
          function logWs(direction, data) {
            try {
              let strData = '';
              if (typeof data === 'string') strData = data;
              else if (data instanceof ArrayBuffer) strData = new TextDecoder('utf-8').decode(data);
              else if (data instanceof Blob) { data.text().then(t => logWs(direction, t)); return; }
              if (!strData) return;
              logUrl(url, direction, strData);
              if (strData.includes('percentUsed') || strData.includes('Limit') || strData.includes('quota') || strData.includes('weekly')) {
                try { const json = JSON.parse(strData); parseAndStoreQuotaJson(json); } catch (e) {}
              }
            } catch(e) {}
          }
          ws.addEventListener('message', function(event) { logWs('WS_RECV', event.data); });
          const origSend = ws.send;
          ws.send = function(data) { logWs('WS_SEND', data); return origSend.apply(ws, arguments); };
          return ws;
        };
        window.WebSocket.prototype = OrigWebSocket.prototype;

        // EventSource Spy
        const OrigEventSource = window.EventSource;
        window.EventSource = function(url, configuration) {
          try {
            if (window.mcpLogger && window.mcpLogger.writeLog) {
              window.mcpLogger.writeLog('[SSE_OPEN] url=' + url + '\\n');
            }
          } catch(e) {}
          const es = new OrigEventSource(url, configuration);
          es.addEventListener('message', function(event) {
            logUrl(url, 'SSE_RECV', event.data);
            if (event.data && (event.data.includes('limit') || event.data.includes('quota') || event.data.includes('percentUsed'))) {
              try { const json = JSON.parse(event.data); parseAndStoreQuotaJson(json); } catch(e) {}
            }
          });
          return es;
        };
        window.EventSource.prototype = OrigEventSource.prototype;
      })();
    `;
    electron_1.webFrame.executeJavaScript(spyCode);
  } catch (e) {
    console.error('Network telemetry spy injection failed:', e);
  }
}

module.exports = { runGrpcSniff, startStartupSniff, injectTelemetrySpy };
