(function exposeMarketplaceLayout(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyMarketplaceLayout = api;
})(typeof window !== 'undefined' ? window : globalThis, function createMarketplaceLayout() {
  function calculatePageSize(container, minimumWidth = 260, cardHeight = 205, maxColumns = 5) {
    if (!container) return 6;
    const pane = container.closest('.tab-pane');
    const rect = container.getBoundingClientRect();
    if (!pane?.classList.contains('active') || rect.width < 160) return Math.max(1, Number(container.dataset.pageSize) || 6);
    const columns = Math.max(1, Math.min(maxColumns, Math.floor((rect.width + 16) / (minimumWidth + 16))));
    const viewport = container.closest('.main-content') || pane.parentElement;
    const viewportRect = viewport?.getBoundingClientRect();
    const viewportBottom = Math.min(window.innerHeight, viewportRect?.bottom || window.innerHeight);
    const available = Math.max(cardHeight, viewportBottom - rect.top - 68);
    const rows = Math.max(1, Math.min(3, Math.floor((available + 16) / (cardHeight + 16))));
    container.style.setProperty('--market-columns', columns);
    container.style.setProperty('--market-card-height', `${cardHeight}px`);
    container.dataset.columns = String(columns);
    container.dataset.rows = String(rows);
    container.dataset.pageSize = String(columns * rows);
    return columns * rows;
  }

  function ensureCategoryRail(id, categories, active, onChange) {
    let rail = document.getElementById(id);
    if (!rail) {
      rail = document.createElement('div');
      rail.id = id;
      rail.className = 'market-category-rail';
      const anchor = id.startsWith('skill') ? document.querySelector('#tab-skill-market .market-toolbar') : document.querySelector('#tab-mcp .mcp-toolbar-row');
      anchor?.insertAdjacentElement('afterend', rail);
    }
    rail.replaceChildren();
    for (const item of categories) {
      const category = typeof item === 'string' ? item : item.value;
      const button = document.createElement('button');
      button.className = `market-category-chip${category === active ? ' active' : ''}`;
      button.textContent = typeof item === 'string' ? item : item.label;
      button.addEventListener('click', () => onChange(category));
      rail.appendChild(button);
    }
  }

  return { calculatePageSize, ensureCategoryRail };
});
