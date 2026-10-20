const path = require('path');
const { readJsonSafe, writeJsonAtomic } = require('./fsUtils.js');

class GatewayConfigStore {
  constructor(stateDir, options = {}) {
    this.configPath = path.join(stateDir, 'codex-gateway.json');
    this.toolCachePath = path.join(stateDir, 'codex-tool-calls.json');
    this.secretCodec = options.secretCodec || null;
  }

  readConfig() {
    const config = readJsonSafe(this.configPath, {}, { preserveCorrupted: true });
    const custom = config?.profiles?.['codex-custom'];
    if (custom?.apiKey && this.secretCodec) custom.apiKey = this.secretCodec.decrypt(custom.apiKey);
    if (config.customApiKey && this.secretCodec) config.customApiKey = this.secretCodec.decrypt(config.customApiKey);
    return config;
  }

  writeConfig(config) {
    const stored = JSON.parse(JSON.stringify(config));
    const custom = stored?.profiles?.['codex-custom'];
    if (custom?.apiKey && this.secretCodec) custom.apiKey = this.secretCodec.encrypt(custom.apiKey);
    if (stored.customApiKey && this.secretCodec) stored.customApiKey = this.secretCodec.encrypt(stored.customApiKey);
    writeJsonAtomic(this.configPath, stored);
  }

  readToolCalls() {
    const entries = readJsonSafe(this.toolCachePath, [], { preserveCorrupted: true });
    return Array.isArray(entries) ? entries : [];
  }

  writeToolCalls(entries) {
    writeJsonAtomic(this.toolCachePath, Array.isArray(entries) ? entries : []);
  }
}

module.exports = { GatewayConfigStore };
