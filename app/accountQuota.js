// Shared by AGY Hub and the Antigravity account-dialog patch. Never writes account state.
const QUOTA_HOSTS = ['daily-cloudcode-pa.googleapis.com', 'cloudcode-pa.googleapis.com'];
const BUCKET_FIELDS = Object.freeze({
  'gemini-5h': 'gemini5h',
  'gemini-weekly': 'geminiWeekly',
  'gemini-argon-wtu-weekly': 'argonWeekly',
  '3p-5h': 'claude5h',
  '3p-weekly': 'claudeWeekly'
});
const FIELDS = Object.freeze(['gemini5h', 'geminiWeekly', 'claude5h', 'claudeWeekly']);
const OPTIONAL_FIELDS = Object.freeze(['argonWeekly']);
const SHORT_WINDOW_FIELDS = Object.freeze(['gemini5h', 'claude5h']);
const WEEKLY_FIELDS = Object.freeze(['geminiWeekly', 'claudeWeekly']);
const ARGON_MODEL_ID = /^gemini[-_](?:4[-_])?argon(?:[-_]|$)/i;
const CLI_QUOTA_USER_AGENT = 'antigravity/cli/1.4.5 (aidev_client; os_type=windows; arch=amd64; auth_method=consumer)';

function fractionPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function parseQuotaSummary(payload) {
  const quota = {};
  const summary = payload?.response || payload;
  for (const group of summary?.groups || []) {
    for (const bucket of group?.buckets || []) {
      const field = BUCKET_FIELDS[bucket.bucketId];
      const percent = fractionPercent(bucket.remainingFraction);
      if (!field || percent === null) continue;
      quota[field] = `${percent}%`;
      quota[`${field}Reset`] = bucket.resetTime || null;
    }
  }
  return quota;
}

function parseModelQuota(payload) {
  const source = payload?.models || payload?.response?.models || payload?.data?.models || {};
  const models = Array.isArray(source)
    ? source.map(model => [String(model?.id || model?.name || ''), model]).filter(([id]) => id)
    : Object.entries(source);
  const quota = {};
  const argon = models.find(([id, model]) => ARGON_MODEL_ID.test(id)
    && fractionPercent(model?.quotaInfo?.remainingFraction ?? model?.quota_info?.remaining_fraction ?? model?.remainingFraction) !== null);
  if (argon) {
    const info = argon[1]?.quotaInfo || argon[1]?.quota_info || argon[1];
    quota.argonWeekly = `${fractionPercent(info.remainingFraction ?? info.remaining_fraction)}%`;
    quota.argonWeeklyReset = info.resetTime || info.reset_time || null;
  }
  for (const [family, expression] of [['gemini', /^gemini-.*(?:flash|pro)/i], ['claude', /^(?:claude-|gpt-oss-)/i]]) {
    const matching = models.filter(([id, model]) => expression.test(id)
      && !/image|audio|tts|embedding/i.test(id) && fractionPercent(model?.quotaInfo?.remainingFraction) !== null);
    matching.sort(([a], [b]) => b.localeCompare(a, 'en', { numeric: true }));
    const info = matching[0]?.[1]?.quotaInfo;
    if (!info) continue;
    // Per-model quota has one reset window; it cannot supply a weekly allowance.
    quota[`${family}5h`] = `${fractionPercent(info.remainingFraction)}%`;
    quota[`${family}5hReset`] = info.resetTime || null;
  }
  return quota;
}

function modelEntries(payload) {
  const source = payload?.models || payload?.response?.models || payload?.data?.models || {};
  if (Array.isArray(source)) return source.map(model => [String(model?.id || model?.name || ''), model]).filter(([id]) => id);
  return Object.entries(source);
}

