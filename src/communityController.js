(function exposeCommunityController(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyCommunityController = api;
})(typeof window !== 'undefined' ? window : globalThis, function createCommunityController() {
  async function request(resource, options = {}) {
    const body = typeof options.body === 'string' ? (() => { try { return JSON.parse(options.body); } catch (_) { return options.body; } })() : options.body;
    const result = await window.agyHubAPI.communityRequest(resource, { method: options.method, body, cache: options.cache });
    return {
      ok: Boolean(result.ok),
      status: Number(result.status) || 0,
      json: async () => result.data || {},
      text: async () => JSON.stringify(result.data || {}),
      error: result.message || '',
      code: result.code || ''
    };
  }
  return { request };
});
