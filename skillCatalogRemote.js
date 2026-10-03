const DEFAULT_SKILL_SOURCES = Object.freeze([
  {
    id: 'github-raw',
    label: 'GitHub Raw',
    baseUrl: 'https://raw.githubusercontent.com/sickn33/agentic-awesome-skills/refs/heads/main'
  },
  {
    id: 'jsdelivr',
    label: 'jsDelivr CDN',
    baseUrl: 'https://cdn.jsdelivr.net/gh/sickn33/agentic-awesome-skills@main'
  },
  {
    id: 'github-api',
    label: 'GitHub API',
    baseUrl: 'https://api.github.com/repos/sickn33/agentic-awesome-skills/contents',
    headers: { Accept: 'application/vnd.github.raw+json' }
  }
]);

function normalizeRemotePath(value) {
  const text = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  const parts = text.split('/');
  if (!text || parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('远程 Skill 路径无效');
  }
  return parts.map(part => encodeURIComponent(part)).join('/');
}

async function fetchFromSkillSources(relativePath, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('当前运行环境不支持远程请求');
  const timeoutMs = Math.max(1000, Math.min(60000, Number(options.timeoutMs) || 12000));
  const sources = Array.isArray(options.sources) && options.sources.length ? options.sources : DEFAULT_SKILL_SOURCES;
  const normalizedPath = normalizeRemotePath(relativePath);
  const failures = [];

  for (const source of sources) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const url = `${String(source.baseUrl || '').replace(/\/$/, '')}/${normalizedPath}`;
    try {
      const response = await fetchImpl(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'AGY-Hub/1.3.1', ...(source.headers || {}) }
      });
      if (!response || !response.ok) throw new Error(`HTTP ${response ? response.status : 'unknown'}`);
      return { response, source, url };
    } catch (error) {
      failures.push(`${source.label || source.id || 'remote'}: ${error && error.name === 'AbortError' ? '超时' : error.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  const error = new Error(`社区仓库远程源均不可用（${failures.join('；')}）`);
  error.code = 'SKILL_REMOTE_UNAVAILABLE';
  error.failures = failures;
  throw error;
}

async function fetchSkillCatalogJson(relativePath = 'skills_index.json', options = {}) {
  const result = await fetchFromSkillSources(relativePath, options);
  return { data: await result.response.json(), source: result.source, url: result.url };
}

async function fetchSkillText(relativePath, options = {}) {
  const result = await fetchFromSkillSources(relativePath, options);
  return { data: await result.response.text(), source: result.source, url: result.url };
}

module.exports = {
  DEFAULT_SKILL_SOURCES,
  normalizeRemotePath,
  fetchFromSkillSources,
  fetchSkillCatalogJson,
  fetchSkillText
};
