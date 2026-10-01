(function exposeMarketplaceController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyMarketplaceController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createMarketplaceController() {
  let appPaths = null;
  let logToTerminal = () => {};
  const inputSearchSkill = typeof document !== 'undefined' ? document.getElementById('input-search-skill') : null;
  const btnSyncGithubSkills = typeof document !== 'undefined' ? document.getElementById('btn-sync-github-skills') : null;
  const btnTranslateSkillDescriptions = typeof document !== 'undefined' ? document.getElementById('btn-translate-skill-descriptions') : null;
  const skillMarketSummary = typeof document !== 'undefined' ? document.getElementById('skill-market-summary') : null;
  const btnRefreshMcpStatus = typeof document !== 'undefined' ? document.getElementById('btn-refresh-mcp-status') : null;
  const mcpMarketSummary = typeof document !== 'undefined' ? document.getElementById('mcp-market-summary') : null;
  const mcpValidationProgress = typeof document !== 'undefined' ? document.getElementById('mcp-validation-progress') : null;
  const mcpValidationProgressTitle = typeof document !== 'undefined' ? document.getElementById('mcp-validation-progress-title') : null;
  const mcpValidationProgressPercent = typeof document !== 'undefined' ? document.getElementById('mcp-validation-progress-percent') : null;
  const mcpValidationProgressMessage = typeof document !== 'undefined' ? document.getElementById('mcp-validation-progress-message') : null;
  const mcpValidationProgressBar = typeof document !== 'undefined' ? document.getElementById('mcp-validation-progress-bar') : null;
  const mcpSetupModal = typeof document !== 'undefined' ? document.getElementById('mcp-setup-modal') : null;
  const mcpSetupSubtitle = typeof document !== 'undefined' ? document.getElementById('mcp-setup-subtitle') : null;
  const mcpSetupFields = typeof document !== 'undefined' ? document.getElementById('mcp-setup-fields') : null;
  const mcpSetupNote = typeof document !== 'undefined' ? document.getElementById('mcp-setup-note') : null;
  const mcpSetupResult = typeof document !== 'undefined' ? document.getElementById('mcp-setup-result') : null;
  const btnCloseMcpSetup = typeof document !== 'undefined' ? document.getElementById('btn-close-mcp-setup') : null;
  const btnCancelMcpSetup = typeof document !== 'undefined' ? document.getElementById('btn-cancel-mcp-setup') : null;
  const btnConfirmMcpSetup = typeof document !== 'undefined' ? document.getElementById('btn-confirm-mcp-setup') : null;
  let skillMarketCurrentPage = 1;
  let currentMarketTab = 'market';
  let installedSkillsList = [];
  let mcpMarketCurrentPage = 1;
  let currentMcpTab = 'market';
  let mcpConfig = null;
  let activeSkillCategory = '全部';
  let activeMcpCategory = '全部';
  let lastSkillList = [];
  let layoutFrame = null;
  let layoutSettleTimer = null;
  let marketplaceResizeObserver = null;
  let initialized = false;
  const feedback = typeof window !== 'undefined' ? window.AgyOperationFeedback : null;

  function readViewedSkillIds() {
    if (typeof localStorage === 'undefined') return [];
    try {
      const parsed = JSON.parse(localStorage.getItem('agy-viewed-skills') || '[]');
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      localStorage.removeItem('agy-viewed-skills');
      return [];
    }
  }

  const viewedSkillIds = new Set(readViewedSkillIds());

  const SKILL_CATEGORIES = [
    ['编程开发', /code|program|develop|python|java|typescript|javascript|angular|react|vue|android|ios|flutter|rust|golang|debug|refactor|algorithm/i],
    ['前端与设计', /ui|ux|design|frontend|css|html|tailwind|animation|image|visual|figma|slide|presentation|3d/i],
    ['后端与 API', /backend|api|server|express|fastapi|graphql|microservice|webhook|auth/i],
    ['数据与数据库', /data|database|sql|postgres|mysql|mongo|redis|analytics|airtable|spreadsheet/i],
    ['测试与质量', /test|qa|quality|review|audit|evaluation|regression|acceptance/i],
    ['云与 DevOps', /cloud|aws|azure|gcp|docker|kubernetes|deploy|devops|ci|cd|terraform|monitor/i],
    ['AI 与智能体', /agent|ai-|llm|rag|prompt|model|memory|orchestrat|mcp/i],
    ['安全与合规', /security|attack|pentest|vulnerab|compliance|iam|secret|malware|forensic/i],
    ['文档与办公', /document|docs|readme|writing|translation|office|word|pdf|email|meeting/i],
    ['营销与业务', /marketing|seo|sales|crm|campaign|content|product|business|customer|commerce/i],
    ['游戏与多媒体', /game|audio|video|music|3d|2d|unity|unreal|media/i]
  ];

  const CATEGORY_COPY = {
    '编程开发': '用于代码编写、调试、重构和工程开发，可在相关项目任务中提供专门工作流程。',
    '前端与设计': '用于界面设计、视觉优化、交互体验和前端实现，适合页面与产品外观任务。',
    '后端与 API': '用于服务端、接口、鉴权和系统集成，适合构建或维护后端能力。',
    '数据与数据库': '用于数据处理、数据库设计、查询优化和分析任务。',
    '测试与质量': '用于测试、代码审查、质量验收和回归检查，帮助降低修改风险。',
    '云与 DevOps': '用于部署、云平台、容器、监控和自动化运维。',
    'AI 与智能体': '用于 AI 智能体、模型调用、提示词、记忆和多智能体协作。',
    '安全与合规': '用于安全审计、风险检查、权限控制和合规分析。',
    '文档与办公': '用于文档、翻译、写作、汇报和日常办公自动化。',
    '营销与业务': '用于产品、营销、销售、内容运营和业务分析。',
    '游戏与多媒体': '用于游戏开发、音视频、图像和多媒体内容生产。',
    '其他': '这是一个专业扩展技能；打开详情可查看原始说明、来源和风险信息。'
  };

  const PURPOSE_RULES = [
    [/consultant|architect/, '用于需求分析、解决方案设计和技术路线规划。'],
    [/skill.?smith|skill.?creator/, '用于设计、编写、检查和维护 AI Skill 技能。'],
    [/niche|intelligence|research/, '用于细分领域调研、资料整理和专业情报分析。'],
    [/slide|presentation|ppt/, '用于制作演示文稿、汇报材料和幻灯片内容。'],
    [/game|unity|unreal/, '用于游戏玩法、场景、物理、资源和交互开发。'],
    [/api|graphql|endpoint/, '用于接口设计、接口实现、调试和文档生成。'],
    [/test|qa|regression|acceptance/, '用于生成测试、执行回归检查和验证交付质量。'],
    [/security|audit|attack|pentest/, '用于安全检查、漏洞分析、攻击面评估和修复建议。'],
    [/document|readme|writing|translation/, '用于文档编写、内容整理、翻译和项目说明维护。'],
    [/deploy|docker|kubernetes|cloud|devops/, '用于应用部署、容器、云资源和自动化运维。'],
    [/database|sql|postgres|mysql|mongo/, '用于数据库设计、查询、迁移和性能优化。'],
    [/analytics|data|report/, '用于数据清洗、分析、指标解读和报告生成。'],
    [/agent|llm|prompt|rag|memory/, '用于 AI 智能体、模型提示、知识检索和记忆系统。'],
    [/frontend|ui|ux|css|design/, '用于前端页面、交互体验、组件和视觉设计。'],
    [/marketing|seo|sales|campaign/, '用于营销、搜索优化、销售和内容运营。']
  ];

  const marketplacePresenterApi = typeof module === 'object' && module.exports
    ? require('./marketplace/marketplacePresenter.js')
    : window.AgyMarketplacePresenter;
  const marketplacePresenter = marketplacePresenterApi.createPresenter({
    categories: SKILL_CATEGORIES,
    categoryCopy: CATEGORY_COPY,
    purposeRules: PURPOSE_RULES,
    fallbackCategory: '其他'
  });
  const marketplaceLayout = typeof module === 'object' && module.exports
    ? require('./marketplace/marketplaceLayout.js')
    : window.AgyMarketplaceLayout;

  function classifySkill(skill) {
    return marketplacePresenter.classifySkill(skill);
  }

  function presentSkill(skill, index = 0) {
    return marketplacePresenter.presentSkill(skill, index);
  }

  function stripPackageVersion(value) {
    const text = String(value || '');
    if (text.startsWith('@')) {
      const split = text.lastIndexOf('@');
      return split > text.indexOf('/') ? text.slice(0, split) : text;
    }
    return text.replace(/@[^@/]+$/, '');
  }

  function calculatePageSize(container, minimumWidth = 260, cardHeight = 205, maxColumns = 5) {
    return marketplaceLayout.calculatePageSize(container, minimumWidth, cardHeight, maxColumns);
  }

  function ensureCategoryRail(id, categories, active, onChange) {
    return marketplaceLayout.ensureCategoryRail(id, categories, active, onChange);
  }

// ==========================================
// 5. MCP 插件市场初始化与事件 (扩增至 8 大旗舰插件)
// ==========================================
const popularMcps = [
  {
    id: 'github-search',
    name: 'GitHub Code Search',
    desc: '让智能体能够根据指令一键在 GitHub 仓库检索相关的公开代码与架构样例。',
    package: '@modelcontextprotocol/server-github@2025.4.8',
    note: '需要 GITHUB_PERSONAL_ACCESS_TOKEN。',
    fields: [
      { key: 'GITHUB_PERSONAL_ACCESS_TOKEN', label: 'GitHub Personal Access Token', type: 'password', storage: 'env', required: true, placeholder: 'github_pat_...' }
    ]
  },
  {
    id: 'local-filesystem',
    name: 'Local Filesystem Sandbox',
    desc: '允许 AI 智能体在明确授权的目录内读取、写入和编辑文件。',
    package: '@modelcontextprotocol/server-filesystem@2026.7.10',
    note: '服务只能访问你填写的目录。建议选择单独项目目录，不要授权整个系统盘。',
    fields: [
      { key: 'allowedPath', label: '允许访问的本地目录', type: 'text', storage: 'arg', required: true, placeholder: 'C:\\Users\\Public', defaultValue: 'C:\\Users\\Public' }
    ]
  },
  {
    id: 'sqlite-connector',
    name: 'SQLite Database Agent',
    desc: '支持大语言模型执行 SQL、创建表并对指定 SQLite 数据库进行实时读写。',
    package: 'mcp-sqlite@1.0.9',
    note: '数据库不存在时服务可能创建新文件；请确认目录具有写入权限。',
    fields: [
      { key: 'databasePath', label: 'SQLite 数据库文件', type: 'text', storage: 'arg', required: true, placeholder: 'C:\\Users\\Public\\agy-hub.db' }
    ]
  },
  {
    id: 'chrome-devtools-mcp',
    name: 'Chrome DevTools Browser',
    desc: '通过 Chrome DevTools MCP 执行网页交互、抓取、性能分析与截图调试。',
    package: 'chrome-devtools-mcp@1.6.0',
    note: '连接您本地 Chrome 的调试端口 (http://127.0.0.1:9222)。',
    fields: []
  },
  {
    id: 'postgres-connector',
    name: 'PostgreSQL Database Agent',
    desc: '支持大语言模型连接并执行 SQL 操作指定的 PostgreSQL 数据库。',
    package: '@modelcontextprotocol/server-postgres@0.6.2',
    note: '连接串保存在本机 MCP 配置中。建议使用权限受限的专用数据库账号。',
    fields: [
      { key: 'databaseUrl', label: 'PostgreSQL 连接串', type: 'password', storage: 'arg', required: true, placeholder: 'postgresql://user:password@127.0.0.1:5432/database' }
    ]
  },
  {
    id: 'google-maps',
    name: 'Google Maps Location',
    desc: '让 AI 智能体调用 Google Maps API 搜索位置、商家、经纬度与路线。',
    package: '@modelcontextprotocol/server-google-maps@0.6.2',
    note: '需要启用对应 Google Maps API 的密钥。',
    fields: [
      { key: 'GOOGLE_MAPS_API_KEY', label: 'Google Maps API Key', type: 'password', storage: 'env', required: true, placeholder: 'AIza...' }
    ]
  },
  {
    id: 'tavily-search',
    name: 'Tavily Web Search Engine',
    desc: '为 AI 助手挂载 Tavily 搜索引擎，提供实时网页检索与内容提取。',
    package: 'tavily-mcp@0.2.21',
    note: '需要 Tavily API Key。',
    fields: [
      { key: 'TAVILY_API_KEY', label: 'Tavily API Key', type: 'password', storage: 'env', required: true, placeholder: 'tvly-...' }
    ]
  },
  {
    id: 'docker-engine',
    name: 'Docker Container Agent',
    desc: '允许大模型读取本地 Docker 容器、查看日志并执行容器管理操作。',
    package: 'mcp-server-docker@1.0.0',
    note: '需要 Docker Engine 或 Docker Desktop 已安装并运行。',
    fields: []
  },
  {
    id: 'antimetal',
    name: 'Antimetal',
    desc: '使用 AI 驱动的根因分析调查和修复软件问题。连接到你的 Antimetal 账户以搜索问题并执行分析。',
    package: 'antimetal-mcp',
    note: '连接您的 Antimetal 云服务。',
    fields: []
  },
  {
    id: 'windsor',
    name: 'Windsor.ai',
    desc: '查询处理您的营销、CRM、电子商务和仓库数据，支持 325+ 个连接器，包含 Meta 广告、Google 广告、TikTok 广告、GA4 等。',
    package: 'windsor-mcp',
    note: '需要注册 Windsor.ai 账户。',
    fields: []
  },
  {
    id: 'gitlab-orbit',
    name: 'GitLab Orbit',
    desc: '将您的 GitLab SDLC 作为知识图谱进行查询。查询群组、项目、源代码、合并请求、流水线和安全漏洞。',
    package: 'gitlab-mcp@1.6.1',
    note: '需要您的 GitLab 个人访问令牌（PAT）。',
    fields: []
  },
  {
    id: 'cloudrun',
    name: 'Cloud Run',
    desc: '允许大语言模型将本地应用一键部署并管理在 Google Cloud Run 容器服务上。',
    package: '@google-cloud/cloud-run-mcp@1.10.0',
    note: '需要您在本地配置好 Google Cloud SDK 认证登录态。',
    fields: []
  },
  {
    id: 'posthog',
    name: 'PostHog',
    desc: '提问并获取答案。该 MCP 允许大语言模型直接通过 API 访问您的 PostHog 数据以执行查询。',
    package: 'posthog-mcp',
    note: '需要配置 PostHog 项目 API 密钥。',
    fields: []
  },
  {
    id: 'gke',
    name: 'Google Kubernetes Engine (OSS)',
    desc: '允许大模型与 GKE 集群进行交互，查询集群状态、Pod 日志及资源对象。',
    package: 'gke-mcp',
    note: '需要配置 kubectl 本地认证并指向 GKE 集群。',
    fields: []
  },
  {
    id: 'dart',
    name: 'Dart',
    desc: 'Dart & Flutter MCP 服务端，向兼容的 AI 助手客户端公开 Dart (and Flutter) 开发工具操作。',
    package: 'dart-mcp',
    note: '连接 Dart SDK，需要您本地已安装 SDK 并在环境变量中。',
    fields: []
  },
  {
    id: 'firebase',
    name: 'Firebase 开发者套件',
    desc: '针对 Firebase 的模型上下文协议 (MCP) 服务端，为 AI 辅助开发工具提供协同管理您的 Firebase 项目及应用代码库的能力。',
    package: 'firebase-mcp@0.4.4',
    note: '需要 Firebase CLI 登录状态。',
    fields: []
  },
  {
    id: 'genkit',
    name: 'Genkit',
    desc: '针对 Genkit 的模型上下文协议 (MCP) 服务端，为 AI 辅助开发工具提供构建、测试与检查您的 Genkit 应用的能力。',
    package: 'genkit-mcp',
    note: '用于对 Genkit 流进行检查和可视化。',
    fields: []
  },
  {
    id: 'go',
    name: 'Go',
    desc: 'gopls 模型上下文协议 (MCP) 服务端，提供用于 semantic code analysis, live diagnostics, and transformation of your Go codebase 的工具。',
    package: 'go-mcp',
    note: '需要本地已安装 Go 环境并将 gopls 工具配置于 PATH 中。',
    fields: []
  },
  {
    id: 'bigquery',
    name: 'BigQuery',
    desc: '使用自然语言与您的 BigQuery 数据进行交互，该 MCP 服务允许您安全地连接到数据集以搜索数据、检查数据表并获取结构信息。',
    package: 'bigquery-mcp',
    note: '需要 Google 凭证及 BigQuery 实例读写权限。',
    fields: []
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    desc: '顺序思考组件，支持大模型在推理过程中分步骤推导和校验其思路。',
    package: '@modelcontextprotocol/server-sequential-thinking@2026.7.4',
    note: '支持复杂的串行逻辑推理，不需要额外配置环境。',
    fields: []
  }
];

const MCP_CATEGORIES = {
  '开发工具': new Set(['github-search', 'chrome-devtools-mcp', 'dart', 'go']),
  '文件与数据库': new Set(['local-filesystem', 'sqlite-connector', 'postgres-connector', 'bigquery']),
  '云与容器': new Set(['docker-engine', 'cloudrun', 'gke', 'firebase', 'genkit']),
  '搜索与数据': new Set(['google-maps', 'tavily-search', 'posthog', 'windsor']),
  '智能体增强': new Set(['sequential-thinking', 'antimetal', 'gitlab-orbit'])
};

for (const mcp of popularMcps) {
  mcp.category = Object.entries(MCP_CATEGORIES).find(([, ids]) => ids.has(mcp.id))?.[0] || '实验性';
  mcp.supplyVerified = /@(?:\d{4}\.\d+\.\d+|\d+\.\d+\.\d+)$/.test(mcp.package);
}

function renderMcpCategoryRail() {
  const source = currentMcpTab === 'installed'
    ? Object.keys(mcpConfig?.mcpServers || {}).map(id => popularMcps.find(item => item.id === id)).filter(Boolean)
    : popularMcps;
  const categories = ['全部', ...Object.keys(MCP_CATEGORIES), '实验性'].map(value => ({
    value,
    label: `${value} ${value === '全部' ? source.length : source.filter(item => item.category === value).length}`
  }));
  ensureCategoryRail('mcp-category-rail', categories, activeMcpCategory, category => {
    activeMcpCategory = category;
    mcpMarketCurrentPage = 1;
    renderMcpCategoryRail();
    renderMcpMarket();
  });
}

async function initMcpMarket() {
  const container = document.getElementById('mcp-list-container');
  if (!container) return;
  
  mcpConfig = { mcpServers: {} };
  if (appPaths && appPaths.mcpConfigPath) {
    const res = await window.agyHubAPI.readMcpConfig(appPaths.mcpConfigPath);
    if (res.success && res.data && typeof res.data === 'object') {
      mcpConfig = res.data;
      if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
      logToTerminal(`[MCP] 已读取官方配置: ${appPaths.mcpConfigPath}`, 'success');
    }
  }

  // 绑定选项卡事件
  const mcpTabMarket = document.getElementById('btn-mcp-tab-market');
  const mcpTabInstalled = document.getElementById('btn-mcp-tab-installed');

  if (mcpTabMarket && mcpTabInstalled) {
    mcpTabMarket.addEventListener('click', () => {
      currentMcpTab = 'market';
      mcpTabMarket.classList.add('active');
      mcpTabInstalled.classList.remove('active');
      mcpMarketCurrentPage = 1;
      renderMcpCategoryRail();
      renderMcpMarket();
    });

    mcpTabInstalled.addEventListener('click', () => {
      currentMcpTab = 'installed';
      mcpTabInstalled.classList.add('active');
      mcpTabMarket.classList.remove('active');
      mcpMarketCurrentPage = 1;
      renderMcpCategoryRail();
      renderMcpMarket();
    });
  }

  renderMcpCategoryRail();
  renderMcpMarket();
  if (btnRefreshMcpStatus) btnRefreshMcpStatus.onclick = () => refreshInstalledMcpStatuses({ deep: true });
  if (btnCloseMcpSetup) btnCloseMcpSetup.onclick = closeMcpSetup;
  if (btnCancelMcpSetup) btnCancelMcpSetup.onclick = closeMcpSetup;
  if (btnConfirmMcpSetup) btnConfirmMcpSetup.onclick = confirmMcpSetup;
  await refreshInstalledMcpStatuses({ deep: false });
}

const mcpRuntimeStates = new Map();
let selectedMcp = null;

function updateMcpValidationProgress() {
  if (!mcpValidationProgress) return;
  const verifying = Array.from(mcpRuntimeStates.entries()).filter(([, state]) => state?.state === 'verifying');
  if (verifying.length === 0) {
    mcpValidationProgress.hidden = true;
    return;
  }
  const average = Math.round(verifying.reduce((sum, [, state]) => sum + (Number(state.percent) || 8), 0) / verifying.length);
  const names = verifying.map(([id]) => popularMcps.find(item => item.id === id)?.name || id);
  mcpValidationProgress.hidden = false;
  if (mcpValidationProgressTitle) mcpValidationProgressTitle.textContent = `正在深度验证 ${verifying.length} 个 MCP 服务`;
  if (mcpValidationProgressPercent) mcpValidationProgressPercent.textContent = `${average}%`;
  if (mcpValidationProgressMessage) {
    const latest = verifying[verifying.length - 1][1];
    mcpValidationProgressMessage.textContent = `${names.join('、')} · ${latest.message || '正在启动服务'}`;
  }
  if (mcpValidationProgressBar) mcpValidationProgressBar.style.width = `${average}%`;
}

function buildMcpLaunchConfig(mcp, values) {
  const args = ['/d', '/s', '/c', 'npx', '-y', mcp.package];
  const env = {};
  for (const field of mcp.fields) {
    const value = String(values[field.key] || '').trim();
    if (field.storage === 'env') env[field.key] = value;
    if (field.storage === 'arg') args.push(value);
  }
  return { command: 'cmd.exe', args, env };
}

function pinMcpLaunchConfig(mcp, config) {
  if (!config || !Array.isArray(config.args) || !mcp?.package) return config;
  const expected = stripPackageVersion(mcp.package);
  const args = config.args.map(value => stripPackageVersion(value) === expected ? mcp.package : value);
  return { ...config, args };
}

function isLikelyNpmPackage(value) {
  const text = String(value || '');
  return !text.startsWith('/') && !text.startsWith('-') && !['npx', 'npx.cmd', 'cmd', 'cmd.exe'].includes(text.toLowerCase())
    && (/^@[^/]+\/.+/.test(text) || /^[a-z0-9][a-z0-9._-]*(?:@[^\s]+)?$/i.test(text));
}

function getExistingMcpValues(mcp) {
  const config = mcpConfig && mcpConfig.mcpServers ? mcpConfig.mcpServers[mcp.id] : null;
  const values = {};
  if (!config) return values;
  let argumentIndex = 0;
  const packageIndex = Array.isArray(config.args)
    ? config.args.findIndex(value => stripPackageVersion(value) === stripPackageVersion(mcp.package)) : -1;
  for (const field of mcp.fields) {
    if (field.storage === 'env') values[field.key] = config.env && config.env[field.key] || '';
    if (field.storage === 'arg') {
      values[field.key] = packageIndex >= 0 ? config.args[packageIndex + 1 + argumentIndex] || '' : '';
      argumentIndex += 1;
    }
  }
  return values;
}

function renderMcpMarket() {
  const container = document.getElementById('mcp-list-container');
  if (!container) return;
  container.replaceChildren();

  const paginationContainer = document.getElementById('mcp-market-pagination');
  const activeMcps = mcpConfig && mcpConfig.mcpServers ? mcpConfig.mcpServers : {};

  // 更新本地已部署总数角标
  const countSpan = document.getElementById('installed-mcp-count');
  if (countSpan) {
    countSpan.textContent = Object.keys(activeMcps).length;
  }

  // 1. 根据当前 Tab 整理数据源
  let sourceList = [];
  if (currentMcpTab === 'market') {
    sourceList = popularMcps;
  } else {
    sourceList = Object.keys(activeMcps).map(key => {
      const preset = popularMcps.find(p => p.id === key);
      const config = activeMcps[key];
      return {
        id: key,
        name: preset ? preset.name : key,
        desc: preset ? preset.desc : `本地独立部署的 MCP 外部工具扩展。`,
        package: preset ? preset.package : `启动命令: ${config.command} ${Array.isArray(config.args) ? config.args.join(' ') : ''}`,
        fields: preset ? preset.fields : [],
        note: preset ? preset.note : '',
        isLocalOnly: !preset,
        category: preset?.category || '实验性',
        supplyVerified: Boolean(preset?.supplyVerified)
      };
    });
  }

  if (activeMcpCategory !== '全部') sourceList = sourceList.filter(item => item.category === activeMcpCategory);

  if (sourceList.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'integration-summary';
    empty.textContent = currentMcpTab === 'market' ? '没有找到匹配的 MCP 插件。' : '当前本地未部署任何 MCP 服务。';
    container.appendChild(empty);
    if (paginationContainer) {
      paginationContainer.replaceChildren();
    }
    updateMcpSummary();
    return;
  }

  // 2. 根据当前窗口自动计算行列，避免宽屏出现 5+1 或窄屏内部滚动。
  const pageSize = calculatePageSize(container, 300, 210, 4);
  const totalPages = Math.ceil(sourceList.length / pageSize);
  if (mcpMarketCurrentPage < 1) mcpMarketCurrentPage = 1;
  if (mcpMarketCurrentPage > totalPages) mcpMarketCurrentPage = totalPages;

  const startIndex = (mcpMarketCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, sourceList.length);
  const paginatedMcps = sourceList.slice(startIndex, endIndex);

  // 3. 循环渲染卡片
  for (const [pageOffset, mcp] of paginatedMcps.entries()) {
    const installed = Boolean(activeMcps[mcp.id]);
    const runtime = mcpRuntimeStates.get(mcp.id);
    const card = document.createElement('div');
    card.id = `mcp-card-${mcp.id}`;
    card.className = 'mcp-card';
    if (installed) card.classList.add('configured');
    if (runtime && runtime.state === 'ready') card.classList.add('active');
    if (runtime && runtime.state === 'configured') card.classList.add('configured-state');
    if (runtime && runtime.state === 'verifying') card.classList.add('verifying');
    if (runtime && runtime.state === 'failed') card.classList.add('failed');

    const info = document.createElement('div');
    info.className = 'mcp-info';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'market-card-eyebrow';
    eyebrow.textContent = `#${String(startIndex + pageOffset + 1).padStart(2, '0')} · ${mcp.category || '实验性'}`;
    const title = document.createElement('h4');
    title.textContent = mcp.name;
    const desc = document.createElement('div');
    desc.className = 'mcp-desc';
    desc.textContent = mcp.desc;
    const packageName = document.createElement('div');
    packageName.className = 'mcp-package';
    packageName.textContent = `${mcp.package} · ${mcp.supplyVerified ? '版本已固定' : '来源待验证'}`;
    info.append(eyebrow, title, desc, packageName);

    const control = document.createElement('div');
    control.className = 'mcp-control';
    const status = document.createElement('span');
    status.className = 'mcp-status-tag';
    
    if (runtime && runtime.state === 'ready') status.textContent = runtime.message;
    else if (runtime && runtime.state === 'configured') status.textContent = runtime.message;
    else if (runtime && runtime.state === 'verifying') status.textContent = runtime.message || '正在启动并执行握手…';
    else if (runtime && runtime.state === 'failed') status.textContent = runtime.message;
    else status.textContent = installed ? '已部署 · 校验通过' : (mcp.fields && mcp.fields.length ? '未配置' : '可直接启用');

    if (currentMcpTab === 'installed' || installed) {
      // 已经安装/部署的，显示红色的“卸载/删除”按钮
      const uninstallBtn = document.createElement('button');
      uninstallBtn.className = 'btn-uninstall';
      uninstallBtn.style.padding = '5px 10px';
      uninstallBtn.textContent = '卸载服务';
      uninstallBtn.addEventListener('click', async () => {
        uninstallBtn.disabled = true;
        uninstallBtn.textContent = '卸载中...';
        await uninstallMcp(mcp);
        renderMcpMarket(); // 卸载后原地刷新
      });
      control.append(status, uninstallBtn);
    } else {
      // 未配置/未启用的，显示配置开关
      const switchLabel = document.createElement('label');
      switchLabel.className = 'switch';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `switch-${mcp.id}`;
      checkbox.checked = installed;
      checkbox.disabled = runtime && runtime.state === 'verifying';
      const slider = document.createElement('span');
      slider.className = 'slider';
      switchLabel.append(checkbox, slider);
      control.append(status, switchLabel);

      checkbox.addEventListener('change', async () => {
        if (checkbox.checked) openMcpSetup(mcp);
        else {
          await uninstallMcp(mcp);
          renderMcpMarket();
        }
      });
    }

    card.append(info, control);
    container.appendChild(card);
  }

  // 4. 渲染分页导航
  if (paginationContainer) {
    paginationContainer.replaceChildren();
    if (totalPages > 1) {
      // 1. 上一页
      const prevBtn = document.createElement('button');
      prevBtn.className = `pager-btn${mcpMarketCurrentPage === 1 ? ' disabled' : ''}`;
      prevBtn.textContent = '上一页';
      prevBtn.disabled = mcpMarketCurrentPage === 1;
      prevBtn.addEventListener('click', () => {
        mcpMarketCurrentPage--;
        renderMcpMarket();
      });
      paginationContainer.appendChild(prevBtn);

      // 2. 文本显示
      const pageText = document.createElement('span');
      pageText.className = 'pager-text';
      pageText.textContent = ` 第 ${mcpMarketCurrentPage} 页 / 共 ${totalPages} 页 `;
      paginationContainer.appendChild(pageText);

      // 3. 下一页
      const nextBtn = document.createElement('button');
      nextBtn.className = `pager-btn${mcpMarketCurrentPage === totalPages ? ' disabled' : ''}`;
      nextBtn.textContent = '下一页';
      nextBtn.disabled = mcpMarketCurrentPage === totalPages;
      nextBtn.addEventListener('click', () => {
        mcpMarketCurrentPage++;
        renderMcpMarket();
      });
      paginationContainer.appendChild(nextBtn);

      // 4. 跳转
      const jumpContainer = document.createElement('div');
      jumpContainer.className = 'pager-jump-container';
      const jumpLabel1 = document.createElement('span');
      jumpLabel1.textContent = ' 跳转到 ';
      const jumpInput = document.createElement('input');
      jumpInput.type = 'number';
      jumpInput.className = 'pager-jump-input';
      jumpInput.min = 1;
      jumpInput.max = totalPages;
      jumpInput.value = mcpMarketCurrentPage;
      const jumpLabel2 = document.createElement('span');
      jumpLabel2.textContent = ' 页 ';
      const jumpBtn = document.createElement('button');
      jumpBtn.className = 'pager-btn';
      jumpBtn.textContent = '确定';
      
      const triggerJump = () => {
        let targetPage = parseInt(jumpInput.value, 10);
        if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
        if (targetPage > totalPages) targetPage = totalPages;
        mcpMarketCurrentPage = targetPage;
        renderMcpMarket();
      };
      
      jumpBtn.addEventListener('click', triggerJump);
      jumpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerJump();
      });

      jumpContainer.append(jumpLabel1, jumpInput, jumpLabel2, jumpBtn);
      paginationContainer.appendChild(jumpContainer);
    }
  }

  updateMcpSummary();
  updateMcpValidationProgress();
}

