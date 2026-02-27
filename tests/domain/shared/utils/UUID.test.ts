// Source: src/domain/shared/utils/UUID.ts
// Re-exported through: src/domain/shared/core/index.ts -> src/domain/device-inventory/index.ts

import { UUID } from '../../../../src/domain/shared/utils/UUID';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// UUID v4 — canonical test value (version digit = 4, variant nibble = a)
const VALID_UUID_V4 = '550e8400-e29b-41d4-a716-446655440000';

// A second distinct v4 UUID for inequality checks
const ANOTHER_VALID_UUID_V4 = '11111111-1111-4111-8111-111111111111';

// UUID v1 — version digit = 1 (should be rejected)
const UUID_V1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// UUID v3 — version digit = 3 (should be rejected)
const UUID_V3 = '6fa459ea-ee8a-3ca4-894e-db77e160355e';

// UUID v5 — version digit = 5 (should be rejected)
const UUID_V5 = '886313e1-3b8a-5372-9b90-0c9aee199e5d';

// Structurally correct except variant nibble = 'c' (not in [89ab])
const UUID_WRONG_VARIANT_C = '550e8400-e29b-41d4-c716-446655440000';

// Structurally correct except variant nibble = '7' (not in [89ab])
const UUID_WRONG_VARIANT_7 = '550e8400-e29b-41d4-7716-446655440000';

// Structurally correct except variant nibble = 'f' (not in [89ab])
const UUID_WRONG_VARIANT_F = '550e8400-e29b-41d4-f716-446655440000';

// Correct character count but hyphens removed
const UUID_NO_HYPHENS = '550e8400e29b41d4a716446655440000';

// Hyphens present but in wrong positions (shifted one character right)
const UUID_MISPLACED_HYPHENS = '550e840-0e29b-41d4-a716-446655440000';

// Too short (35 chars, last char missing)
const UUID_TOO_SHORT = '550e8400-e29b-41d4-a716-44665544000';

// Too long (37 chars, extra char appended)
const UUID_TOO_LONG = '550e8400-e29b-41d4-a716-4466554400000';

