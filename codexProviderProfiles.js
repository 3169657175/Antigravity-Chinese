const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createSecretCodec } = require('./secretCodec.js');

const PROFILE_FILE = 'codex-provider-profiles.json';

function profilePath(userDataDir) {
  return path.join(userDataDir, PROFILE_FILE);
}

function readProfiles(userDataDir, options = {}) {
  try {
    const parsed = JSON.parse(fs.readFileSync(profilePath(userDataDir), 'utf8'));
    const codec = options.secretCodec || createSecretCodec(options.safeStorage);
    return (Array.isArray(parsed.profiles) ? parsed.profiles : []).map(profile => {
      const storedKey = profile.apiKeyEncrypted || profile.apiKey || '';
      const plain = storedKey ? codec.decrypt(storedKey) : '';
      const migrated = { ...profile, apiKeyEncrypted: profile.apiKeyEncrypted || codec.encrypt(plain) };
      return options.revealSecrets
        ? { ...migrated, apiKey: plain }
        : { ...migrated, apiKey: '', keySaved: Boolean(plain), keyTail: plain ? plain.slice(-4) : '' };
    });
  } catch (_) {
    return [];
  }
}

function writeProfiles(userDataDir, profiles) {
  fs.mkdirSync(userDataDir, { recursive: true });
  const target = profilePath(userDataDir);
  const temporary = `${target}.tmp`;
  const sanitized = profiles.map(({ apiKey, ...profile }) => profile);
  fs.writeFileSync(temporary, `${JSON.stringify({ version: 2, profiles: sanitized }, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
}

function saveProfile(userDataDir, settings, options = {}) {
  const codec = options.secretCodec || createSecretCodec(options.safeStorage);
  const profiles = readProfiles(userDataDir, { ...options, secretCodec: codec, revealSecrets: true });
  const now = new Date().toISOString();
  const id = String(settings.id || '').trim() || crypto.randomUUID();
  const existing = profiles.find(item => item.id === id);
  const profile = {
    id,
    providerName: settings.providerName,
    protocol: settings.protocol,
    baseUrl: settings.baseUrl,
    apiKeyEncrypted: codec.encrypt(settings.apiKey || existing?.apiKey || ''),
    authMode: settings.authMode || 'bearer',
    authQueryName: settings.authQueryName || 'key',
    customHeaders: settings.customHeaders || {},
    fallbackBaseUrls: Array.isArray(settings.fallbackBaseUrls) ? settings.fallbackBaseUrls : [],
    modelMode: settings.modelMode,
    models: settings.models,
    model: settings.model,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
  const next = profiles.filter(item => item.id !== id);
  next.unshift(profile);
  writeProfiles(userDataDir, next);
  return { ...profile, apiKey: '', keySaved: Boolean(settings.apiKey || existing?.apiKey), keyTail: String(settings.apiKey || existing?.apiKey || '').slice(-4) };
}

function deleteProfile(userDataDir, id, options = {}) {
  const profiles = readProfiles(userDataDir, { ...options, revealSecrets: true });
  const next = profiles.filter(item => item.id !== id);
  if (next.length === profiles.length) throw new Error('Provider 配置不存在');
  writeProfiles(userDataDir, next);
  return true;
}

module.exports = { PROFILE_FILE, profilePath, readProfiles, saveProfile, deleteProfile };
