(function exposeSafeDom(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgySafeDom = api;
})(typeof window !== 'undefined' ? window : globalThis, function createSafeDom() {
  function text(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function errorMessage(error, fallback = '操作失败') {
    const value = error && typeof error === 'object' ? error.message : error;
    return text(String(value || fallback).slice(0, 500));
  }

  function imageUrl(value) {
    const raw = String(value || '').trim();
    if (/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' ? url.toString() : '';
    } catch (_) {
      return '';
    }
  }

  return { text, errorMessage, imageUrl };
});
