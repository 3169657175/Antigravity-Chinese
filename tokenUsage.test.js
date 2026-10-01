const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildTokenStats,
  extractOfficialUsage,
  shouldTrackModelRequest
} = require('./tokenUsage');

function varint(value) {
  let current = BigInt(value);
  const bytes = [];
  do {
    let byte = Number(current & 0x7fn);
    current >>= 7n;
    if (current > 0n) byte |= 0x80;
    bytes.push(byte);
  } while (current > 0n);
  return Buffer.from(bytes);
}

function varintField(number, value) {
  return Buffer.concat([varint(number << 3), varint(value)]);
}

function messageField(number, payload) {
  return Buffer.concat([varint((number << 3) | 2), varint(payload.length), payload]);
}

test('extracts official JSON usage and cache values', () => {
  const body = Buffer.from(JSON.stringify({
    usageMetadata: {
      promptTokenCount: 100,
      candidatesTokenCount: 20,
      totalTokenCount: 120,
      cachedContentTokenCount: 50
    }
  }));
  assert.deepEqual(extractOfficialUsage(body, 'application/json'), {
    input: 100,
    output: 20,
    cached: 50,
    cacheKnown: true,
    protocol: 'json'
  });
});

test('extracts UsageMetadata fields from a gRPC protobuf frame', () => {
  const usage = Buffer.concat([
    varintField(1, 100),
    varintField(2, 20),
    varintField(3, 120),
    varintField(5, 50)
  ]);
  const response = messageField(3, usage);
  const frameHeader = Buffer.alloc(5);
  frameHeader.writeUInt8(0, 0);
  frameHeader.writeUInt32BE(response.length, 1);
  const body = Buffer.concat([frameHeader, response]);
  assert.deepEqual(extractOfficialUsage(body, 'application/grpc'), {
    input: 100,
    output: 20,
    cached: 50,
    cacheKnown: true,
    protocol: 'grpc-protobuf'
  });
});

test('does not treat arbitrary Cloud Code posts as model requests', () => {
  assert.equal(shouldTrackModelRequest('POST', '/v1internal:retrieveUserQuotaSummary'), false);
  assert.equal(shouldTrackModelRequest('POST', '/v1internal:fetchAvailableModels'), false);
  assert.equal(shouldTrackModelRequest('POST', '/v1beta/models/gemini:streamGenerateContent'), true);
});

test('cache statistics only include records with official cache metadata', () => {
  const stats = buildTokenStats([
    { input: 100, output: 20, cached: 0, estimated: true, cacheKnown: false },
    { input: 80, output: 10, cached: 40, estimated: false, cacheKnown: true }
  ]);
  assert.equal(stats.cachedTokens, 40);
  assert.equal(stats.cachePromptTokens, 80);
  assert.equal(stats.cacheSamples, 1);
  assert.equal(stats.cacheDataAvailable, true);
  assert.equal(stats.estimatedRequests, 1);
  assert.equal(stats.officialRequests, 1);
});
