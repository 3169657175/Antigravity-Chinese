const test = require('node:test');
const assert = require('node:assert/strict');
const diagnostics = require('../src/errorDiagnostics.js');

test('diagnostics classify auth, network, rate and server errors with actionable copy', () => {
  assert.equal(diagnostics.classify({ code: 'AUTH_EXPIRED' }).category, 'auth');
  assert.equal(diagnostics.classify({ code: 'TIMEOUT' }).category, 'network');
  assert.equal(diagnostics.classify({ code: 'RATE_LIMITED' }).category, 'rate-limit');
  assert.equal(diagnostics.classify({ code: 'SERVER_UNAVAILABLE' }).category, 'server');
  assert.match(diagnostics.format({ code: 'NETWORK_ERROR', message: '无法连接' }), /重试/);
});
