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
  const models = Object.entries(payload?.models || {});
  const quota = {};
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

async function fetchAccountQuota({ fetch, accessToken, projectId, clientVersion, supplementalQuotaSummary }) {
  const normalizedVersion = /^\d+\.\d+\.\d+/.test(String(clientVersion || '')) ? String(clientVersion).match(/^\d+\.\d+\.\d+/)[0] : '2.26.0';
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'User-Agent': `antigravity/${normalizedVersion}` };
  const startedAt = Date.now();
  let lastError = 'No quota endpoint responded successfully';
  async function request(host, endpoint, body) {
    const response = await fetch(`https://${host}/v1internal:${endpoint}`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`${host}/${endpoint} returned HTTP ${response.status}`);
    return response.json();
  }

  function mergeQuota(target, incoming, allowedFields = FIELDS) {
    for (const field of allowedFields) {
      if (target[field] !== undefined || incoming[field] === undefined) continue;
      target[field] = incoming[field];
      target[`${field}Reset`] = incoming[`${field}Reset`] || null;
    }
  }

  const count = quota => FIELDS.filter(field => quota[field] !== undefined).length;

  async function queryProjects(projects) {
    const states = new Map(projects.map(project => [project, {
      quota: {}, projectId: project, quotaSourceHost: '', sourceScore: 0, summaryHosts: new Set(), modelHosts: new Set()
    }]));
    const jobs = [];
    for (const project of projects) {
      for (const host of QUOTA_HOSTS) {
        jobs.push({
          project, host, type: 'summary',
          promise: request(host, 'retrieveUserQuotaSummary', { project })
        });
        // Model quota is requested alongside the summary. Newer upstream versions can
        // omit Gemini summary buckets, so waiting for a serial fallback doubles latency.
        jobs.push({
          project, host, type: 'models',
          promise: request(host, 'fetchAvailableModels', { project })
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
        const quota = parseQuotaSummary(result.value);
        if (count(quota) > state.sourceScore) {
          state.quotaSourceHost = job.host;
          state.sourceScore = count(quota);
        }
        mergeQuota(state.quota, quota);
        return;
      }
      state.modelHosts.add(job.host);
      const quota = parseModelQuota(result.value);
      if (count(quota) > state.sourceScore) {
        state.quotaSourceHost = job.host;
        state.sourceScore = count(quota);
      }
      mergeQuota(state.quota, quota, SHORT_WINDOW_FIELDS);
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
  if (!count(best.quota) && !projects.includes('gemini_virtual_primary')) {
    candidates = await queryProjects(['gemini_virtual_primary']);
    best = candidates[0];
  }
  if (!count(best.quota)) throw new Error(`Quota unavailable: ${lastError}`);

  // The public Cloud Code endpoint currently omits capability-specific quota groups
  // such as Argon. The running Antigravity language service is authoritative for the
  // active account, so merge only explicitly returned optional buckets.
  mergeQuota(best.quota, parseQuotaSummary(supplementalQuotaSummary), OPTIONAL_FIELDS);

  const missingQuotaFields = FIELDS.filter(field => best.quota[field] === undefined);
  const allHostsResponded = hosts => hosts.size === QUOTA_HOSTS.length;
  const candidateEvidence = candidates.length ? candidates : [best];
  const confirmedMissingQuotaFields = missingQuotaFields.filter(field => candidateEvidence.every(candidate => {
    if (WEEKLY_FIELDS.includes(field)) return allHostsResponded(candidate.summaryHosts);
    return allHostsResponded(candidate.summaryHosts) && allHostsResponded(candidate.modelHosts);
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
    capabilities: { argon: best.quota.argonWeekly !== undefined },
    optionalQuotaFields: best.quota.argonWeekly !== undefined ? ['argonWeekly'] : [],
    quotaResponseTimeMs: Date.now() - startedAt
  };
}

module.exports = { fetchAccountQuota, parseQuotaSummary, parseModelQuota };
