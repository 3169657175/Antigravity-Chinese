(function exposeMarketplacePresenter(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyMarketplacePresenter = api;
})(typeof window !== 'undefined' ? window : globalThis, function createMarketplacePresenter() {
  function hasChinese(value) {
    return /[\u3400-\u9fff]/.test(String(value || ''));
  }

  function createPresenter(options) {
    const categories = Array.isArray(options.categories) ? options.categories : [];
    const categoryCopy = options.categoryCopy || {};
    const purposeRules = Array.isArray(options.purposeRules) ? options.purposeRules : [];
    const fallbackCategory = options.fallbackCategory || '其他';

    function classifySkill(skill) {
      const value = skill || {};
      const text = [value.id, value.name, value.description, value.desc, value.category].join(' ');
      return categories.find(([, pattern]) => pattern.test(text))?.[0] || fallbackCategory;
    }

    function presentSkill(skill, index = 0) {
      if (skill && skill.__agyPresented) return skill;
      const value = skill || {};
      const translation = value.translation && typeof value.translation === 'object' ? value.translation : null;
      const category = translation?.category || value.displayCategory || classifySkill(value);
      const originalDescription = String(value.originalDescription || value.description || value.desc || '').trim();
      const repositoryChinese = hasChinese(originalDescription);
      const translatedDescription = String(translation?.chineseDescription || '').trim();
      const fallback = purposeRules.find(([pattern]) => pattern.test([value.id, value.name, originalDescription].join(' ')))?.[1]
        || categoryCopy[category]
        || categoryCopy[fallbackCategory]
        || '用于扩展 AI 的专业能力。';
      return {
        ...value,
        __agyPresented: true,
        sequence: Number(value.sequence) || index + 1,
        displayCategory: category,
        originalDescription,
        chineseDescription: repositoryChinese ? originalDescription : (hasChinese(translatedDescription) ? translatedDescription : `${fallback} 技能标识：${value.id}。`),
        translationSource: repositoryChinese ? '仓库中文' : (hasChinese(translatedDescription) ? 'AI 翻译' : '规则摘要'),
        translatedAt: translation?.translatedAt || '',
        riskLabel: /low|safe/i.test(String(value.risk || '')) ? '低风险'
          : /medium|warning/i.test(String(value.risk || '')) ? '需确认权限'
          : /high/i.test(String(value.risk || '')) ? '高风险'
          : '风险未标注'
      };
    }

    return { classifySkill, presentSkill };
  }

  return { createPresenter, hasChinese };
});
