(function exposeFeatureFlags(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyFeatureFlags = api;
})(typeof window !== 'undefined' ? window : globalThis, function createFeatureFlags() {
  const FLAGS = Object.freeze({ claudeCodeGateway: false });
  function enabled(name) { return Boolean(FLAGS[name]); }
  function apply(root = typeof document !== 'undefined' ? document : null) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll('[data-feature]').forEach(element => {
      const visible = enabled(element.getAttribute('data-feature'));
      element.hidden = !visible;
      element.setAttribute('aria-hidden', visible ? 'false' : 'true');
      if (!visible) element.classList?.remove('active');
    });
  }
  return { FLAGS, enabled, apply };
});
