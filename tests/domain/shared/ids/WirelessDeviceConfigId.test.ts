// Source: src/domain/shared/ids/WirelessDeviceConfigId.ts

import {
  WirelessDeviceConfigId,
  Result,
  UniqueEntityID
} from '../../../../src/domain/shared';

// ---------------------------------------------------------------------------
// TestID — a sibling UniqueEntityID subclass used exclusively to verify that
// equals() enforces class-level type safety (same UUID value, different class).
// ---------------------------------------------------------------------------
class TestID extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static withUuid(id: string): TestID {
    return new TestID(id);
  }
}

// ---------------------------------------------------------------------------
// Shared fixture UUIDs — RFC 4122 v4 compliant strings used across suites.
// ---------------------------------------------------------------------------
const VALID_UUID_A = 'b3d9e1f2-4a5c-4b6d-8e7f-9a0b1c2d3e4f';
const VALID_UUID_B = '550e8400-e29b-41d4-a716-446655440000';

// ---------------------------------------------------------------------------

describe('WirelessDeviceConfigId', () => {
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('should return a WirelessDeviceConfigId instance', () => {
      const id = WirelessDeviceConfigId.create();

      expect(id).toBeInstanceOf(WirelessDeviceConfigId);
    });

    it('should also be an instance of UniqueEntityID', () => {
      const id = WirelessDeviceConfigId.create();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should expose a toValue() that returns a non-empty string', () => {
      const id = WirelessDeviceConfigId.create();

      expect(typeof id.toValue()).toBe('string');
      expect(id.toValue().length).toBeGreaterThan(0);
    });

    it('should generate a value that conforms to RFC 4122 UUID v4 format', () => {
      const uuid = WirelessDeviceConfigId.create().toValue();
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      expect(uuid).toMatch(uuidV4Regex);
    });

    it('should produce a unique ID on each invocation', () => {
      const idA = WirelessDeviceConfigId.create().toValue();
      const idB = WirelessDeviceConfigId.create().toValue();

      expect(idA).not.toBe(idB);
    });

    it('should produce unique IDs across many consecutive calls', () => {
      const values = Array.from({ length: 20 }, () =>
        WirelessDeviceConfigId.create().toValue()
      );
      const uniqueValues = new Set(values);

      expect(uniqueValues.size).toBe(20);
    });
  });

  // -------------------------------------------------------------------------
  describe('parse()', () => {
    describe('when given a valid UUID v4 string', () => {
      it('should return a successful Result', () => {
        const result = WirelessDeviceConfigId.parse(VALID_UUID_A);

        expect(result.isSuccess).toBe(true);
        expect(result.isFailure).toBe(false);
      });

      it('should wrap a WirelessDeviceConfigId in the Result value', () => {
        const result = WirelessDeviceConfigId.parse(VALID_UUID_A);

        expect(result.value).toBeInstanceOf(WirelessDeviceConfigId);
      });

      it('should preserve the exact UUID string provided', () => {
        const result = WirelessDeviceConfigId.parse(VALID_UUID_A);

        expect(result.value.toValue()).toBe(VALID_UUID_A);
      });

      it('should accept a second valid UUID and preserve it', () => {
        const result = WirelessDeviceConfigId.parse(VALID_UUID_B);

        expect(result.isSuccess).toBe(true);
        expect(result.value.toValue()).toBe(VALID_UUID_B);
      });

      it('should accept a UUID with uppercase letters and normalise it to lowercase', () => {
        const upperCaseUuid = VALID_UUID_A.toUpperCase();
        const result = WirelessDeviceConfigId.parse(upperCaseUuid);

        expect(result.isSuccess).toBe(true);
        expect(result.value.toValue()).toBe(
          VALID_UUID_A.toLowerCase()
        );
      });
    });

    describe('when given an invalid input', () => {
      it('should return a failure Result for a plain non-UUID string', () => {
        const result = WirelessDeviceConfigId.parse('not-a-uuid');

        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });

      it('should return a failure Result for a numeric string', () => {
        const result = WirelessDeviceConfigId.parse('12345');

        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });

      it('should return a failure Result for an empty string', () => {
        const result = WirelessDeviceConfigId.parse('');

        expect(result.isFailure).toBe(true);
        expect(result.isSuccess).toBe(false);
      });

      it('should return a failure Result for a UUID missing its hyphens', () => {
        const result = WirelessDeviceConfigId.parse(
          'b3d9e1f24a5c4b6d8e7f9a0b1c2d3e4f'
        );

        expect(result.isFailure).toBe(true);
      });

      it('should return a failure Result for a UUID with leading whitespace', () => {
        const result = WirelessDeviceConfigId.parse(
          ` ${VALID_UUID_A}`
        );

        expect(result.isFailure).toBe(true);
      });

      it('should return a failure Result for a UUID with trailing whitespace', () => {
        const result = WirelessDeviceConfigId.parse(
          `${VALID_UUID_A} `
        );

        expect(result.isFailure).toBe(true);
      });

      it('should return a failure Result for a partial UUID', () => {
        const result = WirelessDeviceConfigId.parse(
          'b3d9e1f2-4a5c-4b6d'
        );

        expect(result.isFailure).toBe(true);
      });

      it('should include a non-empty error string on failure', () => {
        const result = WirelessDeviceConfigId.parse('not-a-uuid');

        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      });

      it('should throw when accessing value on a failed Result', () => {
        const result = WirelessDeviceConfigId.parse('not-a-uuid');

        expect(() => result.value).toThrow();
      });
    });
  });

  // -------------------------------------------------------------------------
  describe('toValue()', () => {
    it('should return a string for an ID created with create()', () => {
      const id = WirelessDeviceConfigId.create();

      expect(typeof id.toValue()).toBe('string');
    });

    it('should return the exact UUID string for an ID created with parse()', () => {
      const id = WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(id.toValue()).toBe(VALID_UUID_A);
    });
  });

  // -------------------------------------------------------------------------
  describe('toString()', () => {
    it('should return the same value as toValue() for a parsed ID', () => {
      const id = WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(id.toString()).toBe(id.toValue());
    });

    it('should return the same value as toValue() for a generated ID', () => {
      const id = WirelessDeviceConfigId.create();

      expect(id.toString()).toBe(id.toValue());
    });
  });

  // -------------------------------------------------------------------------
  describe('equals()', () => {
    it('should return true when two WirelessDeviceConfigIds share the same UUID', () => {
      const idA = WirelessDeviceConfigId.parse(VALID_UUID_A).value;
      const idB = WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(idA.equals(idB)).toBe(true);
    });

    it('should return false when two WirelessDeviceConfigIds have different UUIDs', () => {
      const idA = WirelessDeviceConfigId.parse(VALID_UUID_A).value;
      const idB = WirelessDeviceConfigId.parse(VALID_UUID_B).value;

      expect(idA.equals(idB)).toBe(false);
    });

    it('should return false when compared to a different UniqueEntityID subclass with the same UUID', () => {
      const configId =
        WirelessDeviceConfigId.parse(VALID_UUID_A).value;
      const testId = TestID.withUuid(VALID_UUID_A);

      expect(configId.equals(testId)).toBe(false);
    });

    it('should return false when compared to null', () => {
      const id = WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(id.equals(null as unknown as UniqueEntityID)).toBe(
        false
      );
    });

    it('should return false when compared to undefined', () => {
      const id = WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(id.equals(undefined as unknown as UniqueEntityID)).toBe(
        false
      );
    });

    it('should be reflexive — an ID equals itself', () => {
      const id = WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(id.equals(id)).toBe(true);
    });

    it('should be symmetric — if A equals B then B equals A', () => {
      const idA = WirelessDeviceConfigId.parse(VALID_UUID_A).value;
      const idB = WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(idA.equals(idB)).toBe(true);
      expect(idB.equals(idA)).toBe(true);
    });

    it('should be transitive — if A equals B and B equals C then A equals C', () => {
      const idA = WirelessDeviceConfigId.parse(VALID_UUID_A).value;
      const idB = WirelessDeviceConfigId.parse(VALID_UUID_A).value;
      const idC = WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(idA.equals(idB)).toBe(true);
      expect(idB.equals(idC)).toBe(true);
      expect(idA.equals(idC)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  describe('Result integration', () => {
    it('should return a properly formed Result on a successful parse', () => {
      const result: Result<WirelessDeviceConfigId> =
        WirelessDeviceConfigId.parse(VALID_UUID_A);

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBeInstanceOf(WirelessDeviceConfigId);
    });

    it('should return a properly formed Result on a failed parse', () => {
      const result: Result<WirelessDeviceConfigId> =
        WirelessDeviceConfigId.parse('bad-id');

      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should allow two IDs parsed from the same UUID to be considered equal', () => {
      const parsedId =
        WirelessDeviceConfigId.parse(VALID_UUID_A).value;
      const secondParsedId =
        WirelessDeviceConfigId.parse(VALID_UUID_A).value;

      expect(parsedId.equals(secondParsedId)).toBe(true);
    });
  });
});
