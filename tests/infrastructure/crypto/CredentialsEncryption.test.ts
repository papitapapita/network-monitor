import { CredentialsEncryption } from '../../../src/infrastructure/crypto/CredentialsEncryption';

// A valid 32-byte key expressed as 64 hex characters
const VALID_KEY_HEX = 'a'.repeat(64);

describe('CredentialsEncryption', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.DEVICE_CREDENTIALS_KEY;
    process.env.DEVICE_CREDENTIALS_KEY = VALID_KEY_HEX;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.DEVICE_CREDENTIALS_KEY;
    } else {
      process.env.DEVICE_CREDENTIALS_KEY = originalKey;
    }
  });

  describe('encrypt', () => {
    it('should produce a ciphertext string in iv:authTag:encrypted format', () => {
      const ciphertext = CredentialsEncryption.encrypt('hello');

      const parts = ciphertext.split(':');
      expect(parts).toHaveLength(3);
      parts.forEach(part => expect(part.length).toBeGreaterThan(0));
    });

    it('should produce different ciphertexts for the same plaintext due to random IVs', () => {
      const first = CredentialsEncryption.encrypt('same-plaintext');
      const second = CredentialsEncryption.encrypt('same-plaintext');

      expect(first).not.toBe(second);
    });

    it('should produce different ciphertexts for different plaintexts', () => {
      const first = CredentialsEncryption.encrypt('plaintext-a');
      const second = CredentialsEncryption.encrypt('plaintext-b');

      expect(first).not.toBe(second);
    });

    it('should throw when DEVICE_CREDENTIALS_KEY env var is not set', () => {
      delete process.env.DEVICE_CREDENTIALS_KEY;

      expect(() => CredentialsEncryption.encrypt('hello')).toThrow(
        'DEVICE_CREDENTIALS_KEY env var is not set'
      );
    });

    it('should throw when DEVICE_CREDENTIALS_KEY is not 32 bytes (64 hex chars)', () => {
      process.env.DEVICE_CREDENTIALS_KEY = 'deadbeef'; // only 4 bytes

      expect(() => CredentialsEncryption.encrypt('hello')).toThrow(
        'DEVICE_CREDENTIALS_KEY must be 32 bytes (64 hex chars)'
      );
    });
  });

  describe('decrypt', () => {
    it('should throw when the ciphertext does not contain exactly three colon-separated parts', () => {
      expect(() => CredentialsEncryption.decrypt('onlytwoparts:here')).toThrow(
        'Invalid ciphertext format'
      );
    });

    it('should throw when the auth tag has been tampered with (bit-flip)', () => {
      const ciphertext = CredentialsEncryption.encrypt('secret data');
      const [iv, authTag, encrypted] = ciphertext.split(':');

      // Flip the first byte of the base64-decoded auth tag
      const authTagBytes = Buffer.from(authTag, 'base64');
      authTagBytes[0] ^= 0xff;
      const tamperedAuthTag = authTagBytes.toString('base64');
      const tampered = [iv, tamperedAuthTag, encrypted].join(':');

      expect(() => CredentialsEncryption.decrypt(tampered)).toThrow();
    });

    it('should throw when DEVICE_CREDENTIALS_KEY env var is not set during decrypt', () => {
      const ciphertext = CredentialsEncryption.encrypt('hello');
      delete process.env.DEVICE_CREDENTIALS_KEY;

      expect(() => CredentialsEncryption.decrypt(ciphertext)).toThrow(
        'DEVICE_CREDENTIALS_KEY env var is not set'
      );
    });
  });

  describe('encrypt → decrypt round-trip', () => {
    it('should recover the original plaintext after encrypt then decrypt', () => {
      const original = 'my-secret-password';
      const ciphertext = CredentialsEncryption.encrypt(original);
      const recovered = CredentialsEncryption.decrypt(ciphertext);

      expect(recovered).toBe(original);
    });

    it('should handle empty string plaintext in a round-trip', () => {
      const ciphertext = CredentialsEncryption.encrypt('');
      const recovered = CredentialsEncryption.decrypt(ciphertext);

      expect(recovered).toBe('');
    });

    it('should handle unicode characters in a round-trip', () => {
      const original = 'p@$$w0rd-日本語-🔑';
      const ciphertext = CredentialsEncryption.encrypt(original);
      const recovered = CredentialsEncryption.decrypt(ciphertext);

      expect(recovered).toBe(original);
    });

    it('should handle a long plaintext in a round-trip', () => {
      const original = 'x'.repeat(4096);
      const ciphertext = CredentialsEncryption.encrypt(original);
      const recovered = CredentialsEncryption.decrypt(ciphertext);

      expect(recovered).toBe(original);
    });
  });
});