async function fetchAccountQuota({ fetch, accessToken, projectId, clientVersion, supplementalQuotaSummary }) {
  const normalizedVersion = /^\d+\.\d+\.\d+/.test(String(clientVersion || '')) ? String(clientVersion).match(/^\d+\.\d+\.\d+/)[0] : '2.26.0';
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'User-Agent': `antigravity/${normalizedVersion}` };
  const startedAt = Date.now();
  let lastError = 'No quota endpoint responded successfully';
  async function request(host, endpoint, body, cli = false) {
    const response = await fetch(`https://${host}/v1internal:${endpoint}`, {
      method: 'POST',
      headers: cli ? { ...headers, 'User-Agent': CLI_QUOTA_USER_AGENT } : headers,
      body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`${host}/${endpoint} returned HTTP ${response.status}`);
    return response.json();
  }
  // Cloud Code exposes the standalone Argon quota only to its CLI client
  // profile. All three read-only quota/model calls use an empty JSON object
  // under this profile. The desktop+project form remains a compatibility
  // fallback for providers that do not implement this profile.
  async function requestQuota(host, endpoint, project) {
    try {
      const result = await request(host, endpoint, {}, true);
      const usable = endpoint === 'retrieveUserQuotaSummary'
        ? Object.keys(parseQuotaSummary(result)).length > 0
        : endpoint === 'retrieveUserQuota'
          ? Object.keys(parseModelQuota(result)).length > 0 || modelEntries(result).length > 0
          : modelEntries(result).length > 0;
      if (usable) return { ...result, __agyQuotaClientProfile: 'cli' };
    } catch (_) { /* preserve existing project-scoped desktop fallback */ }
    return { ...(await request(host, endpoint, { project }, false)), __agyQuotaClientProfile: 'desktop' };
  }

  function mergeQuota(target, incoming, allowedFields = FIELDS) {
    for (const field of allowedFields) {
      if (target[field] !== undefined || incoming[field] === undefined) continue;
      target[field] = incoming[field];
      target[`${field}Reset`] = incoming[`${field}Reset`] || null;
    }
  }

  const count = quota => FIELDS.filter(field => quota[field] !== undefined).length;
  const localQuota = parseQuotaSummary(supplementalQuotaSummary);
  const hasLocalSummary = Array.isArray((supplementalQuotaSummary?.response || supplementalQuotaSummary)?.groups);

  async function queryProjects(projects) {
    const states = new Map(projects.map(project => [project, {
      quota: {}, projectId: project, quotaSourceHost: '', sourceScore: 0,
      summaryHosts: new Set(), quotaHosts: new Set(), modelHosts: new Set(),
      cliSummaryHosts: new Set(), cliQuotaHosts: new Set(), cliModelHosts: new Set(),
      argonModelFound: false, modelIds: new Set()
    }]));
    const jobs = [];
    for (const project of projects) {
      for (const host of QUOTA_HOSTS) {
        jobs.push({
          project, host, type: 'summary',
          promise: requestQuota(host, 'retrieveUserQuotaSummary', project)
        });
        jobs.push({
          project, host, type: 'quota',
          promise: requestQuota(host, 'retrieveUserQuota', project)
        });
        // Model quota is requested alongside the summary. Newer upstream versions can
        // omit Gemini summary buckets, so waiting for a serial fallback doubles latency.
        jobs.push({
          project, host, type: 'models',
          promise: requestQuota(host, 'fetchAvailableModels', project)
        });
      }
    }
    const settled = await Promise.allSettled(jobs.map(job => job.promise));
    settled.forEach((result, index) => {
      const job = jobs[index];
      const state = states.get(job.project);
      if (result.status === 'rejected') {
        lastError = result.reason?.message || String(result.reason);
        return;
      }
      if (job.type === 'summary') {
        state.summaryHosts.add(job.host);
        if (result.value.__agyQuotaClientProfile === 'cli') state.cliSummaryHosts.add(job.host);
        const quota = parseQuotaSummary(result.value);
        if (count(quota) > state.sourceScore) {
          state.quotaSourceHost = job.host;
          state.sourceScore = count(quota);
        }
        mergeQuota(state.quota, quota, [...FIELDS, ...OPTIONAL_FIELDS]);
        return;
      }
      if (job.type === 'quota') {
        state.quotaHosts.add(job.host);
        if (result.value.__agyQuotaClientProfile === 'cli') state.cliQuotaHosts.add(job.host);
      } else {
        state.modelHosts.add(job.host);
        if (result.value.__agyQuotaClientProfile === 'cli') state.cliModelHosts.add(job.host);
      }
      const entries = modelEntries(result.value);
      for (const [id] of entries) state.modelIds.add(id);
      if (entries.some(([id]) => ARGON_MODEL_ID.test(id))) state.argonModelFound = true;
      const quota = parseModelQuota(result.value);
      if (count(quota) > state.sourceScore) {
        state.quotaSourceHost = job.host;
        state.sourceScore = count(quota);
      }
      mergeQuota(state.quota, quota, [...SHORT_WINDOW_FIELDS, ...OPTIONAL_FIELDS]);
    });
    return [...states.values()];
  }

  // Resolve both hosts concurrently. A discovered project is authoritative; a saved
  // project is used only when discovery fails, and the virtual project is the last resort.
  const assistJobs = QUOTA_HOSTS.map(host => ({
    host,
    promise: request(host, 'loadCodeAssist', { metadata: { ideType: 'ANTIGRAVITY' } })
  }));
  const assistSettled = await Promise.allSettled(assistJobs.map(job => job.promise));
  const discoveredProjects = [];
  assistSettled.forEach(result => {
    if (result.status === 'rejected') {
      lastError = result.reason?.message || String(result.reason);
      return;
    }
    const project = result.value?.cloudaicompanionProject;
    const id = typeof project === 'string' ? project : project?.id;
    if (id) discoveredProjects.push(id);
  });
  const savedProject = typeof projectId === 'string' && projectId ? projectId : '';
  const projects = [...new Set(discoveredProjects.length ? discoveredProjects : [savedProject || 'gemini_virtual_primary'])];
  let candidates = await queryProjects(projects);
  let best = candidates.reduce((selected, candidate) => count(candidate.quota) > count(selected.quota) ? candidate : selected,
    { quota: {}, projectId: '', quotaSourceHost: '', sourceScore: 0, summaryHosts: new Set(), modelHosts: new Set() });

  // A virtual project is queried only when authoritative candidates yielded nothing.
  if (!count(best.quota) && !count(localQuota) && !projects.includes('gemini_virtual_primary')) {
    candidates = await queryProjects(['gemini_virtual_primary']);
    best = candidates[0];
  }
  if (!count(best.quota) && !count(localQuota)) throw new Error(`Quota unavailable: ${lastError}`);

  // The local language service belongs ONLY to the active account. Prefer all its
  // explicitly returned buckets; OAuth-scoped Cloud Code fills missing values.
  // A broken cloud response must never invalidate complete local data.
  const cloudQuota = { ...best.quota };
  // The two Cloud Code hosts may discover different project ids. For the same
  // OAuth account, retain a verified Argon bucket from either host/project.
  if (cloudQuota.argonWeekly === undefined) {
    const argonCandidate = candidates.find(candidate => candidate.quota.argonWeekly !== undefined);
    if (argonCandidate) {
      cloudQuota.argonWeekly = argonCandidate.quota.argonWeekly;
      cloudQuota.argonWeeklyReset = argonCandidate.quota.argonWeeklyReset || null;
    }
  }
  best.quota = { ...localQuota };
  // A local Language Server snapshot is not a live Cloud Code result. Keep
  // ordinary local quota as fallback, but never label a cached Argon value
  // as the current cloud quota.
  delete best.quota.argonWeekly;
  delete best.quota.argonWeeklyReset;
  mergeQuota(best.quota, cloudQuota, [...FIELDS, ...OPTIONAL_FIELDS]);
  const argonVerified = cloudQuota.argonWeekly !== undefined || candidates.some(candidate => candidate.argonModelFound);
  const argonCloudConfirmedAbsent = candidates.length > 0 && candidates.every(candidate =>
    candidate.cliSummaryHosts.size === QUOTA_HOSTS.length
      && candidate.cliQuotaHosts.size === QUOTA_HOSTS.length
      && candidate.cliModelHosts.size === QUOTA_HOSTS.length
      && !candidate.argonModelFound
      && candidate.quota.argonWeekly === undefined
  );
  const argonCapabilityStatus = argonVerified ? 'available' : argonCloudConfirmedAbsent ? 'unavailable' : 'unconfirmed';

  const missingQuotaFields = FIELDS.filter(field => best.quota[field] === undefined);
  const allHostsResponded = hosts => hosts.size === QUOTA_HOSTS.length;
  const candidateEvidence = candidates.length ? candidates : [best];
  const confirmedMissingQuotaFields = missingQuotaFields.filter(field => !hasLocalSummary && candidateEvidence.every(candidate => {
    if (WEEKLY_FIELDS.includes(field)) return allHostsResponded(candidate.summaryHosts);
    return allHostsResponded(candidate.summaryHosts)
      && allHostsResponded(candidate.quotaHosts)
      && allHostsResponded(candidate.modelHosts);
  }));
  const unconfirmedQuotaFields = missingQuotaFields.filter(field => !confirmedMissingQuotaFields.includes(field));
  for (const field of missingQuotaFields) {
    best.quota[field] = '--';
    best.quota[`${field}Reset`] = null;
  }
  return {
    success: true,
    quota: best.quota,
    projectId: best.projectId,
    quotaSourceHost: best.quotaSourceHost,
    partial: missingQuotaFields.length > 0,
    missingQuotaFields,
    confirmedMissingQuotaFields,
    unconfirmedQuotaFields,
    capabilities: { argon: argonVerified },
    availableModels: [...new Set(candidates.flatMap(candidate => [...(candidate.modelIds || [])]))],
    availableModelsSource: 'oauth-cloud',
    argonQuotaSource: cloudQuota.argonWeekly !== undefined ? 'cloud-code' : null,
    argonCapabilityStatus,
    quotaSource: count(localQuota) ? 'local-language-service' : 'cloud-code',
    optionalQuotaFields: best.quota.argonWeekly !== undefined ? ['argonWeekly'] : [],
    quotaResponseTimeMs: Date.now() - startedAt
  };
}

module.exports = { fetchAccountQuota, parseQuotaSummary, parseModelQuota, modelEntries };
