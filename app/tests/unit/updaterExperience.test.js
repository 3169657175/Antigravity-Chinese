const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  DOWNLOAD_MAX_ATTEMPTS,
  isRetryableDownloadError,
  downloadUpdateWithRetry
} = require('../../updaterService');
const { renderReleaseNotesMarkdown } = require('../../appShellController');

test('updater prefers differential downloads and retains the full-installer fallback', () => {
  const source = fs.readFileSync('updaterService.js', 'utf8');
  assert.match(source, /disableDifferentialDownload = false/);
  assert.match(source, /downloadMode: 'adaptive'/);
  assert.equal(DOWNLOAD_MAX_ATTEMPTS, 3);
});

test('transient connection closures retry with bounded delays', async () => {
  let calls = 0;
  const retries = [];
  const sleeps = [];
  const result = await downloadUpdateWithRetry({
    download: async () => {
      calls += 1;
      if (calls < 3) throw new Error('net::ERR_CONNECTION_CLOSED');
      return ['installer.exe'];
    },
    onRetry: event => retries.push(event),
    sleep: async delay => sleeps.push(delay)
  });
  assert.equal(calls, 3);
  assert.deepEqual(sleeps, [800, 2000]);
  assert.deepEqual(retries.map(item => item.attempt), [2, 3]);
  assert.deepEqual(result, { files: ['installer.exe'], attempts: 3 });
});

test('integrity failures are never hidden behind network retries', async () => {
  let calls = 0;
  await assert.rejects(downloadUpdateWithRetry({
    download: async () => {
      calls += 1;
      throw new Error('sha512 checksum mismatch');
    },
    sleep: async () => {}
  }), /checksum mismatch/);
  assert.equal(calls, 1);
  assert.equal(isRetryableDownloadError(new Error('net::ERR_CONNECTION_CLOSED')), true);
  assert.equal(isRetryableDownloadError(new Error('sha512 checksum mismatch')), false);
});

test('release Markdown is formatted while untrusted HTML remains inert', () => {
  const html = renderReleaseNotesMarkdown([
    '> 发布日期：2026-10-24',
    '',
    '## ✨ 核心更新',
    '### 1. Gemini 4 Argon 独立额度',
    '- 支持 **纯云端查询**',
    '- 识别 `gemini-argon-wtu-weekly`',
    '<img src=x onerror=alert(1)>'
  ].join('\n'));
  assert.match(html, /<blockquote>发布日期：2026-10-24<\/blockquote>/);
  assert.match(html, /<h3>✨ 核心更新<\/h3>/);
  assert.match(html, /<h4>1\. Gemini 4 Argon 独立额度<\/h4>/);
  assert.match(html, /<strong>纯云端查询<\/strong>/);
  assert.match(html, /<code>gemini-argon-wtu-weekly<\/code>/);
  assert.doesNotMatch(html, /<img\s/i);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});
