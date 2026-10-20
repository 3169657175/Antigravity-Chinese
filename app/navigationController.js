(function exposeNavigationController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyNavigationController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createNavigationController() {
  function bind(options = {}) {
    const navItems = options.navItems || [];
    const tabPanes = options.tabPanes || [];
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetId = item.getAttribute('data-target');
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        tabPanes.forEach(pane => pane.classList.remove('active'));
        document.getElementById(targetId)?.classList.add('active');
        options.onNavigate?.(targetId, item);
      });
    });
  }
  return { bind };
});
