const fs = require('fs');
const path = require('path');

const CACHE_FILE = 'antigravity-model-catalog.json';

const KNOWN_MODEL_ORDER = Object.freeze([
  'gemini-3.8-flash-high',
  'gemini-3.8-flash-medium',
  'gemini-3.8-flash-low',
  'gemini-3.7-flash-high',
  'gemini-3.7-flash-medium',
  'gemini-3.7-flash-low',
  'gemini-3.6-flash-high',
  'gemini-3.6-flash-medium',
  'gemini-3.6-flash-low',
  'gemini-3.1-pro-high',
  'gemini-3.1-pro-low',
  'claude-opus-4-6-thinking',
  'claude-sonnet-4-6'
]);

const MODEL_DISPLAY_NAMES = Object.freeze({
  'agy-auto': 'AGY 自动路由（按额度）',
  'gemini-3.8-flash-high': 'Gemini 3.8 Flash (High)',
  'gemini-3.8-flash-medium': 'Gemini 3.8 Flash (Medium)',
  'gemini-3.8-flash-low': 'Gemini 3.8 Flash (Low)',
  'gemini-3.7-flash-high': 'Gemini 3.7 Flash (High)',
  'gemini-3.7-flash-medium': 'Gemini 3.7 Flash (Medium)',
  'gemini-3.7-flash-low': 'Gemini 3.7 Flash (Low)',
  'gemini-3.6-flash-high': 'Gemini 3.6 Flash (High)',
  'gemini-3.6-flash-medium': 'Gemini 3.6 Flash (Medium)',
  'gemini-3.6-flash-low': 'Gemini 3.6 Flash (Low)',
  'gemini-3.1-pro-high': 'Gemini 3.1 Pro (High)',
  'gemini-3.1-pro-low': 'Gemini 3.1 Pro (Low)',
  'claude-opus-4-6-thinking': 'Claude Opus 4.6 (Thinking)',
  'claude-sonnet-4-6': 'Claude Sonnet 4.6 (Thinking)'
});

const MODEL_GROUP_LABELS = Object.freeze({
  auto: '自动路由',
  gemini: 'Gemini',
  claude: 'Claude',
  'gpt-oss': 'GPT-OSS',
  other: '其他模型'
});

const MODEL_ORDER_INDEX = new Map(KNOWN_MODEL_ORDER.map((model, index) => [model, index]));
const FAMILY_ORDER = Object.freeze({ auto: 0, gemini: 1, claude: 2, 'gpt-oss': 3, other: 4 });

let cachePath = '';
let loadedPath = '';
let snapshot = emptySnapshot();

function emptySnapshot() {
  return {
    models: [],
    rawModels: [],
    updatedAt: null,
    source: 'fallback',
    endpoint: ''
  };
}

function modelContainer(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return payload.models
    || payload.response?.models
    || payload.data?.models
    || null;
}