function updateMcpSummary() {
  if (!mcpMarketSummary) return;
  const activeMcps = mcpConfig && mcpConfig.mcpServers ? mcpConfig.mcpServers : {};
  const configured = Object.keys(activeMcps).length;
  const configPassed = Array.from(mcpRuntimeStates.values()).filter(state => state?.state === 'configured').length;
  const ready = Array.from(mcpRuntimeStates.values()).filter(state => state?.state === 'ready').length;
  const failed = Array.from(mcpRuntimeStates.values()).filter(state => state?.state === 'failed').length;
  mcpMarketSummary.textContent = `官方配置：${appPaths?.mcpConfigPath || '尚未检测'} · 本地已部署 ${configured} · 配置通过 ${configPassed} · 深度握手 ${ready}${failed ? ` · 失败 ${failed}` : ''}`;
}

function openMcpSetup(mcp) {
  selectedMcp = mcp;
  const existingValues = getExistingMcpValues(mcp);
  mcpSetupSubtitle.textContent = `${mcp.name} · ${mcp.package}`;
  mcpSetupNote.textContent = mcp.note;
  mcpSetupResult.className = 'integration-result';
  mcpSetupResult.textContent = '保存前会真实启动服务并完成 MCP initialize 握手。首次下载可能需要约一分钟。';
  mcpSetupFields.replaceChildren();

  for (const field of mcp.fields) {
    const group = document.createElement('div');
    group.className = 'form-group';
    const label = document.createElement('label');
    label.htmlFor = `mcp-field-${field.key}`;
    label.textContent = field.label;
    const input = document.createElement('input');
    input.id = `mcp-field-${field.key}`;
    input.type = field.type || 'text';
    input.placeholder = field.placeholder || '';
    input.value = existingValues[field.key] || field.defaultValue || '';
    input.dataset.mcpKey = field.key;
    group.append(label, input);
    mcpSetupFields.appendChild(group);
  }

  mcpSetupModal.style.display = 'flex';
  requestAnimationFrame(() => {
    const firstInput = mcpSetupFields.querySelector('input');
    if (firstInput) firstInput.focus({ preventScroll: true });
    else btnConfirmMcpSetup.focus({ preventScroll: true });
  });
}