// Contains non-hex characters in the first group
const UUID_NON_HEX = 'zzzzzzzz-e29b-41d4-a716-446655440000';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('UUID', () => {
  describe('generate()', () => {
    it('should return a UUID instance', () => {
      const uuid = UUID.create();

      expect(uuid).toBeInstanceOf(UUID);
    });

    it('should produce a valid UUID v4 string', () => {
      const uuid = UUID.create();

      expect(UUID.isValid(uuid.toValue())).toBe(true);
    });

    it('should produce unique values on successive calls', () => {
      const a = UUID.create();
      const b = UUID.create();

      expect(a.equals(b)).toBe(false);
    });

    it('should produce a string of exactly 36 characters', () => {
      const uuid = UUID.create();

      expect(uuid.toValue()).toHaveLength(36);
    });

    it('should include hyphens at the standard positions', () => {
      const uuid = UUID.create();
      const raw = uuid.toValue();

      expect(raw[8]).toBe('-');
      expect(raw[13]).toBe('-');
      expect(raw[18]).toBe('-');
      expect(raw[23]).toBe('-');
    });

    it('should embed version digit 4 at position 14', () => {
      const uuid = UUID.create();

      expect(uuid.toValue()[14]).toBe('4');
    });

    it('should embed a valid variant nibble at position 19', () => {
      const uuid = UUID.create();

      expect(['8', '9', 'a', 'b']).toContain(uuid.toValue()[19]);
    });
  });

  describe('parse()', () => {
    describe('success cases', () => {
      it('should succeed for a valid UUID v4 string', () => {
        const result = UUID.parse(VALID_UUID_V4);

        expect(result.isSuccess).toBe(true);
        expect(result.value.toValue()).toBe(VALID_UUID_V4);
      });

      it('should normalise an uppercase UUID to lowercase', () => {
        const upper = VALID_UUID_V4.toUpperCase();
        const result = UUID.parse(upper);

        expect(result.isSuccess).toBe(true);
        expect(result.value.toValue()).toBe(VALID_UUID_V4);
      });

      it('should accept a UUID whose variant nibble is "8"', () => {
        const withVariant8 = '550e8400-e29b-41d4-8716-446655440000';
        const result = UUID.parse(withVariant8);

        expect(result.isSuccess).toBe(true);
      });

      it('should accept a UUID whose variant nibble is "9"', () => {
        const withVariant9 = '550e8400-e29b-41d4-9716-446655440000';
        const result = UUID.parse(withVariant9);

        expect(result.isSuccess).toBe(true);
      });

      it('should accept a UUID whose variant nibble is "a"', () => {
        const result = UUID.parse(VALID_UUID_V4); // variant nibble = 'a'

        expect(result.isSuccess).toBe(true);
      });

      it('should accept a UUID whose variant nibble is "b"', () => {
        const withVariantB = '550e8400-e29b-41d4-b716-446655440000';
        const result = UUID.parse(withVariantB);

        expect(result.isSuccess).toBe(true);
      });
    });

    describe('failure cases — version mismatch', () => {
      it('should fail for a UUID v1 string (version digit = 1)', () => {
        const result = UUID.parse(UUID_V1);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid UUID format');
        expect(result.error).toContain(UUID_V1);
      });

      it('should fail for a UUID v3 string (version digit = 3)', () => {
        const result = UUID.parse(UUID_V3);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid UUID format');
      });

      it('should fail for a UUID v5 string (version digit = 5)', () => {
        const result = UUID.parse(UUID_V5);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid UUID format');
      });
    });

    describe('failure cases — invalid variant bits', () => {
      it('should fail when the variant nibble is "c" (not in [89ab])', () => {
        const result = UUID.parse(UUID_WRONG_VARIANT_C);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid UUID format');
      });

      it('should fail when the variant nibble is "7" (not in [89ab])', () => {
        const result = UUID.parse(UUID_WRONG_VARIANT_7);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid UUID format');
      });

      it('should fail when the variant nibble is "f" (not in [89ab])', () => {
        const result = UUID.parse(UUID_WRONG_VARIANT_F);

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid UUID format');
      });
    });

    describe('failure cases — malformed structure', () => {
      it('should fail for an empty string', () => {
        const result = UUID.parse('');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid UUID format');
      });

      it('should fail for a plaintext string with no UUID structure', () => {
        const result = UUID.parse('not-a-uuid');

        expect(result.isFailure).toBe(true);
        expect(result.error).toContain('Invalid UUID format');
      });

      it('should fail for a UUID with all hyphens removed', () => {
        const result = UUID.parse(UUID_NO_HYPHENS);

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a UUID with hyphens in wrong positions', () => {
        const result = UUID.parse(UUID_MISPLACED_HYPHENS);

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a UUID that is one character too short', () => {
        const result = UUID.parse(UUID_TOO_SHORT);

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a UUID that is one character too long', () => {
        const result = UUID.parse(UUID_TOO_LONG);

        expect(result.isFailure).toBe(true);
      });

      it('should fail for a UUID containing non-hexadecimal characters', () => {
        const result = UUID.parse(UUID_NON_HEX);

        expect(result.isFailure).toBe(true);
      });
    });

    describe('failure cases — null / undefined coercion', () => {
      it('should fail when given the string "null"', () => {
        const result = UUID.parse('null');

        expect(result.isFailure).toBe(true);
      });

      it('should fail when given the string "undefined"', () => {
        const result = UUID.parse('undefined');

        expect(result.isFailure).toBe(true);
      });
    });

    describe('error message content', () => {
      it('should embed the invalid value in the error message', () => {
        const bad = 'bad-value';
        const result = UUID.parse(bad);

        expect(result.error).toContain(bad);
      });

      it('should include the expected format hint in the error message', () => {
        const result = UUID.parse('bad-value');

        expect(result.error).toContain(
          'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
        );
      });
    });
  });

  describe('isValid()', () => {
    describe('returns true', () => {
      it('should return true for a lowercase valid UUID v4', () => {
        expect(UUID.isValid(VALID_UUID_V4)).toBe(true);
      });

      it('should return true for an uppercase valid UUID v4 (regex is case-insensitive)', () => {
        expect(UUID.isValid(VALID_UUID_V4.toUpperCase())).toBe(true);
      });

      it('should return true for a mixed-case valid UUID v4', () => {
        const mixed = '550E8400-e29B-41D4-A716-446655440000';

        expect(UUID.isValid(mixed)).toBe(true);
      });

      it('should return true for variant nibble "8"', () => {
        expect(
          UUID.isValid('550e8400-e29b-41d4-8716-446655440000')
        ).toBe(true);
      });

      it('should return true for variant nibble "9"', () => {
        expect(
          UUID.isValid('550e8400-e29b-41d4-9716-446655440000')
        ).toBe(true);
      });

      it('should return true for variant nibble "a"', () => {
        expect(
          UUID.isValid('550e8400-e29b-41d4-a716-446655440000')
        ).toBe(true);
      });

      it('should return true for variant nibble "b"', () => {
        expect(
          UUID.isValid('550e8400-e29b-41d4-b716-446655440000')
        ).toBe(true);
      });
    });

    describe('returns false', () => {
      it('should return false for an empty string', () => {
        expect(UUID.isValid('')).toBe(false);
      });

      it('should return false for a plaintext string', () => {
        expect(UUID.isValid('invalid')).toBe(false);
      });

      it('should return false for a UUID v1 string', () => {
        expect(UUID.isValid(UUID_V1)).toBe(false);
      });

      it('should return false for a UUID v3 string', () => {
        expect(UUID.isValid(UUID_V3)).toBe(false);
      });

      it('should return false for a UUID v5 string', () => {
        expect(UUID.isValid(UUID_V5)).toBe(false);
      });

      it('should return false when the variant nibble is "c"', () => {
        expect(UUID.isValid(UUID_WRONG_VARIANT_C)).toBe(false);
      });

      it('should return false when the variant nibble is "7"', () => {
        expect(UUID.isValid(UUID_WRONG_VARIANT_7)).toBe(false);
      });

      it('should return false for a UUID with no hyphens', () => {
        expect(UUID.isValid(UUID_NO_HYPHENS)).toBe(false);
      });

      it('should return false for a UUID with hyphens in wrong positions', () => {
        expect(UUID.isValid(UUID_MISPLACED_HYPHENS)).toBe(false);
      });

      it('should return false for a string that is one character too short', () => {
        expect(UUID.isValid(UUID_TOO_SHORT)).toBe(false);
      });

      it('should return false for a string that is one character too long', () => {
        expect(UUID.isValid(UUID_TOO_LONG)).toBe(false);
      });

      it('should return false for a UUID containing non-hex characters', () => {
        expect(UUID.isValid(UUID_NON_HEX)).toBe(false);
      });
    });
  });

  describe('equals()', () => {
    it('should return true for two instances parsed from the same string', () => {
      const a = UUID.parse(VALID_UUID_V4).value;
      const b = UUID.parse(VALID_UUID_V4).value;

      expect(a.equals(b)).toBe(true);
    });

    it('should return true when a UUID is compared with itself (self-equality)', () => {
      const uuid = UUID.parse(VALID_UUID_V4).value;

      expect(uuid.equals(uuid)).toBe(true);
    });

    it('should return false for two instances with different values', () => {
      const a = UUID.parse(VALID_UUID_V4).value;
      const b = UUID.parse(ANOTHER_VALID_UUID_V4).value;

      expect(a.equals(b)).toBe(false);
    });

    it('should return false when compared with undefined', () => {
      const uuid = UUID.parse(VALID_UUID_V4).value;

      expect(uuid.equals(undefined)).toBe(false);
    });

    it('should treat the comparison as case-sensitive on the stored value (both sides are lowercase after parse)', () => {
      // parse() normalises to lowercase, so two parsed instances are always
      // comparable by simple string equality — no hidden casing asymmetry.
      const lower = UUID.parse(VALID_UUID_V4).value;
      const fromUpper = UUID.parse(VALID_UUID_V4.toUpperCase()).value;

      expect(lower.equals(fromUpper)).toBe(true);
    });
  });

  describe('toString()', () => {
    it('should return the UUID string', () => {
      const uuid = UUID.parse(VALID_UUID_V4).value;

      expect(uuid.toString()).toBe(VALID_UUID_V4);
    });

    it('should return the same string as value getter', () => {
      const uuid = UUID.parse(VALID_UUID_V4).value;

      expect(uuid.toString()).toBe(uuid.toValue());
    });
  });

  describe('toValue()', () => {
    it('should return the UUID string', () => {
      const uuid = UUID.parse(VALID_UUID_V4).value;

      expect(uuid.toValue()).toBe(VALID_UUID_V4);
    });

    it('should return the same string as value getter', () => {
      const uuid = UUID.parse(VALID_UUID_V4).value;

      expect(uuid.toValue()).toBe(uuid.toValue());
    });
  });

  describe('toString() and toValue() consistency', () => {
    it('should return identical strings for the same instance', () => {
      const uuid = UUID.parse(VALID_UUID_V4).value;

      expect(uuid.toString()).toBe(uuid.toValue());
    });

    it('should return identical strings for a generated UUID', () => {
      const uuid = UUID.create();

      expect(uuid.toString()).toBe(uuid.toValue());
    });
  });
});
