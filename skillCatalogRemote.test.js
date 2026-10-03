const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { normalizeRemotePath, fetchSkillCatalogJson, fetchSkillText } = require('./skillCatalogRemote');

test('skill catalog remote source fails over from GitHub Raw to jsDelivr', async () => {
  const calls = [];
  const sources = [
    { id: 'raw', label: 'Raw', baseUrl: 'https://raw.example/repo' },
    { id: 'cdn', label: 'CDN', baseUrl: 'https://cdn.example/repo' }
  ];
  const fetchImpl = async url => {
    calls.push(String(url));
    if (calls.length === 1) return new Response('down', { status: 503 });
    return new Response(JSON.stringify([{ id: 'skill-a', path: 'skills/skill-a' }]), { status: 200 });
  };
  const result = await fetchSkillCatalogJson('skills_index.json', { fetchImpl, sources, timeoutMs: 1000 });
  assert.equal(result.source.id, 'cdn');
  assert.equal(result.data[0].id, 'skill-a');
  assert.equal(calls.length, 2);
});

test('skill remote source validates paths and supports text downloads', async () => {
  assert.throws(() => normalizeRemotePath('../secret'), /路径无效/);
  const result = await fetchSkillText('skills/demo/SKILL.md', {
    fetchImpl: async () => new Response('---\ndescription: demo\n---\n', { status: 200 }),
    sources: [{ id: 'one', label: 'One', baseUrl: 'https://example.test' }]
  });
  assert.match(result.data, /description: demo/);
});

test('skill remote source can fall through to a third source', async () => {
  const calls = [];
  const sources = [
    { id: 'raw', label: 'Raw', baseUrl: 'https://raw.example/repo' },
    { id: 'cdn', label: 'CDN', baseUrl: 'https://cdn.example/repo' },
    { id: 'api', label: 'API', baseUrl: 'https://api.example/repo', headers: { Accept: 'application/vnd.github.raw+json' } }
  ];
  const result = await fetchSkillText('skills/demo/SKILL.md', {
    sources,
    timeoutMs: 1000,
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), accept: options.headers.Accept || '' });
      if (calls.length < 3) return new Response('down', { status: 503 });
      return new Response('---\ndescription: api fallback\n---\n', { status: 200 });
    }
  });
  assert.equal(result.source.id, 'api');
  assert.equal(calls.length, 3);
  assert.equal(calls[2].accept, 'application/vnd.github.raw+json');
});

test('main process no longer references an undefined SKILL_CATALOG_BASE', () => {
  const source = fs.readFileSync('main.js', 'utf8');
  assert.doesNotMatch(source, /SKILL_CATALOG_BASE/);
  assert.match(source, /fetchSkillCatalogJson/);
  assert.match(source, /fetchSkillText/);
});
