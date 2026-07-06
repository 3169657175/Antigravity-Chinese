/**
 * core/loader.js
 * Antigravity-Chinese v2 - 模块加载器 (CommonJS 规范版)
 * 
 * 职责：
 * 使用原生 require 载入子模块，绕过渲染进程的 Content Security Policy (CSP) unsafe-eval 限制。
 */

const AGY_CONFIG = {
  translation:     true,   // 汉化翻译引擎
  cloudDict:       true,   // 云端词典自动更新
  quotaWidget:     true,   // 左下角额度显示组件
  accountSwitcher: true,   // 登录页快捷账号切换
  telemetrySpy:    true,   // 网络流量监听（quota 数据捕获）
  updateChecker:   true,   // 右上角版本更新检测
};

window.AGY_CONFIG = AGY_CONFIG;

function run(electron_ref) {
  try {
    // 1. 载入核心依赖（让其在全局范围注册，或通过 CommonJS 传递）
    // 为了使各个模块的代码在没有过多重构的情况下正常运行，我们把所需的数据与依赖挂载到全局 window 对象上
    const dictModule = require('../modules/dictionary');
    window.dictionary = dictModule.dictionary;
    window.coreWords = dictModule.coreWords;
    window.combinedDict = dictModule.combinedDict;
    window.substringReplacements = dictModule.substringReplacements;
    window.escapeRegExp = dictModule.escapeRegExp;

    const domModule = require('./dom');
    window.waitForElement = domModule.waitForElement;
    window.injectStyle = domModule.injectStyle;

    const themeModule = require('../modules/theme-adapter');
    window.getNativeThemeColors = themeModule.getNativeThemeColors;
    window.showBeautifulConfirm = themeModule.showBeautifulConfirm;

    // 2. 载入并初始化功能模块
    if (AGY_CONFIG.translation) {
      const translator = require('../modules/translator');
      window.translateString = translator.translateString;
      window.translateNode = translator.translateNode;
      window.observeRoot = translator.observeRoot;
      window.startObserver = translator.startObserver;
      window.fetchCloudDict = translator.fetchCloudDict;

      // 启动翻译
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', window.startObserver);
      } else {
        window.startObserver();
      }

      if (AGY_CONFIG.cloudDict) {
        window.fetchCloudDict();
      }
    }

    if (AGY_CONFIG.telemetrySpy) {
      const spy = require('../modules/telemetry-spy');
      window.runGrpcSniff = spy.runGrpcSniff;
      window.startStartupSniff = spy.startStartupSniff;
      window.injectTelemetrySpy = spy.injectTelemetrySpy;

      window.injectTelemetrySpy();
    }

    if (AGY_CONFIG.quotaWidget) {
      const quota = require('../modules/quota-widget');
      window.updateStoredQuota = quota.updateStoredQuota;
      window.injectQuotaWidget = quota.injectQuotaWidget;
      window.getCurrentModel = quota.getCurrentModel;
    }

    if (AGY_CONFIG.accountSwitcher) {
      const switcher = require('../modules/account-switcher');
      window.injectQuickLogin = switcher.injectQuickLogin;
    }

    if (AGY_CONFIG.updateChecker) {
      const updater = require('../modules/update-checker');
      window.setupVersionUpdater = updater.setupVersionUpdater;
    }

    // 3. 启动定时器与事件监听
    const setupActivityListeners = () => {
      let lastNotify = 0;
      const notifyActive = () => {
        const now = Date.now();
        if (now - lastNotify > 3000) {
          lastNotify = now;
          electron_ref.ipcRenderer.send('user-active');
        }
      };
      window.addEventListener('keydown', notifyActive, true);
      window.addEventListener('mousedown', notifyActive, true);
    };

    const onReady = () => {
      setupActivityListeners();

      if (AGY_CONFIG.quotaWidget) {
        window.addEventListener('click', () => { setTimeout(window.injectQuotaWidget, 100); }, true);
        setInterval(window.injectQuotaWidget, 2000);
      }

      if (AGY_CONFIG.accountSwitcher) {
        setInterval(window.injectQuickLogin, 1000);
      }

      if (AGY_CONFIG.telemetrySpy) {
        setInterval(window.runGrpcSniff, 30000);
        window.addEventListener('focus', window.runGrpcSniff);
        window.startStartupSniff();
      }

      if (AGY_CONFIG.updateChecker) {
        window.setupVersionUpdater();
      }
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }

  } catch (e) {
    console.error('[AGY v2] Loader run error:', e);
    try {
      electron_ref.ipcRenderer.invoke('mcp:write-log', '[ERROR] Loader run failed: ' + e.stack + '\n');
    } catch (err) {}
  }
}

module.exports = { run };
