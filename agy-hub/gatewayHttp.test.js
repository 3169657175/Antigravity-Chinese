const test = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('stream');
const zlib = require('zlib');
const {
  RequestBodyError,
  decodeRequestBody,
  readJson,
  MAX_ENCODED_REQUEST_BYTES,
  MAX_DECODED_REQUEST_BYTES
} = require('./gatewayHttp');

function requestFrom(buffer, headers = {}) {
  const req = new PassThrough();
  req.headers = headers;
  process.nextTick(() => req.end(buffer));
  return req;
}

test('readJson accepts normal and compressed JSON without synchronous zlib', async () => {
  const source = Buffer.from(JSON.stringify({ model: 'gemini-3.1-pro-high', input: 'hello' }));
  const plain = await readJson(requestFrom(source));
  const gzip = await readJson(requestFrom(zlib.gzipSync(source), { 'content-encoding': 'gzip' }));
  assert.deepEqual(plain, gzip);
});

test('encoded request limit returns a typed 413 error before buffering the body', async () => {
  const req = requestFrom(Buffer.from('{}'), { 'content-length': String(MAX_ENCODED_REQUEST_BYTES + 1) });
  await assert.rejects(readJson(req), error => {
    assert.equal(error instanceof RequestBodyError, true);
    assert.equal(error.statusCode, 413);
    assert.equal(error.code, 'encoded_request_body_too_large');
    return true;
  });
});

test('decoded request limit rejects high expansion compressed bodies', async () => {
  const compressed = zlib.gzipSync(Buffer.alloc(128 * 1024, 65));
  await assert.rejects(decodeRequestBody(compressed, 'gzip', { maxOutputLength: 32 * 1024 }), error => {
    assert.equal(error.statusCode, 413);
    assert.equal(error.code, 'decoded_request_body_too_large');
    return true;
  });
  assert.equal(MAX_DECODED_REQUEST_BYTES, 64 * 1024 * 1024);
});

test('invalid JSON and unsupported compression have distinct client errors', async () => {
  await assert.rejects(readJson(requestFrom(Buffer.from('{bad'))), error => error.code === 'invalid_json_body');
  await assert.rejects(decodeRequestBody(Buffer.from('{}'), 'compress'), error => {
    assert.equal(error.statusCode, 415);
    return error.code === 'unsupported_content_encoding';
  });
});
