import { createHash, randomInt } from 'crypto';
import { IRecoveryCodes } from 'application/identity/interfaces/IRecoveryCodes';

export const RECOVERY_CODE_COUNT = 10;
// No 0/O or 1/I/L, so a code copied from paper is read back as written.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUP = 5;

// Ten random characters from 31 is about 50 bits, far beyond guessing within
// the sign-in limits (IDN-044), so a fast hash is enough to store them.
export class HashedRecoveryCodes implements IRecoveryCodes {
  public generate(): { codes: string[]; hashes: string[] } {
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () =>
      [group(), group()].join('-')
    );
    return { codes, hashes: codes.map((code) => this.hash(code)) };
  }

  // Lenient on what a person types: case, spaces and the dash.
  public hash(code: string): string {
    const normalized = code.toUpperCase().replace(/[\s-]/g, '');
    return createHash('sha256').update(normalized).digest('hex');
  }
}

function group(): string {
  let out = '';
  for (let i = 0; i < GROUP; i++)
    out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
