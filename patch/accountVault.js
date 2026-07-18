"use strict";

const STORAGE_SCHEME = "plaintext-v1";

function normalizeToken(rawToken) {
    if (!rawToken || typeof rawToken !== "object") {
        return null;
    }

    const token = { ...rawToken };
    if (!token.access_token && typeof token.accessToken === "string") {
        token.access_token = token.accessToken;
    }
    if (!token.refresh_token && typeof token.refreshToken === "string") {
        token.refresh_token = token.refreshToken;
    }
    if (!token.expiry_timestamp && token.expiry) {
        const parsedExpiry = Date.parse(token.expiry);
        if (!Number.isNaN(parsedExpiry)) {
            token.expiry_timestamp = Math.floor(parsedExpiry / 1000);
        }
    }
    if (!token.expiry_timestamp && token.expires_at) {
        const expiresAt = typeof token.expires_at === "number"
            ? token.expires_at
            : Math.floor(Date.parse(token.expires_at) / 1000);
        if (Number.isFinite(expiresAt)) {
            token.expiry_timestamp = expiresAt;
        }
    }
    if (!token.expiry_timestamp) {
        token.expiry_timestamp = Math.floor(Date.now() / 1000) + (token.expires_in || 3599);
    }
    if (!token.token_type) {
        token.token_type = "Bearer";
    }

    return token.access_token ? token : null;
}

function getCandidateTokens(detail) {
    if (!detail || typeof detail !== "object") {
        return [];
    }

    return [
        detail.token,
        detail.account_token,
        detail.accountToken,
        detail.credentials && detail.credentials.token,
        detail.auth && detail.auth.token,
        detail.keyring && detail.keyring.token,
        detail.login && detail.login.token
    ];
}

function readLegacyEncryptedToken(detail, safeStorage) {
    if (!detail || !detail.token_encrypted || !safeStorage || typeof safeStorage.decryptString !== "function") {
        return null;
    }

    try {
        const encrypted = Buffer.from(detail.token_encrypted, "base64");
        return normalizeToken(JSON.parse(safeStorage.decryptString(encrypted)));
    } catch (e) {
        console.error("[accountVault] failed to decrypt legacy token:", e.message);
        return null;
    }
}

function requireEncryption() {
    return true;
}

function protectAccountDetail(detail, token) {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) {
        throw new Error("Token structure missing in account details");
    }

    const protectedDetail = {
        ...(detail || {}),
        token_storage: STORAGE_SCHEME,
        token: normalizedToken
    };
    delete protectedDetail.token_encrypted;
    delete protectedDetail.encrypted_token;
    return protectedDetail;
}

function readAccountToken(detail, safeStorage) {
    for (const candidate of getCandidateTokens(detail)) {
        const token = normalizeToken(candidate);
        if (token) {
            return {
                token,
                needsMigration: !detail || detail.token !== candidate || detail.token_storage !== STORAGE_SCHEME || !!detail.token_encrypted
            };
        }
    }

    const legacyToken = readLegacyEncryptedToken(detail, safeStorage);
    if (legacyToken) {
        return { token: legacyToken, needsMigration: true };
    }

    return { token: null, needsMigration: false };
}

module.exports = {
    STORAGE_SCHEME,
    requireEncryption,
    protectAccountDetail,
    readAccountToken
};
