/**
 * core/dom.js
 * Antigravity-Chinese v2 - DOM 工具层
 * 提供：waitForElement、injectStyle
 */

function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body || document.documentElement, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      reject(new Error('waitForElement timeout: ' + selector));
    }, timeout);
  });
}

function injectStyle(css, id) {
  if (id && document.getElementById(id)) return;
  const style = document.createElement('style');
  if (id) style.id = id;
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);
}

module.exports = { waitForElement, injectStyle };