function closeMcpSetup() {
  mcpSetupModal.style.display = 'none';
  selectedMcp = null;
  renderMcpMarket();
}

async function confirmMcpSetup() {
  if (!selectedMcp) return;
  const values = {};
  for (const field of selectedMcp.fields) {
    const input = document.getElementById(`mcp-field-${field.key}`);
    const value = input ? input.value.trim() : '';
    if (field.required && !value) {
      mcpSetupResult.className = 'integration-result error';
      mcpSetupResult.textContent = `请填写：${field.label}`;
      if (input) input.focus();
      return;
    }
    values[field.key] = value;
  }
  const target = selectedMcp;
  btnConfirmMcpSetup.disabled = true;
  mcpSetupResult.className = 'integration-result';
  mcpSetupResult.textContent = '正在下载依赖、启动进程并验证 MCP 握手...';
  const success = await installAndVerifyMcp(target, buildMcpLaunchConfig(target, values));
  btnConfirmMcpSetup.disabled = false;
  if (success) {
    mcpSetupResult.className = 'integration-result success';
    mcpSetupResult.textContent = '安装成功，MCP 服务启动和握手验证均已通过。请在 Antigravity 的 MCP 设置中点击刷新。';
    setTimeout(closeMcpSetup, 900);
  } else {
    const runtime = mcpRuntimeStates.get(target.id);
    mcpSetupResult.className = 'integration-result error';
    mcpSetupResult.textContent = runtime?.message || 'MCP 验证失败';
  }
}

