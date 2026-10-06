import { createHmac, randomBytes } from 'crypto';
import { ITwoFactorCodes } from 'application/identity/interfaces/ITwoFactorCodes';

const STEP_SECONDS = 30;
const DIGITS = 6;
const SECRET_BYTES = 20;
const DRIFT_STEPS = 1;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// RFC 6238 with the parameters every authenticator app defaults to: HMAC-SHA1,
// 30-second steps, 6 digits.
export class TotpTwoFactorCodes implements ITwoFactorCodes {
  public generateSecret(): string {
    return base32Encode(randomBytes(SECRET_BYTES));
  }

  public provisioningUri(
    secret: string,
    account: string,
    issuer: string
  ): string {
    const label = encodeURIComponent(`${issuer}:${account}`);
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: String(DIGITS),
      period: String(STEP_SECONDS)
    });
    return `otpauth://totp/${label}?${params.toString()}`;
  }

  public matchStep(
    secret: string,
    code: string,
    now: Date
  ): number | null {
    if (!new RegExp(`^\\d{${DIGITS}}$`).test(code)) return null;
    const key = base32Decode(secret);
    if (!key) return null;
    const current = Math.floor(now.getTime() / 1000 / STEP_SECONDS);
    for (let drift = -DRIFT_STEPS; drift <= DRIFT_STEPS; drift++) {
      if (hotp(key, current + drift) === code) return current + drift;
    }
    return null;
  }
}

export function hotp(
  key: Buffer,
  counter: number,
  digits = DIGITS
): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer | null {
  const clean = text.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
