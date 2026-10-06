// Source: src/infrastructure/identity/services/BcryptPasswordService.ts

import { BcryptPasswordService } from '../../../../src/infrastructure/identity/services/BcryptPasswordService';

describe('BcryptPasswordService', () => {
  const passwords = new BcryptPasswordService();

  it('[IDN-006] hashes with bcrypt at cost 10 and compares', async () => {
    const hash = await passwords.hash('a-long-password');

    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(await passwords.compare('a-long-password', hash)).toBe(
      true
    );
    expect(await passwords.compare('another-password', hash)).toBe(
      false
    );
  });

  it('[IDN-184] an unusable hash is a fresh bcrypt hash each time', async () => {
    const first = await passwords.unusableHash();
    const second = await passwords.unusableHash();

    expect(first).toMatch(/^\$2[aby]\$10\$/);
    expect(first).not.toBe(second);
    expect(await passwords.compare('', first)).toBe(false);
  });
});
