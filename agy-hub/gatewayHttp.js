const zlib = require('zlib');
const { promisify } = require('util');

const MAX_ENCODED_REQUEST_BYTES = 32 * 1024 * 1024;
const MAX_DECODED_REQUEST_BYTES = 64 * 1024 * 1024;
const gunzip = promisify(zlib.gunzip);
const brotliDecompress = promisify(zlib.brotliDecompress);
const inflate = promisify(zlib.inflate);

class RequestBodyError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'RequestBodyError';
    this.statusCode = Number(options.statusCode) || 400;
    this.code = options.code || 'invalid_request_body';
    this.retryable = false;
  }
}

function jsonError(res, status, message, code = 'api_error') {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { message, type: code, code } }));
}

function normalizeEncoding(encoding) {
  return String(encoding || 'identity').trim().toLowerCase();
}

async function decodeRequestBody(buffer, encoding, options = {}) {
  const maxOutputLength = Math.max(1024, Number(options.maxOutputLength) || MAX_DECODED_REQUEST_BYTES);
  const value = normalizeEncoding(encoding);
  if (!value || value === 'identity') {
    if (buffer.length > maxOutputLength) {
      throw new RequestBodyError(`请求正文超过 ${Math.round(maxOutputLength / 1024 / 1024)}MB`, {
        statusCode: 413,
        code: 'request_body_too_large'
      });
    }
    return buffer;
  }

  let operation;
  if (value === 'gzip' || value === 'x-gzip') operation = gunzip;
  else if (value === 'br') operation = brotliDecompress;
  else if (value === 'deflate') operation = inflate;
  else {
    throw new RequestBodyError(`不支持的请求压缩格式：${value}`, {
      statusCode: 415,
      code: 'unsupported_content_encoding'
    });
  }

  try {
    return await operation(buffer, { maxOutputLength });
  } catch (error) {
    if (/maxOutputLength|larger than|too large|Cannot create a Buffer larger/i.test(String(error && error.message || error))) {
      throw new RequestBodyError(`解压后的请求正文超过 ${Math.round(maxOutputLength / 1024 / 1024)}MB`, {
        statusCode: 413,
        code: 'decoded_request_body_too_large'
      });
    }
    throw new RequestBodyError(`请求正文解压失败：${error.message}`, {
      statusCode: 400,
      code: 'invalid_compressed_body'
    });
  }
}

function readJson(req, limit = MAX_ENCODED_REQUEST_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const declaredLength = Number(req.headers && req.headers['content-length']);
    const fail = error => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      reject(error);
    };

    if (Number.isFinite(declaredLength) && declaredLength > limit) {
      fail(new RequestBodyError(`请求传输正文超过 ${Math.round(limit / 1024 / 1024)}MB`, {
        statusCode: 413,
        code: 'encoded_request_body_too_large'
      }));
      req.resume?.();
      return;
    }

    req.on('data', chunk => {
      if (settled) return;
      size += chunk.length;
      if (size > limit) {
        fail(new RequestBodyError(`请求传输正文超过 ${Math.round(limit / 1024 / 1024)}MB`, {
          statusCode: 413,
          code: 'encoded_request_body_too_large'
        }));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (settled) return;
      try {
        const decoded = await decodeRequestBody(Buffer.concat(chunks), req.headers['content-encoding']);
        let parsed;
        try {
          parsed = JSON.parse(decoded.toString('utf8') || '{}');
        } catch (error) {
          throw new RequestBodyError(`请求正文不是有效的 JSON：${error.message}`, {
            statusCode: 400,
            code: 'invalid_json_body'
          });
        }
        settled = true;
        resolve(parsed);
      } catch (error) {
        fail(error instanceof RequestBodyError ? error : new RequestBodyError(`无法读取请求正文：${error.message}`));
      }
    });
    req.on('error', error => fail(new RequestBodyError(`读取请求正文失败：${error.message}`, {
      statusCode: 400,
      code: 'request_body_read_failed'
    })));
  });
}

function parseMetadataValue(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try { return JSON.parse(value); } catch (_) { return null; }
}

function codexRequestMetadata(req, body) {
  const clientMetadata = body && body.client_metadata && typeof body.client_metadata === 'object'
    ? body.client_metadata : {};
  return parseMetadataValue(clientMetadata['x-codex-turn-metadata'])
    || parseMetadataValue(req && req.headers && req.headers['x-codex-turn-metadata'])
    || clientMetadata;
}

module.exports = {
  RequestBodyError,
  MAX_ENCODED_REQUEST_BYTES,
  MAX_DECODED_REQUEST_BYTES,
  jsonError,
  decodeRequestBody,
  readJson,
  parseMetadataValue,
  codexRequestMetadata
};
