const test = require('node:test');
const assert = require('node:assert/strict');
const { canRetryGeneration, retryDiagnostic } = require('./retryPolicy');

test('only pre-acceptance connection establishment failures are retried', () => {
  assert.equal(canRetryGeneration({ error: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }) }), true);
  assert.equal(canRetryGeneration({ error: Object.assign(new Error('reset'), { code: 'ECONNRESET' }) }), false);
  assert.equal(canRetryGeneration({ responseStatus: 502 }), false);
  assert.equal(canRetryGeneration({ error: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }), responseHeadersReceived: true }), false);
  assert.equal(canRetryGeneration({ error: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }), outputStarted: true }), false);
});

test('retry diagnostics expose acceptance boundaries without request content', () => {
  assert.deepEqual(retryDiagnostic({ attempt: 1, retryReason: 'connect timeout' }), {
    attempt: 1,
    retryReason: 'connect timeout',
    responseHeadersReceived: false,
    firstByteReceived: false,
    outputStarted: false,
    toolCallStarted: false
  });
});