async function installAndVerifyMcp(mcp, launchConfig, persist = true) {
  const normalizedConfig = pinMcpLaunchConfig(mcp, launchConfig);
  const operationId = `mcp-${mcp.id}`;
  mcpRuntimeStates.set(mcp.id, { state: 'verifying', message: '正在启动进程…', percent: 8, startedAt: Date.now() });
  renderMcpMarket();
  logToTerminal(`[MCP] 正在真实启动并验证 ${mcp.name}...`);
  let result;
  try {
    result = await window.agyHubAPI.validateMcpServer(normalizedConfig, {
      operationId,
      title: `验证 ${mcp.name}`,
      timeoutMs: persist ? 90_000 : 35_000
    });
  } catch (error) {
    result = { success: false, stage: 'internal', error: `验证调用异常：${error.message}` };
  }
  if (!result.success) {
    const hint = result.stage === 'timeout'
      ? '。请检查 npm 网络和 Node.js；Chrome DevTools 还需确认调试端口 9222 已开启'
      : '';
    const message = `${result.error}${hint}${result.details ? `：${result.details}` : ''}`.slice(0, 260);
    mcpRuntimeStates.set(mcp.id, { state: 'failed', message });
    renderMcpMarket();
    logToTerminal(`[MCP] ${mcp.name} 验证失败：${message}`, 'error');
    return false;
  }

  if (persist) {
    if (!mcpConfig) mcpConfig = { mcpServers: {} };
    if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
    mcpConfig.mcpServers[mcp.id] = normalizedConfig;
    const saveResult = await window.agyHubAPI.writeMcpConfig(appPaths.mcpConfigPath, mcpConfig);
    if (!saveResult.success) {
      mcpRuntimeStates.set(mcp.id, { state: 'failed', message: `握手通过，但配置保存失败：${saveResult.error}` });
      renderMcpMarket();
      return false;
    }
  } else if (JSON.stringify(normalizedConfig) !== JSON.stringify(launchConfig) && mcpConfig?.mcpServers?.[mcp.id]) {
    mcpConfig.mcpServers[mcp.id] = normalizedConfig;
    const migration = await window.agyHubAPI.writeMcpConfig(appPaths.mcpConfigPath, mcpConfig);
    if (migration.success) logToTerminal(`[MCP] ${mcp.name} 已从 latest 自动固定到 ${mcp.package}。`, 'success');
  }

  const version = result.serverVersion ? ` ${result.serverVersion}` : '';
  mcpRuntimeStates.set(mcp.id, {
    state: 'ready',
    message: `握手通过${version} · ${result.versionPinned ? '版本已固定' : '版本未固定'}`
  });
  renderMcpMarket();
  logToTerminal(`[MCP] ${mcp.name} 安装成功，服务 ${result.serverName}${version} 握手通过。`, 'success');
  return true;
}

