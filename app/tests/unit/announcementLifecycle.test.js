const test = require('node:test');
const assert = require('node:assert/strict');
const { registerCommunityIpc } = require('../../communityIpc');

function registerWith(client) {
  const handlers = new Map();
  registerCommunityIpc({
    ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    client,
    shell: {},
    registerLegacy: false,
    registerExternal: false
  });
  return handlers;
}

test('announcement startup returns the persistent cache without waiting for the network', async () => {
  let networkCalls = 0;
  const handlers = registerWith({
    readCache: key => key === 'announcements:all' ? { savedAt: 7, data: [{ id: 1, content: 'cached' }] } : null,
    request: async () => { networkCalls += 1; throw new Error('network must not run for cache-first paint'); }
  });
  const result = await handlers.get('fetch-announcements')(null, { preferCache: true });
  assert.equal(result.success, true);
  assert.equal(result.fromCache, true);
  assert.deepEqual(result.data, [{ id: 1, content: 'cached' }]);
  assert.equal(networkCalls, 0);
});

test('live announcement refresh uses the dedicated persistent cache key', async () => {
  const calls = [];
  const handlers = registerWith({
    readCache: () => null,
    request: async (resource, options) => {
      calls.push({ resource, options });
      return { success: true, data: [{ id: 2, content: 'live' }], fromCache: false };
    }
  });
  const result = await handlers.get('fetch-announcements')(null, { preferCache: false });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, [{ id: 2, content: 'live' }]);
  assert.equal(calls[0].resource, '/api/announcement?all=true');
  assert.equal(calls[0].options.cacheKey, 'announcements:all');
});
