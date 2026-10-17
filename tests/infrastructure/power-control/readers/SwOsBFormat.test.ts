// Source: src/infrastructure/power-control/readers/SwOsBFormat.ts

import {
  decodeSwOsString,
  parseSwOsB
} from '../../../../src/infrastructure/power-control/readers';

describe('SwOS .b format', () => {
  describe('parseSwOsB', () => {
    it('should read bare keys, hex numbers, strings and arrays', () => {
      expect(
        parseSwOsB(
          "{en:0x1f,nm:['506f727431','31302e302e352e3231'],poe:[0x00,0x01,0x02],sub:{a:0x10}}"
        )
      ).toEqual({
        en: 31,
        nm: ['506f727431', '31302e302e352e3231'],
        poe: [0, 1, 2],
        sub: { a: 16 }
      });
    });

    it('should accept whitespace and a trailing newline', () => {
      expect(parseSwOsB('{ en : 0x01 }\n')).toEqual({ en: 1 });
    });

    it('should throw on something that is not a .b file', () => {
      expect(() => parseSwOsB('<html>login</html>')).toThrow();
    });
  });

  describe('decodeSwOsString', () => {
    it('should decode a hex-encoded name', () => {
      expect(decodeSwOsString('31302e302e352e3231')).toBe(
        '10.0.5.21'
      );
    });

    it('should decode an empty name', () => {
      expect(decodeSwOsString('')).toBe('');
    });

    it.each([undefined, 12, 'xyz', '123'])(
      'should give null for %p',
      (value) => {
        expect(decodeSwOsString(value)).toBeNull();
      }
    );
  });
});
