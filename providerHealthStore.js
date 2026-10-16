const path = require('path');
const { readJsonSafe, writeJsonAtomic } = require('./fsUtils.js');

class ProviderHealthStore {
  constructor(userDataDir) { this.filePath = path.join(userDataDir, 'provider-health.json'); }
  read() { const value = readJsonSafe(this.filePath, {}, { preserveCorrupted: true }); return value && typeof value === 'object' ? value : {}; }
  record(id, result = {}) {
    if (!id) return null;
    const all = this.read();
    const steps = Array.isArray(result.report?.steps) ? result.report.steps : [];
    all[id] = { status: result.success ? 'healthy' : 'unhealthy', checkedAt: new Date().toISOString(), levelReached: Number(result.report?.levelReached) || 0, latencyMs: Number(result.report?.durationMs) || 0, summary: result.report?.summary || result.error || '', steps: steps.map(step => ({ id: step.id, status: step.status, durationMs: step.durationMs })) };
    writeJsonAtomic(this.filePath, all);
    return all[id];
  }
}

module.exports = { ProviderHealthStore };
