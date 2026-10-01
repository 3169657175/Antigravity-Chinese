const PASSWORD_SCHEME = "pbkdf2-sha256";
const PASSWORD_ITERATIONS = 100000;
const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function b64urlEncodeBytes(bytes) {
  return bytesToBase64(bytes).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function b64urlEncodeJson(value) {
  return b64urlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function b64urlDecodeBytes(value) {
  let normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  return base64ToBytes(normalized);
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  return difference === 0;
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  return new Uint8Array(bits);
}

export function getJwtSecret(env) {
  const secret = env && env.JWT_SECRET;
  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("服务器未配置至少 32 位的 JWT_SECRET");
  }
  return secret;
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return [PASSWORD_SCHEME, PASSWORD_ITERATIONS, bytesToBase64(salt), bytesToBase64(hash)].join("$");
}

export async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== "string") return { valid: false, needsRehash: false };

  const parts = storedHash.split("$");
  if (parts.length === 4 && parts[0] === PASSWORD_SCHEME) {
    const iterations = Number(parts[1]);
    if (!Number.isSafeInteger(iterations) || iterations < 100000 || iterations > 1000000) {
      return { valid: false, needsRehash: false };
    }
    try {
      const actual = await derivePassword(password, base64ToBytes(parts[2]), iterations);
      const expected = base64ToBytes(parts[3]);
      return {
        valid: constantTimeEqual(actual, expected),
        needsRehash: iterations !== PASSWORD_ITERATIONS
      };
    } catch {
      return { valid: false, needsRehash: false };
    }
  }

  // 兼容旧版无盐 SHA-256；验证成功后由登录接口自动升级。
  if (/^[a-f0-9]{64}$/i.test(storedHash)) {
    const digest = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password))
    );
    const expected = new Uint8Array(storedHash.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    const valid = constantTimeEqual(digest, expected);
    return { valid, needsRehash: valid };
  }

  return { valid: false, needsRehash: false };
}

export async function generateJWT(payload, secret) {
  if (!secret) throw new Error("JWT secret is required");
  const header = b64urlEncodeJson({ alg: "HS256", typ: "JWT" });
  const body = b64urlEncodeJson({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS
  });
  const unsignedToken = `${header}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(unsignedToken))
  );
  return `${unsignedToken}.${b64urlEncodeBytes(signature)}`;
}

export async function verifyJWT(token, secret) {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const header = JSON.parse(new TextDecoder().decode(b64urlDecodeBytes(parts[0])));
    if (header.alg !== "HS256" || header.typ !== "JWT") return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecodeBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecodeBytes(parts[1])));
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function authenticateRequest(request, secret) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return verifyJWT(authHeader.slice(7), secret);
}