async function validateMcpConfigOnly(mcp, launchConfig) {
  const normalizedConfig = pinMcpLaunchConfig(mcp, launchConfig);
  let result;
  try {
    result = await window.agyHubAPI.validateMcpServer(normalizedConfig, { mode: 'config' });
  } catch (error) {
    result = { success: false, stage: 'config', error: error.message };
  }
  if (result.success) {
    mcpRuntimeStates.set(mcp.id, {
      state: 'configured',
      percent: 100,
      message: `已部署 · 配置通过 · ${result.versionPinned ? '版本已固定' : '版本未固定'}`
    });
  } else {
    mcpRuntimeStates.set(mcp.id, { state: 'failed', percent: 100, message: `配置无效：${result.error}` });
  }
  return result.success;
}

async function uninstallMcp(mcp) {
  if (!mcpConfig || !mcpConfig.mcpServers) return;
  delete mcpConfig.mcpServers[mcp.id];
  const result = await window.agyHubAPI.writeMcpConfig(appPaths.mcpConfigPath, mcpConfig);
  if (!result.success) {
    mcpRuntimeStates.set(mcp.id, { state: 'failed', message: `卸载失败：${result.error}` });
  } else {
    mcpRuntimeStates.delete(mcp.id);
    logToTerminal(`[MCP] 已移除 ${mcp.name} 配置。请在 Antigravity MCP 设置中刷新。`, 'success');
  }
  renderMcpMarket();
}

async function refreshInstalledMcpStatuses({ deep = false } = {}) {
  if (btnRefreshMcpStatus) btnRefreshMcpStatus.disabled = true;
  if (btnRefreshMcpStatus) btnRefreshMcpStatus.textContent = deep ? '验证中…' : '读取中…';
  try {
    if (appPaths && appPaths.mcpConfigPath) {
      const latestConfig = await window.agyHubAPI.readMcpConfig(appPaths.mcpConfigPath);
      if (latestConfig.success && latestConfig.data) {
        mcpConfig = latestConfig.data;
        if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};
      } else if (!latestConfig.success) {
        logToTerminal(`[MCP] 重新读取官方配置失败：${latestConfig.error}`, 'error');
      }
    }

    const active = mcpConfig?.mcpServers || {};
    const installed = Object.keys(active).map(id => {
      const configuredPackage = (active[id].args || []).find(isLikelyNpmPackage) || id;
      const preset = popularMcps.find(item => item.id === id)
        || popularMcps.find(item => stripPackageVersion(item.package) === stripPackageVersion(configuredPackage));
      if (preset) return { ...preset, id, name: id === preset.id ? preset.name : `${id} · ${preset.name}` };
      return {
        id,
        name: id,
        desc: '从本地配置读取的 MCP 服务。',
        package: configuredPackage,
        fields: [],
        note: '该服务不在内置验证清单中，请自行确认来源。',
        category: '实验性',
        supplyVerified: false,
        isLocalOnly: true
      };
    });
    let cursor = 0;
    const worker = async () => {
      while (cursor < installed.length) {
        const mcp = installed[cursor++];
        if (deep) await installAndVerifyMcp(mcp, active[mcp.id], false);
        else await validateMcpConfigOnly(mcp, active[mcp.id]);
      }
    };
    await Promise.all(Array.from({ length: Math.min(deep ? 2 : 6, installed.length) }, () => worker()));
  } finally {
    if (btnRefreshMcpStatus) btnRefreshMcpStatus.disabled = false;
    if (btnRefreshMcpStatus) btnRefreshMcpStatus.textContent = '深度验证';
    updateMcpSummary();
    updateMcpValidationProgress();
  }
}

// ==========================================
// 6. 智能体 Skill 推荐市场与 GitHub 在线同步
// ==========================================
let currentSkills = []; // 存储当前加载的 Skill 库列表

function skillTranslationPayload(skills = currentSkills) {
  return (skills || []).filter(skill => skill && skill.id).map(skill => ({
    id: skill.id,
    name: skill.name || skill.id,
    description: skill.originalDescription || skill.description || skill.desc || ''
  }));
}

function applySkillTranslationMap(skills, translations = {}) {
  return (skills || []).map((skill, index) => {
    const translation = translations[skill.id];
    if (!translation) return skill;
    const raw = { ...skill, __agyPresented: false, translation };
    return presentSkill(raw, index);
  });
}

async function hydrateSkillTranslations(skills) {
  if (!window.agyHubAPI.readSkillTranslations || !Array.isArray(skills) || !skills.length) return skills;
  const result = await window.agyHubAPI.readSkillTranslations(skillTranslationPayload(skills));
  if (!result.success) return skills;
  return applySkillTranslationMap(skills, result.translations);
}

async function translateMissingSkillDescriptions(limit = 12) {
  if (!window.agyHubAPI.translateSkillDescriptions || !currentSkills.length || !btnTranslateSkillDescriptions) return;
  btnTranslateSkillDescriptions.disabled = true;
  btnTranslateSkillDescriptions.textContent = 'AI 翻译中...';
  feedback?.begin('skill-translate', '翻译 Skill 简介', `正在翻译最多 ${limit} 个新增或变化的英文简介`);
  try {
    const result = await window.agyHubAPI.translateSkillDescriptions(skillTranslationPayload(), { limit });
    if (!result.success) throw new Error(result.error || '翻译失败');
    currentSkills = applySkillTranslationMap(currentSkills, result.translations);
    renderSkillCategoryRail();
    if (currentMarketTab === 'market') renderSkillMarket(currentSkills);
    const translatedCount = Array.isArray(result.translated) ? result.translated.length : 0;
    const pendingCount = Array.isArray(result.missing) ? result.missing.length : 0;
    const message = translatedCount
      ? `已新增 ${translatedCount} 条 AI 中文简介${pendingCount ? `，还有 ${pendingCount} 条待翻译，可再次点击继续` : '，当前英文简介已全部处理'}`
      : '没有发现需要重新翻译的英文简介';
    skillMarketSummary.className = 'integration-result success';
    skillMarketSummary.textContent = message;
    feedback?.succeed('skill-translate', message);
  } catch (error) {
    skillMarketSummary.className = 'integration-result error';
    skillMarketSummary.textContent = `简介翻译失败：${error.message}。已继续使用本地规则摘要。`;
    feedback?.fail('skill-translate', error.message);
  } finally {
    btnTranslateSkillDescriptions.disabled = false;
    btnTranslateSkillDescriptions.textContent = '翻译新增简介';
  }
}

