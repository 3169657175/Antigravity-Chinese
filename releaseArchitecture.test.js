const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const packageJson = require('./package.json');
const release = require('./releaseConfig.js');
const flags = require('./featureFlags.js');
const communityState = require('./communityState.js');
const lifecycle = require('./pageLifecycle.js');

test('1.3.5 release identity and updater repository cannot drift', () => {
  assert.equal(packageJson.version, '1.3.5');
  assert.deepEqual(packageJson.build.publish[0], { provider: 'github', owner: release.RELEASE_REPOSITORY.owner, repo: release.RELEASE_REPOSITORY.repo });
  assert.equal(release.RELEASE_REPOSITORY.repo, 'Antigravity-Chinese');
  assert.deepEqual(release.releaseTagCandidates('v1.3.5'), ['1.3.5', 'v1.3.5']);
  const updater = fs.readFileSync('updaterService.js', 'utf8');
  assert.match(updater, /disableDifferentialDownload = true/);
  assert.match(updater, /releaseTagCandidates/);
  assert.doesNotMatch(updater, /repo:\s*['"]any-sub['"]/);
});

test('Claude Code implementation stays packaged while its UI is feature-gated off', () => {
  assert.equal(flags.enabled('claudeCodeGateway'), false);
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /data-codex-page="claude"[^>]*data-feature="claudeCodeGateway"/);
  for (const file of ['anthropicGateway.js', 'claudeDesktopConfig.js', 'claudeDesktopLifecycle.js', 'claudeModelRoutes.js']) {
    assert.ok(packageJson.build.files.includes(file), file);
  }
});

test('community state supports optimistic feedback and reply rollback', () => {
  communityState.setAll([{ id: 1, content: 'a', replies: [{ id: 9, content: 'r', likes_count: 0 }] }]);
  const snapshot = communityState.snapshot();
  communityState.upsert({ id: 'pending-1', content: 'new', replies: [], pending: true });
  communityState.addReply(1, { id: 'pending-r', content: 'new reply', pending: true });
  communityState.updateReply(1, 9, { likes_count: 1, has_liked: true });
  assert.equal(communityState.all()[0].id, 'pending-1');
  assert.equal(communityState.all().find(x => x.id === 1).replies.length, 2);
  communityState.restore(snapshot);
  assert.equal(communityState.all().length, 1);
  assert.equal(communityState.all()[0].replies.length, 1);
});

test('page lifecycle runs expensive page initialization only once until reset', async () => {
  lifecycle.reset('x');
  let count = 0;
  await Promise.all([lifecycle.once('x', async () => ++count), lifecycle.once('x', async () => ++count)]);
  assert.equal(count, 1);
  lifecycle.reset('x');
  await lifecycle.once('x', async () => ++count);
  assert.equal(count, 2);
});

test('renderer defers community, gateway and marketplace work until navigation', () => {
  const renderer = fs.readFileSync('renderer.js', 'utf8');
  assert.match(renderer, /targetId === 'tab-feedback'[\s\S]*ensureCommunityLoaded/);
  assert.match(renderer, /pageLifecycle\.once\('codex-page'/);
  assert.match(renderer, /pageLifecycle\.once\('marketplace-page'/);
  assert.doesNotMatch(renderer, /DOMContentLoaded'[\s\S]{0,300}initCodexGateway\(\)/);
});
