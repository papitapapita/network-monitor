// Source: src/infrastructure/monitoring/network-scanner/utils/expandCidr.ts

import { expandCidr } from './expandCidr';

describe('expandCidr', () => {
  describe('valid CIDR ranges — correct host list output', () => {
    it('should return 254 hosts for a /24 with the correct first and last addresses', () => {
      const result = expandCidr('192.168.1.0/24');

      expect(result).toHaveLength(254);
      expect(result[0]).toBe('192.168.1.1');
      expect(result[253]).toBe('192.168.1.254');
    });

    it('should return exactly ["10.0.0.1", "10.0.0.2"] for a /30', () => {
      const result = expandCidr('10.0.0.0/30');

      expect(result).toEqual(['10.0.0.1', '10.0.0.2']);
    });

    it('should return an empty array for a /31 (no usable host addresses between network and broadcast)', () => {
      const result = expandCidr('192.168.1.0/31');

      expect(result).toEqual([]);
    });

    it('should return an empty array for a /32 (single-host block has no interior addresses)', () => {
      const result = expandCidr('192.168.1.5/32');

      expect(result).toEqual([]);
    });

    it('should return exactly 1022 hosts for a /22 (the largest allowed range)', () => {
      const result = expandCidr('10.0.0.0/22');

      expect(result).toHaveLength(1022);
    });

    it('should return 510 hosts for a /23 with the correct first and last addresses spanning two class-C blocks', () => {
      const result = expandCidr('192.168.0.0/23');

      expect(result).toHaveLength(510);
      expect(result[0]).toBe('192.168.0.1');
      expect(result[509]).toBe('192.168.1.254');
    });
  });

  describe('capacity guard', () => {
    it('should throw "CIDR range too large" for a /21 (2046 usable hosts > 1024 limit)', () => {
      expect(() => expandCidr('10.0.0.0/21')).toThrow(
        'CIDR range too large'
      );
    });

    it('should throw "CIDR range too large" for /0 even though the prefix is syntactically valid', () => {
      // /0 produces ~4 billion addresses which far exceeds the 1024-host limit
      expect(() => expandCidr('0.0.0.0/0')).toThrow(
        'CIDR range too large'
      );
    });
  });

  describe('validation errors — malformed input', () => {
    it('should throw containing "missing prefix length" when no slash is present', () => {
      expect(() => expandCidr('192.168.1.0')).toThrow(
        'missing prefix length'
      );
    });

    it('should throw containing "not an integer in range 0-32" for prefix 33', () => {
      expect(() => expandCidr('192.168.1.0/33')).toThrow(
        'not an integer in range 0-32'
      );
    });

    it('should throw containing "not an integer in range 0-32" for a negative prefix', () => {
      expect(() => expandCidr('192.168.1.0/-1')).toThrow(
        'not an integer in range 0-32'
      );
    });

    it('should throw containing "not an integer in range 0-32" for a non-numeric prefix', () => {
      expect(() => expandCidr('192.168.1.0/abc')).toThrow(
        'not an integer in range 0-32'
      );
    });

    it('should throw containing "does not have exactly 4 octets" when the IP has only 3 octets', () => {
      expect(() => expandCidr('192.168.1/24')).toThrow(
        'does not have exactly 4 octets'
      );
    });

    it('should throw containing "does not have exactly 4 octets" when the IP has 5 octets', () => {
      expect(() => expandCidr('192.168.1.1.1/24')).toThrow(
        'does not have exactly 4 octets'
      );
    });

    it('should throw containing \'octet 4 "256"\' when the fourth octet is out of range', () => {
      expect(() => expandCidr('192.168.1.256/24')).toThrow(
        'octet 4 "256"'
      );
    });

    it('should throw containing "octet 4" when the fourth octet is an empty string', () => {
      expect(() => expandCidr('192.168.1./24')).toThrow('octet 4');
    });
  });

  describe('ordering', () => {
    it('should return hosts in strictly ascending IP order', () => {
      const result = expandCidr('10.0.0.0/30');

      // Spot-check: first address must be numerically less than the last
      const toNum = (ip: string): number => {
        const [a, b, c, d] = ip.split('.').map(Number) as [
          number,
          number,
          number,
          number
        ];
        return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
      };

      expect(toNum(result[0]!)).toBeLessThan(
        toNum(result[result.length - 1]!)
      );
    });

    it('should return hosts in ascending order for a /24', () => {
      const result = expandCidr('10.10.10.0/24');

      for (let i = 0; i < result.length - 1; i++) {
        const current = result[i]!.split('.')
          .map(Number)
          .reduce((acc, v) => acc * 256 + v, 0);
        const next = result[i + 1]!.split('.')
          .map(Number)
          .reduce((acc, v) => acc * 256 + v, 0);
        expect(current).toBeLessThan(next);
      }
    });
  });
});
