const RELEASE_REPOSITORY = Object.freeze({ owner: '3169657175', repo: 'Antigravity-Chinese' });

function cleanVersion(value) {
  return String(value || '').trim().replace(/^v/i, '');
}

function releaseTagCandidates(value) {
  const version = cleanVersion(value);
  if (!version) return [];
  return [version, `v${version}`];
}

function releaseUrl(tag) {
  return `https://github.com/${RELEASE_REPOSITORY.owner}/${RELEASE_REPOSITORY.repo}/releases/tag/${encodeURIComponent(String(tag || ''))}`;
}

module.exports = { RELEASE_REPOSITORY, cleanVersion, releaseTagCandidates, releaseUrl };
