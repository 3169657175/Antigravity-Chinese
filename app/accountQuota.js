// Shared by AGY Hub and the Antigravity account-dialog patch. Never writes account state.
const QUOTA_HOSTS = ['daily-cloudcode-pa.googleapis.com', 'cloudcode-pa.googleapis.com'];
const BUCKET_FIELDS = Object.freeze({
  'gemini-5h': 'gemini5h',
  'gemini-weekly': 'geminiWeekly',
  '3p-5h': 'claude5h',
  '3p-weekly': 'claudeWeekly'
});
const FIELDS = Object.values(BUCKET_FIELDS);

function fractionPercent(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function parseQuotaSummary(payload) {
  const quota = {};
  for (const group of payload?.groups || []) {
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

async function fetchAccountQuota({ fetch, accessToken, projectId }) {
  const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'User-Agent': 'Antigravity-Quota-Watcher' };
  let lastError = 'No quota endpoint responded successfully';
  async function request(host, endpoint, body) {
    const response = await fetch(`https://${host}/v1internal:${endpoint}`, {
      method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`${host}/${endpoint} returned HTTP ${response.status}`);
    return response.json();
  }

  const projects = [];
  for (const host of QUOTA_HOSTS) {
    try {
      const data = await request(host, 'loadCodeAssist', { metadata: { ideType: 'ANTIGRAVITY' } });
      const project = data.cloudaicompanionProject;
      const id = typeof project === 'string' ? project : project?.id;
      if (id) { projects.push(id); break; }
    } catch (error) { lastError = error.message; }
  }
  if (typeof projectId === 'string' && projectId) projects.push(projectId);
  // A virtual project is a last resort; HTTP 200 alone does not mean quota is complete.
  projects.push('gemini_virtual_primary');
  let best = { quota: {}, projectId: '', quotaSourceHost: '' };
  const count = quota => FIELDS.filter(field => quota[field] !== undefined).length;
  for (const project of new Set(projects)) {
    for (const host of QUOTA_HOSTS) {
      try {
        const quota = parseQuotaSummary(await request(host, 'retrieveUserQuotaSummary', { project }));
        if (count(quota) > count(best.quota)) best = { quota, projectId: project, quotaSourceHost: host };
        if (count(quota) === FIELDS.length) return { success: true, ...best, partial: false, missingQuotaFields: [] };
      } catch (error) { lastError = error.message; }
    }
  }
  // Preserve real summary buckets. Fall back to current model ids only for absent short windows.
  for (const project of new Set(projects)) {
    if (best.quota.gemini5h !== undefined && best.quota.claude5h !== undefined) break;
    for (const host of QUOTA_HOSTS) {
      try {
        const quota = parseModelQuota(await request(host, 'fetchAvailableModels', { project }));
        for (const field of ['gemini5h', 'claude5h']) {
          if (best.quota[field] !== undefined || quota[field] === undefined) continue;
          best.quota[field] = quota[field];
          best.quota[`${field}Reset`] = quota[`${field}Reset`];
          if (!best.quotaSourceHost) Object.assign(best, { projectId: project, quotaSourceHost: host });
        }
        if (best.quota.gemini5h !== undefined && best.quota.claude5h !== undefined) break;
      } catch (error) { lastError = error.message; }
    }
  }
  if (!count(best.quota)) throw new Error(`Quota unavailable: ${lastError}`);
  const missingQuotaFields = FIELDS.filter(field => best.quota[field] === undefined);
  for (const field of missingQuotaFields) {
    best.quota[field] = '--';
    best.quota[`${field}Reset`] = null;
  }
  return { success: true, ...best, partial: missingQuotaFields.length > 0, missingQuotaFields };
}

module.exports = { fetchAccountQuota, parseQuotaSummary, parseModelQuota };
