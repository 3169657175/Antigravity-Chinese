const http = require('http');
const https = require('https');
const { discoverRuntime, isLoopbackUrl } = require('./antigravityQuotaBridge.js');

const QUOTA_RPC_PATH = '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary';
const FORCE_REFRESH_GRPC_FRAME = Buffer.from([0, 0, 0, 0, 2, 16, 1]);
const QUOTA_BUCKET_IDS = Object.freeze([
  'gemini-weekly',
  'gemini-5h',
  '3p-weekly',
  '3p-5h',
  'gemini-argon-wtu-weekly'
]);

function requestBuffer(urlValue, options = {}) {
  const url = new URL(urlValue);
  const transport = url.protocol === 'https:' ? https : http;
  const timeoutMs = Math.max(250, Number(options.timeoutMs) || 2200);
  return new Promise((resolve, reject) => {
    const request = transport.request(url, {
      method: options.method || 'POST',
      headers: options.headers || {},
      rejectUnauthorized: options.rejectUnauthorized !== false
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        if ((response.statusCode || 0) < 200 || (response.statusCode || 0) >= 300) {
          reject(new Error(`Antigravity Language Server returned HTTP ${response.statusCode || 0}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('Antigravity Language Server quota request timed out')));
    request.on('error', reject);
    request.write(options.body || FORCE_REFRESH_GRPC_FRAME);
    request.end();
  });
}

function parseGrpcQuotaSummary(buffer) {
  const source = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const buckets = [];
  const positions = QUOTA_BUCKET_IDS
    .map(bucketId => ({ bucketId, index: source.indexOf(Buffer.from(bucketId, 'utf8')) }))
    .filter(item => item.index >= 0)
    .sort((left, right) => left.index - right.index);
  for (let itemIndex = 0; itemIndex < positions.length; itemIndex += 1) {
    const item = positions[itemIndex];
    const nextBucketIndex = positions[itemIndex + 1]?.index ?? source.length;
    const scanEnd = Math.min(nextBucketIndex, item.index + item.bucketId.length + 512);
    let remainingFraction = null;
    for (let offset = item.index + item.bucketId.length; offset + 4 < scanEnd; offset += 1) {
      if (source[offset] !== 0x25) continue;
      const candidate = source.readFloatLE(offset + 1);
      if (!Number.isFinite(candidate) || candidate < 0 || candidate > 1.0001) continue;
      remainingFraction = Math.max(0, Math.min(1, candidate));
      break;
    }
    if (remainingFraction !== null) buckets.push({ bucketId: item.bucketId, remainingFraction });
  }
  if (!buckets.length) throw new Error('Antigravity Language Server returned no recognized quota buckets');
  return { groups: [{ buckets }] };
}

async function fetchCurrentAccountLanguageServerQuota(options = {}) {
  const runtime = await (options.discoverRuntime || discoverRuntime)(options);
  if (!isLoopbackUrl(runtime.origin, ['https:'])) throw new Error('Language Server origin must be a local HTTPS address');
  const buffer = await (options.requestBuffer || requestBuffer)(`${runtime.origin}${QUOTA_RPC_PATH}`, {
    method: 'POST',
    timeoutMs: options.timeoutMs || 2200,
    rejectUnauthorized: false,
    headers: {
      'Content-Type': 'application/json',
      'x-codeium-csrf-token': runtime.csrfToken
    },
    body: Buffer.from(JSON.stringify({ forceRefresh: true }))
  });
  return {
    summary: JSON.parse(buffer.toString('utf8')),
    appVersion: runtime.appVersion
  };
}

module.exports = {
  fetchCurrentAccountLanguageServerQuota,
  parseGrpcQuotaSummary,
  FORCE_REFRESH_GRPC_FRAME
};
