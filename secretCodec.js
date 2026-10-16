const PREFIX = 'encrypted:v1:';

function createSecretCodec(safeStorage) {
  const available = Boolean(safeStorage
    && typeof safeStorage.isEncryptionAvailable === 'function'
    && safeStorage.isEncryptionAvailable()
    && typeof safeStorage.encryptString === 'function'
    && typeof safeStorage.decryptString === 'function');
  return {
    available,
    isEncrypted: value => typeof value === 'string' && value.startsWith(PREFIX),
    encrypt(value) {
      const plain = String(value || '');
      if (!plain || !available || plain.startsWith(PREFIX)) return plain;
      return `${PREFIX}${safeStorage.encryptString(plain).toString('base64')}`;
    },
    decrypt(value) {
      const stored = String(value || '');
      if (!stored.startsWith(PREFIX)) return stored;
      if (!available) throw new Error('系统安全存储当前不可用，无法读取已加密的 Provider Key');
      return safeStorage.decryptString(Buffer.from(stored.slice(PREFIX.length), 'base64'));
    }
  };
}

module.exports = { PREFIX, createSecretCodec };
