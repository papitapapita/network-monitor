import {
  TotpTwoFactorCodes,
  base32Decode,
  base32Encode,
  hotp
} from '../../../../src/infrastructure/identity/services/TotpTwoFactorCodes';

// RFC 6238 appendix B, SHA-1 column: the shared secret is the ASCII string
// "12345678901234567890".
const RFC_KEY = Buffer.from('12345678901234567890', 'ascii');
const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const RFC_VECTORS: Array<[number, string]> = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130']
];

describe('TotpTwoFactorCodes', () => {
  const codes = new TotpTwoFactorCodes();

  describe('[IDN-161] the RFC 6238 test vectors', () => {
    it.each(RFC_VECTORS)('at %i s gives %s', (seconds, expected) => {
      expect(hotp(RFC_KEY, Math.floor(seconds / 30), 8)).toBe(
        expected
      );
    });

    it.each(RFC_VECTORS)(
      'accepts the six-digit form of the code at %i s',
      (seconds, expected) => {
        const at = new Date(seconds * 1000);

        expect(
          codes.matchStep(RFC_SECRET, expected.slice(2), at)
        ).toBe(Math.floor(seconds / 30));
      }
    );
  });

  describe('[IDN-161] matchStep', () => {
    const at = new Date(59_000);
    const step = 1;

    it('accepts the code from one step before or after', () => {
      const before = hotp(RFC_KEY, step - 1);
      const after = hotp(RFC_KEY, step + 1);

      expect(codes.matchStep(RFC_SECRET, before, at)).toBe(step - 1);
      expect(codes.matchStep(RFC_SECRET, after, at)).toBe(step + 1);
    });

    it('refuses a code two steps away', () => {
      expect(
        codes.matchStep(RFC_SECRET, hotp(RFC_KEY, step + 2), at)
      ).toBeNull();
    });

    it.each(['', '12345', '1234567', 'abcdef', '28 7082'])(
      'refuses the malformed code %p',
      (code) => {
        expect(codes.matchStep(RFC_SECRET, code, at)).toBeNull();
      }
    );

    it('refuses everything for a secret that is not base32', () => {
      expect(codes.matchStep('not-base32!', '287082', at)).toBeNull();
    });
  });

  describe('generateSecret', () => {
    it('makes a 160-bit base32 secret, different each time', () => {
      const a = codes.generateSecret();
      const b = codes.generateSecret();

      expect(a).toMatch(/^[A-Z2-7]{32}$/);
      expect(base32Decode(a)).toHaveLength(20);
      expect(a).not.toBe(b);
    });
  });

  describe('provisioningUri', () => {
    it('encodes the issuer, account and code parameters for the apps', () => {
      const uri = new URL(
        codes.provisioningUri(
          RFC_SECRET,
          'ana@isp.example',
          'Mi Red Control'
        )
      );

      expect(uri.protocol).toBe('otpauth:');
      expect(uri.host).toBe('totp');
      expect(decodeURIComponent(uri.pathname)).toBe(
        '/Mi Red Control:ana@isp.example'
      );
      expect(Object.fromEntries(uri.searchParams)).toEqual({
        secret: RFC_SECRET,
        issuer: 'Mi Red Control',
        algorithm: 'SHA1',
        digits: '6',
        period: '30'
      });
    });
  });

  describe('base32', () => {
    it('encodes the RFC secret', () => {
      expect(base32Encode(RFC_KEY)).toBe(RFC_SECRET);
    });

    it('decodes lowercase and padded input', () => {
      expect(base32Decode(RFC_SECRET.toLowerCase() + '====')).toEqual(
        RFC_KEY
      );
    });
  });
});