function rawModelIds(payload) {
  const models = modelContainer(payload);
  if (Array.isArray(models)) {
    return models.map(item => String(item?.id || item?.name || item || '').replace(/^models\//, '').trim()).filter(Boolean);
  }
  if (models && typeof models === 'object') return Object.keys(models).map(value => String(value).replace(/^models\//, '').trim()).filter(Boolean);
  return [];
}

function expandInternalModelId(model) {
  const value = String(model || '').trim();
  if (!value) return [];
  const tiered = /^gemini-(\d+(?:\.\d+)?)-flash-tiered$/i.exec(value);
  if (tiered) {
    const version = tiered[1];
    return [
      `gemini-${version}-flash-high`,
      `gemini-${version}-flash-medium`,
      `gemini-${version}-flash-low`
    ];
  }
  if (value === 'gemini-3.5-flash-low') return ['gemini-3.5-flash-lite'];
  if (value === 'gemini-pro-agent') return ['gemini-3.1-pro-high'];
  return [value];
}

function isAgentModel(model) {
  const value = String(model || '').trim();
  return /^(?:gemini-|claude-|gpt-oss-)/i.test(value)
    && !/(?:embedding|image-generation|imagen|(?:^|[-_])image(?:$|[-_])|tts|speech|veo|audio)/i.test(value)
    && !/^gemini-\d+(?:\.\d+)?-flash-agent$/i.test(value)
    && !/^gemini-\d+(?:\.\d+)?-flash$/i.test(value)
    && !/^gemini-\d+(?:\.\d+)?-flash-thinking$/i.test(value)
    && !/-tiered$/i.test(value);
}

function modelFamily(model) {
  const value = String(model || '').trim().toLowerCase();
  if (value === 'agy-auto') return 'auto';
  if (value.startsWith('gemini-')) return 'gemini';
  if (value.startsWith('claude-')) return 'claude';
  if (value.startsWith('gpt-oss-')) return 'gpt-oss';
  return 'other';
}

function modelDisplayName(model) {
  const value = String(model || '').trim();
  if (MODEL_DISPLAY_NAMES[value]) return MODEL_DISPLAY_NAMES[value];

  const gemini = /^gemini-(\d+(?:\.\d+)?)-(flash|pro)(?:-(high|medium|low|lite|extra-low))?$/i.exec(value);
  if (gemini) {
    const family = gemini[2].toLowerCase() === 'pro' ? 'Pro' : 'Flash';
    const variant = {
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      lite: 'Lite',
      'extra-low': 'Extra Low'
    }[String(gemini[3] || '').toLowerCase()];
    return `Gemini ${gemini[1]} ${family}${variant ? ` (${variant})` : ''}`;
  }

  const claude = /^claude-(opus|sonnet)-(\d+(?:-\d+)+)(?:-(thinking))?$/i.exec(value);
  if (claude) {
    const family = claude[1][0].toUpperCase() + claude[1].slice(1).toLowerCase();
    return `Claude ${family} ${claude[2].replace(/-/g, '.')}${claude[3] ? ' (Thinking)' : ''}`;
  }

  const gptOss = /^gpt-oss-([^-]+)(?:-(.+))?$/i.exec(value);
  if (gptOss) {
    const suffix = gptOss[2]
      ? ` (${gptOss[2][0].toUpperCase() + gptOss[2].slice(1)})`
      : '';
    return `GPT-OSS ${gptOss[1].toUpperCase()}${suffix}`;
  }

  return value;
}

function compareModelIds(left, right) {
  const leftValue = String(left || '').trim();
  const rightValue = String(right || '').trim();
  const leftFamily = modelFamily(leftValue);
  const rightFamily = modelFamily(rightValue);
  const familyDelta = (FAMILY_ORDER[leftFamily] ?? FAMILY_ORDER.other) - (FAMILY_ORDER[rightFamily] ?? FAMILY_ORDER.other);
  if (familyDelta !== 0) return familyDelta;

  const leftKnown = MODEL_ORDER_INDEX.has(leftValue);
  const rightKnown = MODEL_ORDER_INDEX.has(rightValue);
  if (leftKnown && rightKnown) return MODEL_ORDER_INDEX.get(leftValue) - MODEL_ORDER_INDEX.get(rightValue);
  if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
  return leftValue.localeCompare(rightValue, 'en', { numeric: true, sensitivity: 'base' });
}

function sortAntigravityModels(models) {
  const values = Array.isArray(models) ? models : [];
  return [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].sort(compareModelIds);
}

function describeAntigravityModels(models) {
  return sortAntigravityModels(models).map(id => ({
    id,
    label: modelDisplayName(id),
    group: MODEL_GROUP_LABELS[modelFamily(id)] || MODEL_GROUP_LABELS.other
  }));
}

function versionParts(value) {
  return String(value || '').split(/[.-]/)
    .map(part => Number.parseInt(part, 10))
    .filter(Number.isFinite);
}

function compareVersionPartsDescending(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (b[index] || 0) - (a[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function latestVersion(models, expression) {
  const versions = [];
  for (const model of models) {
    const match = expression.exec(model);
    expression.lastIndex = 0;
    if (match?.[1]) versions.push(match[1]);
  }
  return versions.sort(compareVersionPartsDescending)[0] || '';
}

function selectCurrentModels(models) {
  const candidates = [...new Set((Array.isArray(models) ? models : [])
    .map(value => String(value || '').trim())
    .filter(isAgentModel))];
  const selected = [];

  const flashModels = candidates
    .filter(model => /^gemini-\d+(?:\.\d+)?-flash-(?:high|medium|low)$/i.test(model))
    .sort(compareModelIds);
  selected.push(...flashModels);

  const proModels = candidates
    .filter(model => /^gemini-\d+(?:\.\d+)?-pro-(?:high|low)$/i.test(model))
    .sort(compareModelIds);
  selected.push(...proModels);

  for (const family of ['opus', 'sonnet']) {
    const familyModels = candidates.filter(model => new RegExp(`^claude-${family}-`, 'i').test(model));
    const versions = familyModels
      .map(model => new RegExp(`^claude-${family}-(\\d+(?:-\\d+)+)`, 'i').exec(model)?.[1] || '')
      .filter(Boolean)
      .sort(compareVersionPartsDescending);
    const newest = versions[0] || '';
    if (newest) selected.push(...familyModels.filter(model => model.includes(`-${newest}`)));
  }

  return sortAntigravityModels(selected);
}

function normalizeAvailableModels(payload) {
  const raw = rawModelIds(payload);
  const expanded = raw.flatMap(expandInternalModelId);
  return {
    rawModels: [...new Set(raw)].sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })),
    models: selectCurrentModels(expanded)
  };
}

function readSnapshot(file) {
  try {
    if (!file || !fs.existsSync(file)) return emptySnapshot();
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    const rawModels = Array.isArray(parsed?.rawModels) ? parsed.rawModels.map(String).filter(Boolean) : [];
    const sourceModels = rawModels.length
      ? rawModels.flatMap(expandInternalModelId)
      : (Array.isArray(parsed?.models) ? parsed.models.map(String) : []);
    return {
      models: selectCurrentModels(sourceModels),
      rawModels: [...new Set(rawModels)].sort((left, right) => left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })),
      updatedAt: parsed?.updatedAt || null,
      source: parsed?.source || 'cache',
      endpoint: parsed?.endpoint || ''
    };
  } catch (_) {
    return emptySnapshot();
  }
}

function persistSnapshot() {
  if (!cachePath) return;
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    const temporary = `${cachePath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    try {
      fs.renameSync(temporary, cachePath);
    } catch (_) {
      fs.rmSync(cachePath, { force: true });
      fs.renameSync(temporary, cachePath);
    }
  } catch (error) {
    console.warn('[Model Catalog] Failed to persist Antigravity model catalog:', error.message);
  }
}

function configureAntigravityModelCatalog(stateDir) {
  if (!stateDir) return getAntigravityModelCatalog();
  const nextPath = path.join(stateDir, CACHE_FILE);
  if (loadedPath !== nextPath) {
    cachePath = nextPath;
    loadedPath = nextPath;
    snapshot = readSnapshot(nextPath);
  }
  return getAntigravityModelCatalog();
}

function captureAntigravityModelCatalog(payload, options = {}) {
  if (options.stateDir) configureAntigravityModelCatalog(options.stateDir);
  let parsed = payload;
  try {
    if (Buffer.isBuffer(parsed)) parsed = JSON.parse(parsed.toString('utf8'));
    else if (typeof parsed === 'string') parsed = JSON.parse(parsed);
  } catch (_) {
    return { updated: false, ...getAntigravityModelCatalog() };
  }
  const normalized = normalizeAvailableModels(parsed);
  if (!normalized.models.length) return { updated: false, ...getAntigravityModelCatalog() };
  snapshot = {
    models: normalized.models,
    rawModels: normalized.rawModels,
    updatedAt: new Date().toISOString(),
    source: options.source || 'antigravity-proxy',
    endpoint: options.endpoint || ''
  };
  persistSnapshot();
  return { updated: true, ...getAntigravityModelCatalog() };
}

function getAntigravityModelCatalog(options = {}) {
  if (options.stateDir) configureAntigravityModelCatalog(options.stateDir);
  return {
    models: [...snapshot.models],
    rawModels: [...snapshot.rawModels],
    updatedAt: snapshot.updatedAt,
    source: snapshot.source,
    endpoint: snapshot.endpoint,
    live: snapshot.models.length > 0
  };
}

function resolveAntigravityUpstreamModel(model, options = {}) {
  const value = String(model || '').trim();
  if (!value) return value;
  const catalog = getAntigravityModelCatalog(options);
  const raw = new Set(catalog.rawModels);

  // Antigravity's current Hub client exposes 3.7/3.8 as friendly effort tiers,
  // while the most reliable Cloud Code wire route is the corresponding tiered
  // model.  Keep the UI ids stable and select the effort through
  // generationConfig.thinkingConfig.thinkingLevel at request time.
  const tieredFlash = /^gemini-(3\.(?:7|8))-flash-(high|medium|low)$/i.exec(value);
  if (tieredFlash) {
    const tiered = `gemini-${tieredFlash[1]}-flash-tiered`;
    if (!raw.size || raw.has(tiered)) return tiered;
  }

  if (raw.has(value)) return value;
  if ((value === 'gemini-3.1-pro-high' || value === 'gemini-3.1-pro') && raw.has('gemini-pro-agent')) {
    return 'gemini-pro-agent';
  }
  if (value === 'gemini-3.5-flash-lite' && raw.has('gemini-3.5-flash-low')) {
    return 'gemini-3.5-flash-low';
  }
  if (!raw.size) {
    if (value === 'gemini-3.5-flash-lite') return 'gemini-3.5-flash-low';
    if (value === 'gemini-3.1-pro-high' || value === 'gemini-3.1-pro') return 'gemini-pro-agent';
  }
  return value;
}

function resetAntigravityModelCatalogForTests() {
  cachePath = '';
  loadedPath = '';
  snapshot = emptySnapshot();
}

module.exports = {
  CACHE_FILE,
  KNOWN_MODEL_ORDER,
  MODEL_DISPLAY_NAMES,
  MODEL_GROUP_LABELS,
  modelDisplayName,
  sortAntigravityModels,
  describeAntigravityModels,
  selectCurrentModels,
  normalizeAvailableModels,
  configureAntigravityModelCatalog,
  captureAntigravityModelCatalog,
  getAntigravityModelCatalog,
  resolveAntigravityUpstreamModel,
  resetAntigravityModelCatalogForTests
};
