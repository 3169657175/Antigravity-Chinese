const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecretCodec, PREFIX } = require('./secretCodec.js');

test('encrypts and decrypts secrets through safeStorage', () => {
  const safeStorage = { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(`wrapped:${value}`), decryptString: value => value.toString().replace(/^wrapped:/, '') };
  const codec = createSecretCodec(safeStorage);
  const encrypted = codec.encrypt('sk-test');
  assert.match(encrypted, new RegExp(`^${PREFIX}`));
  assert.equal(codec.decrypt(encrypted), 'sk-test');
});