const localPresetSkills = [
  {
    id: 'git-expert',
    name: '⚡ conventional-git-log',
    badge: '工作流提效',
    desc: '自动读取当前工作区的 Git 变更差分 (diff)，按照 Conventional Commit 规范智能生成极简、中文化提交日志。',
    prompt: '你是一个 Git 提交规范大师。当检测到工作区存在文件改动时，主动调用 git diff 提取详细差分。基于改动，按照 conventional commits 标准（形如 feat: 增加某功能、fix: 修复某漏洞）生成一句话极其精炼的中文提交日志。严禁废话。'
  },
  {
    id: 'antigravity-guide',
    name: '🧠 antigravity-guide',
    badge: '官方全能指南',
    desc: '帮助用户全景解答 Antigravity CLI 命令行工具 (agy)、快捷键配置、侧边栏及 MCP 全景开发技巧。',
    prompt: '你是一个 Antigravity 2.0 的资深全景导航专家。如果用户对 CLI 命令、 sidecars 运行参数或 XML 插件体系结构有任何疑问，你要给出最硬核、最直截了当的命令演示，引导用户配置 rules 和 skills。'
  },
  {
    id: 'science-researcher',
    name: '🧬 literature-researcher',
    badge: '学术科研助理',
    desc: '自动调用 PubMed 与 EuropePMC 学术接口，高效进行跨文献检索、蛋白质 AlphaFold 置信度分析与临床试验匹配。',
    prompt: '你是一个尖端生物和医学科研智能助理。当用户输入 UniProt Accession ID、疾病或药物名称时，你应当熟练调用 science 插件库中的 pdb-database、pubmed-database 和 alphafold 接口，从权威文献中提取三维结构置信度、靶点通路及临床试验进展，以专业学术报告格式输出。'
  },
  {
    id: 'frontend-crafter',
    name: '🎨 premium-ui-crafter',
    badge: '高级 UI 润色',
    desc: '让智能体精通磨砂毛玻璃特效、霓虹呼吸渐变发光等前沿 Cyber 赛博美学，给所有前端修改注入灵魂。',
    prompt: '你是一个视觉审美极其苛刻的前端设计工程师。每当修改或重构用户的 HTML/CSS 时，禁止使用平庸、廉价的白色渐变排版。必须融入暗黑背景、透明度毛玻璃（backdrop-filter）、高斯模糊悬浮投影、流光溢彩的渐变呼吸灯边框，使其散发高端赛博科技质感。'
  },
  {
    id: 'python-debugger',
    name: '🐍 python-debugger',
    badge: '调试优化',
    desc: '对 Python 代码进行静态深度诊断，捕捉隐藏死循环、内存溢出与空对象引用漏洞，自动给出修复补丁。',
    prompt: '你是一个 Python 资深调试专家。每当分析用户代码时，审查其变量生命周期、异常处理块以及内存释放，发现漏洞立即给出符合 PEP8 规范的修复代码。'
  },
  {
    id: 'readme-generator',
    name: '📝 awesome-readme-builder',
    badge: '文档生成',
    desc: '生成符合顶级开源项目标准的 Markdown 项目 README 结构，集成发光 Badge 标签、表格和 SVG 脑图。',
    prompt: '你是一个顶级开源项目文档专家。基于用户提供的项目结构 and 简述，生成极致美观、带有 Shields.io 发光标签、安装、测试和详细贡献指南的 README.md 模板。'
  },
  {
    id: 'sql-optimizer',
    name: '📊 sql-slow-query-tuner',
    badge: '数据查询调优',
    desc: '针对 MySQL/PostgreSQL 慢查询进行执行计划（EXPLAIN）分析，给出复合索引建议和重构写法。',
    prompt: '你是一个资深数据库 DBA。用户输入慢 SQL 语句时，分析其可能造成全表扫描的环节，提供添加覆盖索引、联合索引或使用 JOIN 子查询优化的替代写法。'
  },
  {
    id: 'security-audit',
    name: '🛡️ owasp-security-auditor',
    badge: '代码审计',
    desc: '审查 Java / Node.js 源码，智能检索 OWASP Top 10 级别漏洞（如 SQL 注入、SSRF 伪造与密码硬编码）。',
    prompt: '你是一个白帽子代码审计专家。静态审查用户提交的代码片段，检查是否存在敏感变量硬编码、不安全的 exec 调用与未过滤的用户输入输入，给出带防御代码的分析报告。'
  },
  {
    id: 'regex-wizard',
    name: '🧙 regex-magic-wand',
    badge: '正则表达式',
    desc: '将用户的自然语言描述一键转换为包含前瞻、后顾过滤的高效率正则表达式，并提供可视化边界解释。',
    prompt: '你是一个正则表达式巫师。接收到匹配要求后，给出最精简且无回溯风险的正则公式，并用可视化文字解释每一段匹配符号所起到的作用。'
  },
  {
    id: 'unit-test-generator',
    name: '🧪 jest-pytest-crafter',
    badge: '单元测试',
    desc: '基于现有函数/类结构，自动生成 Jest (JS) 或 Pytest (Python) 单元测试覆盖，内置 Mock 数据与边缘条件。',
    prompt: '你是一个测试开发专家。读取用户的函数后，自动生成 100% 覆盖率的单元测试代码，确保包括边界值、异常值以及正常逻辑测试，并使用 mock 技术隔离外部请求。'
  },
  {
    id: 'translation-pro',
    name: '🌐 academic-translator',
    badge: '润色翻译',
    desc: '信达雅多国学术级双语对照翻译，消除中式英文翻译僵硬感，自动转换语法为地道英文句式。',
    prompt: '你是一个国际学术期刊的主编。将用户的中文段落翻译为地道、严谨、多用学术名词的主动/被动语态英文，并输出双语对照。'
  },
  {
    id: 'api-craft',
    name: '🔌 restful-graphql-designer',
    badge: 'API 设计',
    desc: '基于业务概念，自动设计规范的 RESTful API 路由或 GraphQL Schema 定义，含状态码与参数要求。',
    prompt: '你是一个系统架构设计师。根据用户提供的业务模型，规划符合最佳设计标准的 RESTful 路由规范（包含 HTTP 动词、统一状态码）或 GraphQL 类型声明。'
  }
];

const installedSkillIds = new Set();
let installedSkillsPath = '';
let installedSkillsLoadedAt = 0;

function yamlString(value) {
  return JSON.stringify(String(value || '').replace(/\r?\n/g, ' '));
}

async function refreshInstalledSkills() {
  const result = await window.agyHubAPI.listInstalledSkills();
  installedSkillIds.clear();
  if (result.success) {
    installedSkillsPath = result.path;
    for (const skill of result.skills) {
      if (skill.valid) installedSkillIds.add(skill.id);
    }
  }
  return result;
}

async function refreshInstalledSkillsAndRender(force = false) {
  if (!force && installedSkillsList.length > 0 && Date.now() - installedSkillsLoadedAt < 15_000) {
    if (currentMarketTab === 'installed') renderSkillMarket(installedSkillsList);
    return { success: true, skills: installedSkillsList, cached: true };
  }
  const res = await window.agyHubAPI.listInstalledSkills();
  if (res.success) {
    installedSkillIds.clear();
    installedSkillsPath = res.path || installedSkillsPath;
    installedSkillsList = res.skills.map((s, index) => presentSkill({
      id: s.id,
      name: s.id,
      originalDescription: s.description || '已安装的本地技能',
      badge: '本地已校验',
      sourceType: 'local',
      risk: 'local',
      sequence: index + 1
    }, index));
    for (const skill of res.skills) {
      if (skill.valid) installedSkillIds.add(skill.id);
    }
    installedSkillsLoadedAt = Date.now();
    
    // 更新已安装数量数字
    const countSpan = document.getElementById('installed-skills-count');
    if (countSpan) {
      countSpan.textContent = installedSkillsList.length;
    }
    
    if (currentMarketTab === 'installed') {
      renderSkillMarket(installedSkillsList);
    }
  }
  return res;
}

function renderSkillCategoryRail() {
  const source = currentMarketTab === 'installed' ? installedSkillsList : currentSkills;
  const counts = new Map();
  for (const item of source) {
    const category = item.displayCategory || presentSkill(item).displayCategory;
    counts.set(category, (counts.get(category) || 0) + 1);
  }
  const categories = ['全部', ...SKILL_CATEGORIES.map(item => item[0]), '其他'].map(value => ({
    value,
    label: `${value} ${value === '全部' ? source.length : (counts.get(value) || 0)}`
  }));
  ensureCategoryRail('skill-category-rail', categories, activeSkillCategory, category => {
    activeSkillCategory = category;
    skillMarketCurrentPage = 1;
    renderSkillCategoryRail();
    renderSkillMarket(currentMarketTab === 'installed' ? installedSkillsList : currentSkills);
  });
}

async function initSkillMarket() {
  await refreshInstalledSkillsAndRender(true);
  
  const cacheRes = await window.agyHubAPI.readSkillCatalogCache();
  if (cacheRes.success && cacheRes.skills.length > 0) {
    currentSkills = cacheRes.skills.map((skill, index) => presentSkill({ ...skill, sourceType: skill.sourceType || 'remote', sequence: index + 1 }, index));
    currentSkills = await hydrateSkillTranslations(currentSkills);
    if (currentMarketTab === 'market') {
      renderSkillMarket(currentSkills);
    }
    // 静默在后台自动拉取更新
    silentSyncGithubSkills();
  } else {
    currentSkills = localPresetSkills.map((skill, index) => presentSkill({ ...skill, sourceType: 'builtin', sequence: index + 1 }, index));
    if (currentMarketTab === 'market') {
      renderSkillMarket(currentSkills);
    }
    // 首次无缓存，自动执行一次带 UI 提示的同步
    syncGithubSkillCatalog();
  }

  renderSkillCategoryRail();

  // 绑定搜索输入框联动的过滤筛选
  inputSearchSkill.addEventListener('input', () => {
    skillMarketCurrentPage = 1;
    const keyword = inputSearchSkill.value.toLowerCase().trim();
    const sourceList = (currentMarketTab === 'installed') ? installedSkillsList : currentSkills;
    const filtered = sourceList.filter(skill => {
      return [skill.id, skill.name, skill.chineseDescription, skill.originalDescription, skill.badge, skill.displayCategory]
        .some(value => String(value || '').toLowerCase().includes(keyword));
    });
    renderSkillMarket(filtered);
  });

  btnSyncGithubSkills.addEventListener('click', syncGithubSkillCatalog);
  btnTranslateSkillDescriptions?.addEventListener('click', () => translateMissingSkillDescriptions(12));

  // 选项卡切换事件绑定
  const tabMarket = document.getElementById('btn-tab-market');
  const tabInstalled = document.getElementById('btn-tab-installed');

  if (tabMarket && tabInstalled) {
    tabMarket.addEventListener('click', () => {
      currentMarketTab = 'market';
      tabMarket.classList.add('active');
      tabInstalled.classList.remove('active');
      skillMarketCurrentPage = 1;
      inputSearchSkill.value = '';
      renderSkillCategoryRail();
      renderSkillMarket(currentSkills);
    });

    tabInstalled.addEventListener('click', async () => {
      currentMarketTab = 'installed';
      tabInstalled.classList.add('active');
      tabMarket.classList.remove('active');
      skillMarketCurrentPage = 1;
      inputSearchSkill.value = '';
      renderSkillCategoryRail();
      await refreshInstalledSkillsAndRender(false);
    });
  }
}

