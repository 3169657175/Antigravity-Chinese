const COMMUNITY_ORIGIN = 'https://nhw1029.pages.dev';

function parseAllowedHttpUrl(value, options = {}) {
  try {
    const url = new URL(String(value || ''));
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (options.httpsOnly && url.protocol !== 'https:') return null;
    if (Array.isArray(options.origins) && options.origins.length && !options.origins.includes(url.origin)) return null;
    return url;
  } catch (_) {
    return null;
  }
}

function safeExternalUrl(value) {
  return parseAllowedHttpUrl(value)?.toString() || '';
}

function safeRemoteImageUrl(value) {
  const text = String(value || '').trim();
  if (/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(text)) return text;
  return parseAllowedHttpUrl(text, { httpsOnly: true })?.toString() || '';
}

module.exports = { COMMUNITY_ORIGIN, parseAllowedHttpUrl, safeExternalUrl, safeRemoteImageUrl };
