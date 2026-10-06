import {
  HashedRecoveryCodes,
  RECOVERY_CODE_COUNT
} from '../../../../src/infrastructure/identity/services/HashedRecoveryCodes';

describe('HashedRecoveryCodes', () => {
  const recovery = new HashedRecoveryCodes();

  it('[IDN-163] makes ten distinct codes of two readable groups', () => {
    const { codes } = recovery.generate();

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
    }
  });

  it('[IDN-163] returns the hash of each code, never the code itself', () => {
    const { codes, hashes } = recovery.generate();

    expect(hashes).toEqual(codes.map((c) => recovery.hash(c)));
    for (const hash of hashes) expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('[IDN-163] hashes a code the same however it is typed', () => {
    const typed = recovery.hash('ABCDE-FGHJK');

    expect(recovery.hash('abcde fghjk')).toBe(typed);
    expect(recovery.hash('ABCDEFGHJK')).toBe(typed);
    expect(recovery.hash('ABCDE-FGHJM')).not.toBe(typed);
  });
});