async function silentSyncGithubSkills() {
  const result = await window.agyHubAPI.fetchSkillCatalog();
  if (result.success) {
    const localIds = new Set(localPresetSkills.map(skill => skill.id));
    const remoteSkills = result.skills
      .filter(skill => !localIds.has(skill.id))
      .map((skill, index) => presentSkill({
        id: skill.id,
        name: skill.name,
        originalDescription: skill.description,
        badge: `${skill.category} · ${skill.risk}`,
        path: skill.path,
        setup: skill.setup,
        risk: skill.risk,
        source: skill.source,
        sourceType: 'remote',
        sequence: localPresetSkills.length + index + 1
      }, localPresetSkills.length + index));
    currentSkills = [
      ...localPresetSkills.map((skill, index) => presentSkill({ ...skill, sourceType: 'builtin', risk: 'safe', sequence: index + 1 }, index)),
      ...remoteSkills
    ];
    currentSkills = await hydrateSkillTranslations(currentSkills);
    renderSkillCategoryRail();
    if (currentMarketTab === 'market' && !inputSearchSkill.value.trim()) {
      renderSkillMarket(currentSkills);
    }
  }
}

async function syncGithubSkillCatalog() {
  feedback?.begin('skill-sync', '同步 Skill 社区仓库', '正在读取并校验技能目录');
  btnSyncGithubSkills.disabled = true;
  btnSyncGithubSkills.textContent = '正在同步...';
  skillMarketSummary.className = 'integration-summary';
  skillMarketSummary.textContent = '正在读取真实 skills_index.json 清单...';
  logToTerminal('[Skill] 正在同步 sickn33/agentic-awesome-skills 真实技能清单...');
  const result = await window.agyHubAPI.fetchSkillCatalog();
  if (!result.success) {
    feedback?.fail('skill-sync', `同步失败：${result.error}`);
    skillMarketSummary.className = 'integration-result error';
    skillMarketSummary.textContent = `同步失败：${result.error}。仍可使用内置技能。`;
    logToTerminal(`[Skill] GitHub 技能清单同步失败：${result.error}`, 'error');
  } else {
    const localIds = new Set(localPresetSkills.map(skill => skill.id));
    const remoteSkills = result.skills
      .filter(skill => !localIds.has(skill.id))
      .map((skill, index) => presentSkill({
        id: skill.id,
        name: skill.name,
        originalDescription: skill.description,
        badge: `${skill.category} · ${skill.risk}`,
        path: skill.path,
        setup: skill.setup,
        risk: skill.risk,
        source: skill.source,
        sourceType: 'remote',
        sequence: localPresetSkills.length + index + 1
      }, localPresetSkills.length + index));
    currentSkills = [
      ...localPresetSkills.map((skill, index) => presentSkill({ ...skill, sourceType: 'builtin', risk: 'safe', sequence: index + 1 }, index)),
      ...remoteSkills
    ];
    currentSkills = await hydrateSkillTranslations(currentSkills);
    renderSkillCategoryRail();
    inputSearchSkill.value = '';
    skillMarketCurrentPage = 1;
    renderSkillMarket(currentSkills);
    skillMarketSummary.className = 'integration-result success';
    skillMarketSummary.textContent = `同步成功：${result.source} 提供 ${result.total} 个可安装技能；高风险/攻击性条目已自动过滤。`;
    logToTerminal(`[Skill] 已同步 ${result.total} 个真实社区技能。`, 'success');
    await translateMissingSkillDescriptions(12);
    feedback?.succeed('skill-sync', `已同步 ${result.total} 个技能，并过滤高风险条目`);
    setTimeout(() => {
      if (skillMarketSummary.className.includes('success')) {
        skillMarketSummary.className = 'integration-summary';
        skillMarketSummary.textContent = `本地已校验 ${installedSkillIds.size} 个 Skill · 当前匹配 ${currentSkills.length} 个 · 目录：${installedSkillsPath}`;
      }
    }, 5000);
  }
  btnSyncGithubSkills.disabled = false;
  btnSyncGithubSkills.textContent = '同步 GitHub 社区仓库';
}

function showSkillDetail(skill) {
  viewedSkillIds.add(skill.id);
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('agy-viewed-skills', JSON.stringify([...viewedSkillIds].slice(-5000)));
    } catch {
      // 浏览记录属于非关键状态，存储不可用时不阻断详情展示。
    }
  }
  let overlay = document.getElementById('skill-detail-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'skill-detail-modal';
    overlay.className = 'modal-overlay market-detail-overlay';
    document.body.appendChild(overlay);
  }
  overlay.replaceChildren();
  const dialog = document.createElement('article');
  dialog.className = 'market-detail-dialog';
  const close = document.createElement('button');
  close.className = 'modal-close-btn';
  close.textContent = '✕';
  close.addEventListener('click', () => { overlay.style.display = 'none'; renderSkillMarket(lastSkillList); });
  const eyebrow = document.createElement('div');
  eyebrow.className = 'market-card-eyebrow';
  eyebrow.textContent = `#${String(skill.sequence).padStart(4, '0')} · ${skill.displayCategory} · ${skill.riskLabel}`;
  const title = document.createElement('h3');
  title.textContent = skill.name || skill.id;
  const chineseTitle = document.createElement('h4');
  chineseTitle.textContent = '中文用途说明';
  const chinese = document.createElement('p');
  chinese.textContent = skill.chineseDescription;
  const originalTitle = document.createElement('h4');
  originalTitle.textContent = '仓库原始说明';
  const original = document.createElement('p');
  original.textContent = skill.originalDescription || '仓库没有提供简介。';
  const meta = document.createElement('div');
  meta.className = 'market-detail-meta';
  meta.textContent = `标识：${skill.id} · 来源：${skill.source || skill.sourceType || '本地'} · 简介：${skill.translationSource || '规则摘要'}${skill.translatedAt ? ` · 翻译时间：${new Date(skill.translatedAt).toLocaleString()}` : ''}${skill.path ? ` · 路径：${skill.path}` : ''}`;
  dialog.append(close, eyebrow, title, chineseTitle, chinese, originalTitle, original, meta);
  overlay.appendChild(dialog);
  overlay.style.display = 'flex';
}

