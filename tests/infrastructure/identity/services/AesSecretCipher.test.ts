import { AesSecretCipher } from '../../../../src/infrastructure/identity/services/AesSecretCipher';

describe('AesSecretCipher', () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.DEVICE_CREDENTIALS_KEY;
    process.env.DEVICE_CREDENTIALS_KEY = 'b'.repeat(64);
  });

  afterEach(() => {
    if (originalKey === undefined)
      delete process.env.DEVICE_CREDENTIALS_KEY;
    else process.env.DEVICE_CREDENTIALS_KEY = originalKey;
  });

  it('[IDN-162] stores a two-factor secret unreadable and reads it back', () => {
    const cipher = new AesSecretCipher();
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    const stored = cipher.encrypt(secret);

    expect(stored).not.toContain(secret);
    expect(cipher.decrypt(stored)).toBe(secret);
  });

  it('[IDN-162] cannot read it back with another install key', () => {
    const cipher = new AesSecretCipher();
    const stored = cipher.encrypt('GEZDGNBVGY3TQOJQ');
    process.env.DEVICE_CREDENTIALS_KEY = 'c'.repeat(64);

    expect(() => cipher.decrypt(stored)).toThrow();
  });
});
