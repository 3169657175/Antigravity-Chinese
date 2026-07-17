"use strict";

const STORAGE_SCHEME = "electron-safe-storage-v1";

function requireEncryption(safeStorage) {
    if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== "function" ||
        !safeStorage.isEncryptionAvailable()) {
        throw new Error("Windows credential encryption is unavailable; account data was not saved.");
    }
}

function protectAccountDetail(detail, token, safeStorage) {
    if (!token || !token.access_token) {
        throw new Error("Token structure missing in account details");
    }
    requireEncryption(safeStorage);

    const encrypted = safeStorage.encryptString(JSON.stringify(token));
    const protectedDetail = {
        ...detail,
        token_storage: STORAGE_SCHEME,
        token_encrypted: encrypted.toString("base64")
    };
    delete protectedDetail.token;
    return protectedDetail;
}

function readAccountToken(detail, safeStorage) {
    if (detail && detail.token_encrypted) {
        if (detail.token_storage !== STORAGE_SCHEME) {
            throw new Error("Unsupported account token storage format");
        }
        requireEncryption(safeStorage);
        const encrypted = Buffer.from(detail.token_encrypted, "base64");
        const token = JSON.parse(safeStorage.decryptString(encrypted));
        if (!token || !token.access_token) {
            throw new Error("Decrypted account token is invalid");
        }
        return { token, needsMigration: false };
    }

    if (detail && detail.token && detail.token.access_token) {
        return { token: detail.token, needsMigration: true };
    }

    throw new Error("Token structure missing in account details");
}

module.exports = {
    STORAGE_SCHEME,
    protectAccountDetail,
    readAccountToken
};