function renderSkillMarket(skills) {
  lastSkillList = Array.isArray(skills) ? skills : [];
  const container = document.getElementById('skills-market-container');
  if (!container) return;
  container.replaceChildren();
  skills = lastSkillList.every(skill => skill?.__agyPresented)
    ? lastSkillList
    : lastSkillList.map((skill, index) => presentSkill(skill, index));
  if (activeSkillCategory !== '全部') skills = skills.filter(skill => skill.displayCategory === activeSkillCategory);

  const paginationContainer = document.getElementById('skills-market-pagination');

  if (skills.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'integration-summary';
    empty.textContent = '没有找到匹配的技能。';
    container.appendChild(empty);
    if (paginationContainer) {
      paginationContainer.replaceChildren();
    }
    return;
  }

  // 根据窗口尺寸动态填满当前页面。
  const pageSize = calculatePageSize(container, 260, 210, 5);
  const totalPages = Math.ceil(skills.length / pageSize);

  // 保证当前页合法
  if (skillMarketCurrentPage < 1) skillMarketCurrentPage = 1;
  if (skillMarketCurrentPage > totalPages) skillMarketCurrentPage = totalPages;

  // 截取当前页的技能
  const startIndex = (skillMarketCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, skills.length);
  const paginatedSkills = skills.slice(startIndex, endIndex);

  // 渲染当前页的卡片
  for (const [pageOffset, skill] of paginatedSkills.entries()) {
    const installed = installedSkillIds.has(skill.id);
    const card = document.createElement('div');
    card.className = `skill-market-card${installed ? ' installed' : ''}${viewedSkillIds.has(skill.id) ? ' viewed' : ''}`;

    const eyebrow = document.createElement('div');
    eyebrow.className = 'market-card-eyebrow';
    eyebrow.textContent = `#${String(skill.sequence || startIndex + pageOffset + 1).padStart(4, '0')} · ${skill.displayCategory} · ${skill.translationSource || '规则摘要'}${viewedSkillIds.has(skill.id) ? ' · 已查看' : ''}`;

    const header = document.createElement('div');
    header.className = 'skill-market-header';
    const name = document.createElement('span');
    name.className = 'skill-market-name';
    name.textContent = skill.name;
    name.title = skill.name;
    const badge = document.createElement('span');
    badge.className = 'skill-market-badge';
    badge.textContent = installed ? '已安装' : skill.riskLabel;
    header.append(name, badge);

    const desc = document.createElement('div');
    desc.className = 'skill-market-desc';
    desc.textContent = skill.chineseDescription;

    // 渲染动作按钮区
    const footer = document.createElement('div');
    footer.className = 'skill-market-footer';
    const detailButton = document.createElement('button');
    detailButton.className = 'btn-skill-detail';
    detailButton.textContent = '查看详情';
    detailButton.addEventListener('click', () => showSkillDetail(skill));
    footer.appendChild(detailButton);

    if (installed) {
      // 已经安装的技能，渲染红色的删除按钮，并可以点击卸载
      const uninstallButton = document.createElement('button');
      uninstallButton.className = 'btn-uninstall';
      uninstallButton.textContent = '删除技能';
      footer.appendChild(uninstallButton);

      uninstallButton.addEventListener('click', async () => {
        uninstallButton.disabled = true;
        uninstallButton.textContent = '正在删除...';
        logToTerminal(`[Skill] 正在删除技能 ${skill.id}...`);
        feedback?.begin(`skill-remove-${skill.id}`, '删除 Skill', `正在删除 ${skill.id}`);
        const result = await window.agyHubAPI.uninstallSkill(skill.id);
        if (result.success) {
          installedSkillIds.delete(skill.id);
          logToTerminal(`[Skill] 技能已物理删除：${skill.id}`, 'success');
          feedback?.succeed(`skill-remove-${skill.id}`, `${skill.id} 已删除`);
          
          // 重新拉取本地列表以更新角标及渲染
          await refreshInstalledSkillsAndRender(true);
          
          if (currentMarketTab === 'market') {
            // 在推荐市场大列表时，重绘即可
            renderSkillMarket(skills);
          }
        } else {
          feedback?.fail(`skill-remove-${skill.id}`, result.error || '删除失败');
          uninstallButton.disabled = false;
          uninstallButton.textContent = '删除技能';
          logToTerminal(`[Skill] 删除技能失败：${result.error}`, 'error');
        }
      });
    } else {
      // 未安装的技能，渲染“安装并验证”按钮
      const installButton = document.createElement('button');
      installButton.className = 'btn-import';
      installButton.textContent = '安装并验证';
      footer.appendChild(installButton);

      installButton.addEventListener('click', async () => {
        installButton.disabled = true;
        installButton.textContent = '正在安装...';
        logToTerminal(`[Skill] 正在安装并验证 ${skill.id}...`);
        feedback?.begin(`skill-install-${skill.id}`, '安装 Skill', `正在下载并校验 ${skill.id}`);
        let result;
        if (skill.sourceType === 'remote') {
          result = await window.agyHubAPI.installCommunitySkill({ id: skill.id, path: skill.path, risk: skill.risk, source: skill.source });
        } else {
          const skillMarkdown = `---\nname: ${skill.id}\ndescription: ${yamlString(skill.desc)}\n---\n\n# ${skill.id}\n\n${skill.prompt}\n`;
          result = await window.agyHubAPI.writeSkill(null, skill.id, skillMarkdown);
        }

        if (result.success && result.verified) {
          installedSkillIds.add(skill.id);
          logToTerminal(`[Skill] ${skill.id} 已成功导入并校验通过。`, 'success');
          feedback?.succeed(`skill-install-${skill.id}`, `${skill.id} 安装完成 · SHA-256 已记录`);
          skillMarketSummary.className = 'integration-result success';
          skillMarketSummary.textContent = `安装成功：${skill.id} · 已写入官方全局目录 · SKILL.md 校验通过。重新打开对话后可被 Antigravity 发现。`;
          
          // 重新拉取以同步已安装角标
          await refreshInstalledSkillsAndRender(true);
          
          if (currentMarketTab === 'market') {
            renderSkillMarket(skills); // 原地重绘
          }

          setTimeout(() => {
            if (skillMarketSummary.className.includes('success')) {
              skillMarketSummary.className = 'integration-summary';
              skillMarketSummary.textContent = `本地已校验 ${installedSkillIds.size} 个 Skill · 当前匹配 ${skills.length} 个 · 第 ${skillMarketCurrentPage}/${totalPages} 页 · 目录：${installedSkillsPath}`;
            }
          }, 5000);
        } else {
          feedback?.fail(`skill-install-${skill.id}`, result.error || '安装失败');
          installButton.disabled = false;
          installButton.textContent = '重试安装';
          skillMarketSummary.className = 'integration-result error';
          skillMarketSummary.textContent = `安装失败：${result.error || '未知错误'}`;
          logToTerminal(`[Skill] ${skill.id} 安装失败：${result.error || '未知错误'}`, 'error');
        }
      });
    }

    card.append(eyebrow, header, desc, footer);
    container.appendChild(card);
  }

  // 渲染分页导航
  if (paginationContainer) {
    paginationContainer.replaceChildren();
    
    if (totalPages > 1) {
      // 1. 上一页按钮
      const prevBtn = document.createElement('button');
      prevBtn.className = `pager-btn${skillMarketCurrentPage === 1 ? ' disabled' : ''}`;
      prevBtn.textContent = '上一页';
      prevBtn.disabled = skillMarketCurrentPage === 1;
      prevBtn.addEventListener('click', () => {
        skillMarketCurrentPage--;
        renderSkillMarket(skills);
      });
      paginationContainer.appendChild(prevBtn);

      // 2. 文本显示：第 X 页 / 共 Y 页
      const pageText = document.createElement('span');
      pageText.className = 'pager-text';
      pageText.textContent = ` 第 ${skillMarketCurrentPage} 页 / 共 ${totalPages} 页 `;
      paginationContainer.appendChild(pageText);

      // 3. 下一页按钮
      const nextBtn = document.createElement('button');
      nextBtn.className = `pager-btn${skillMarketCurrentPage === totalPages ? ' disabled' : ''}`;
      nextBtn.textContent = '下一页';
      nextBtn.disabled = skillMarketCurrentPage === totalPages;
      nextBtn.addEventListener('click', () => {
        skillMarketCurrentPage++;
        renderSkillMarket(skills);
      });
      paginationContainer.appendChild(nextBtn);

      // 4. 页码跳转区
      const jumpContainer = document.createElement('div');
      jumpContainer.className = 'pager-jump-container';
      
      const jumpLabel1 = document.createElement('span');
      jumpLabel1.textContent = ' 跳转到 ';
      
      const jumpInput = document.createElement('input');
      jumpInput.type = 'number';
      jumpInput.className = 'pager-jump-input';
      jumpInput.min = 1;
      jumpInput.max = totalPages;
      jumpInput.value = skillMarketCurrentPage;
      
      const jumpLabel2 = document.createElement('span');
      jumpLabel2.textContent = ' 页 ';
      
      const jumpBtn = document.createElement('button');
      jumpBtn.className = 'pager-btn';
      jumpBtn.textContent = '确定';
      
      const triggerJump = () => {
        let targetPage = parseInt(jumpInput.value, 10);
        if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
        if (targetPage > totalPages) targetPage = totalPages;
        skillMarketCurrentPage = targetPage;
        renderSkillMarket(skills);
      };

      jumpBtn.addEventListener('click', triggerJump);
      jumpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') triggerJump();
      });

      jumpContainer.append(jumpLabel1, jumpInput, jumpLabel2, jumpBtn);
      paginationContainer.appendChild(jumpContainer);
    }
  }

  // 统计信息
  if (!skillMarketSummary.classList.contains('success') && !skillMarketSummary.classList.contains('error')) {
    skillMarketSummary.textContent = `本地已校验 ${installedSkillIds.size} 个 Skill · 当前匹配 ${skills.length} 个 · 第 ${skillMarketCurrentPage}/${totalPages} 页 · 目录：${installedSkillsPath}`;
  }
}

function reflow(targetId = '') {
  const mcpPane = document.getElementById('tab-mcp');
  const skillPane = document.getElementById('tab-skill-market');
  if (targetId === 'tab-mcp' || (!targetId && mcpPane?.classList.contains('active'))) {
    renderMcpMarket();
  }
  if (targetId === 'tab-skill-market' || (!targetId && skillPane?.classList.contains('active'))) {
    renderSkillMarket(currentMarketTab === 'installed' ? installedSkillsList : currentSkills);
  }
}

function scheduleReflow(targetId = '') {
  if (layoutFrame) cancelAnimationFrame(layoutFrame);
  layoutFrame = requestAnimationFrame(() => {
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      reflow(targetId);
    });
  });
  if (layoutSettleTimer) clearTimeout(layoutSettleTimer);
  layoutSettleTimer = setTimeout(() => {
    layoutSettleTimer = null;
    reflow(targetId);
  }, 140);
}

  async function init(dependencies = {}) {
    appPaths = dependencies.appPaths || null;
    logToTerminal = dependencies.logToTerminal || logToTerminal;
    if (initialized) return true;
    initialized = true;
    window.agyHubAPI.onOperationProgress?.(payload => {
      if (!String(payload?.id || '').startsWith('mcp-')) return;
      const id = String(payload.id).slice(4);
      const existing = mcpRuntimeStates.get(id);
      if (!existing || existing.state !== 'verifying') return;
      mcpRuntimeStates.set(id, {
        ...existing,
        message: payload.message || existing.message,
        percent: Math.max(Number(existing.percent) || 0, Number(payload.percent) || 0)
      });
      renderMcpMarket();
    });
    await Promise.all([initMcpMarket(), initSkillMarket()]);
    const redraw = () => scheduleReflow();
    document.addEventListener('agy-marketplace-tab-opened', event => scheduleReflow(event.detail?.targetId || ''));
    window.addEventListener('resize', redraw, { passive: true });
    if (typeof ResizeObserver === 'function') {
      marketplaceResizeObserver = new ResizeObserver(redraw);
      const mainContent = document.querySelector('.main-content');
      if (mainContent) marketplaceResizeObserver.observe(mainContent);
    }
    scheduleReflow();
    return true;
  }

  return { init, reflow, scheduleReflow, classifySkill, presentSkill, stripPackageVersion };
});
