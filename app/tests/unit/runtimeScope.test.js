const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('theme IPC owns its Node crypto dependency', () => {
  const source = fs.readFileSync('themeIpc.js', 'utf8');
  assert.match(source, /const crypto = require\(['"]crypto['"]\);/);
  assert.match(source, /crypto\.createHash\(/);
  assert.match(source, /crypto\.randomBytes\(/);
});

test('community auth and feedback handlers are owned by the dedicated main-process boundary', () => {
  const main = fs.readFileSync('main.js', 'utf8');
  const ipc = fs.readFileSync('communityIpc.js', 'utf8');
  const client = fs.readFileSync('communityClient.js', 'utf8');
  assert.match(main, /registerCommunityIpc\(\{ ipcMain, client: communityClient, shell \}\)/);
  assert.doesNotMatch(main, /ipcMain\.handle\('auth-login'/);
  assert.match(ipc, /ipcMain\.handle\('auth-login'/);
  assert.match(ipc, /ipcMain\.handle\('fetch-feedbacks'/);
  assert.match(ipc, /ipcMain\.handle\('fetch-announcements'/);
  assert.match(client, /headers\.Authorization = `Bearer \$\{session\.token\}`/);
});

test('global announcements start at application launch and are not coupled to feedback navigation', () => {
  const renderer = fs.readFileSync('renderer.js', 'utf8');
  const preload = fs.readFileSync('preload.js', 'utf8');
  const ensureCommunity = renderer.slice(renderer.indexOf('async function ensureCommunityLoaded'), renderer.indexOf('function scheduleAfterPaint'));
  const startup = renderer.slice(renderer.indexOf("document.addEventListener('DOMContentLoaded'"), renderer.indexOf('async function initMarketplace'));
  assert.doesNotMatch(ensureCommunity, /loadAnnouncementSystemDesktop/);
  assert.match(startup, /bootstrapAnnouncementSystemDesktop\(\)/);
  assert.match(renderer, /shown_announcement_id_desktop/);
  assert.match(renderer, /preferCache: true/);
  assert.match(preload, /fetchAnnouncements: options => ipcRenderer\.invoke\('fetch-announcements'/);
});

test('account IPC no longer owns unrelated community globals', () => {
  const source = fs.readFileSync('accountIpc.js', 'utf8');
  assert.doesNotMatch(source, /\bAPI_BASE\b/);
  assert.doesNotMatch(source, /\bauthFilePath\b/);
});
