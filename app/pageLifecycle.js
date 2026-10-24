(function exposePageLifecycle(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyPageLifecycle = api;
})(typeof window !== 'undefined' ? window : globalThis, function createPageLifecycle() {
  const tasks = new Map();
  function once(key, task) {
    if (tasks.has(key)) return tasks.get(key);
    const promise = Promise.resolve().then(task).catch(error => { tasks.delete(key); throw error; });
    tasks.set(key, promise);
    return promise;
  }
  function reset(key) { tasks.delete(key); }
  function has(key) { return tasks.has(key); }
  return { once, reset, has };
});
