function decodeHtmlEntities(value) {
  const named = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
  };
  return String(value || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity) => {
    const key = entity.toLowerCase();
    if (key.startsWith('#x')) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith('#')) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
    return named[key] ?? match;
  });
}

function htmlToPlainText(value) {
  return decodeHtmlEntities(value)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*li(?:\s[^>]*)?>/gi, '• ')
    .replace(/<\s*\/\s*(?:p|div|li|h[1-6]|ul|ol|section|article)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeReleaseNotes(releaseNotes) {
  if (typeof releaseNotes === 'string') return htmlToPlainText(releaseNotes);
  if (Array.isArray(releaseNotes)) {
    return releaseNotes
      .map(item => typeof item === 'string' ? item : item && item.note)
      .map(htmlToPlainText)
      .filter(Boolean)
      .join('\n\n')
      .trim();
  }
  return '';
}

function compareVersions(left, right) {
  const parse = value => String(value || '')
    .trim()
    .replace(/^v/i, '')
    .split(/[.+-]/, 3)
    .map(part => Number.parseInt(part, 10) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  const length = Math.max(leftParts.length, rightParts.length, 3);
  for (let index = 0; index < length; index += 1) {
    const delta = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

function isVersionNewer(candidate, current) {
  return compareVersions(candidate, current) > 0;
}

module.exports = {
  decodeHtmlEntities,
  htmlToPlainText,
  normalizeReleaseNotes,
  compareVersions,
  isVersionNewer
};
