const test = require('node:test');
const assert = require('node:assert/strict');
const { restartAntigravityClient } = require('../../accountIpc');

test('desktop switch immediately force-restarts the verified main PID with original arguments', async () => {
  const executable = 'C:\\Program Files\\Antigravity\\Antigravity.exe';
  const calls = [];
  let launched = null;
  const result = await restartAntigravityClient({
    platform: 'win32',
    fsModule: { existsSync: value => value === executable },
    sleep: async () => {},
    run: async (file, args) => {
      calls.push([file, args]);
      if (file === 'powershell.exe') {
        return { stdout: JSON.stringify({ running: true, pid: 4321, executable, argv: [executable, '--user-data-dir=profile-a', '--flag'] }) };
      }
      if (file === 'tasklist.exe') return { stdout: 'INFO: No tasks are running which match the specified criteria.' };
      return { stdout: '' };
    },
    launchDetached: async (file, args) => { launched = { file, args }; }
  });
  assert.deepEqual(calls.filter(([file]) => file === 'taskkill.exe'), [
    ['taskkill.exe', ['/PID', '4321', '/T', '/F']]
  ]);
  assert.deepEqual(launched, { file: executable, args: ['--user-data-dir=profile-a', '--flag'] });
  assert.equal(result.restarted, true);
  assert.equal(result.forcedTermination, true);
});
