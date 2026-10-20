const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

test('theme IPC owns its Node crypto dependency', () => {
  const source = fs.readFileSync('src/themeIpc.js', 'utf8');
  assert.match(source, /const crypto = require\(['"]crypto['"]\);/);
  assert.match(source, /crypto\.createHash\(/);
  assert.match(source, /crypto\.randomBytes\(/);
});

test('community auth and feedback handlers are owned by the dedicated main-process boundary', () => {
  const main = fs.readFileSync('main.js', 'utf8');
  const ipc = fs.readFileSync('src/communityIpc.js', 'utf8');
  const client = fs.readFileSync('src/communityClient.js', 'utf8');
  assert.match(main, /registerCommunityIpc\(\{ ipcMain, client: communityClient, shell \}\)/);
  assert.doesNotMatch(main, /ipcMain\.handle\('auth-login'/);
  assert.match(ipc, /ipcMain\.handle\('auth-login'/);
  assert.match(ipc, /ipcMain\.handle\('fetch-feedbacks'/);
  assert.match(client, /headers\.Authorization = `Bearer \$\{session\.token\}`/);
});

test('account IPC no longer owns unrelated community globals', () => {
  const source = fs.readFileSync('src/accountIpc.js', 'utf8');
  assert.doesNotMatch(source, /\bAPI_BASE\b/);
  assert.doesNotMatch(source, /\bauthFilePath\b/);
});
