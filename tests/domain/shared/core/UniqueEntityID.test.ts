// Source: src/domain/shared/core/UniqueEntityID.ts

import { UniqueEntityID } from '../../../../src/domain/shared/core/UniqueEntityID';
import { Result } from '../../../../src/domain/shared/core/Result';
import { Identifier } from '../../../../src/domain/shared/core/Identifier';

// ---------------------------------------------------------------------------
// UUID v4 regex — same pattern used internally by UUID.ts
// ---------------------------------------------------------------------------
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Primary concrete subclass — mirrors how real ID classes are authored.
// Exposes the protected static helpers so they can be exercised directly.
// ---------------------------------------------------------------------------
class TestEntityID extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  /** Factory that auto-generates a UUID when no ID is supplied. */
  public static create(): Result<TestEntityID>;
  public static create(id: string): Result<TestEntityID>;
  public static create(id?: string): Result<TestEntityID> {
    if (id !== undefined) {
      const parsed = TestEntityID.parseId(id);
      if (parsed.isFailure) return Result.fail<TestEntityID>(parsed.error);
      return Result.ok<TestEntityID>(new TestEntityID(parsed.value));
    }
    return Result.ok<TestEntityID>(new TestEntityID(TestEntityID.createId()));
  }

  /**
   * Bypasses parseId() and calls super(id) directly, so that constructor-level
   * invariant violations (thrown by UniqueEntityID) are observable in tests.
   * This simulates what would happen if a subclass author forgot to call parseId()
   * before delegating to the constructor.
   */
  public static createRaw(id: string): TestEntityID {
    return new TestEntityID(id);
  }

  /** Exposes the protected createId() so tests can call it directly. */
  public static exposeCreateId(): string {
    return TestEntityID.createId();
  }

  /** Exposes the protected parseId() so tests can call it directly. */
  public static exposeParseId(id: string): Result<string> {
    return TestEntityID.parseId(id);
  }
}

// ---------------------------------------------------------------------------
// A second concrete subclass — used to verify cross-type equality behaviour.
// ---------------------------------------------------------------------------
class OtherEntityID extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(id?: string): OtherEntityID {
    return new OtherEntityID(id ?? OtherEntityID.createId());
  }
}

// ---------------------------------------------------------------------------
// Well-known UUIDs used across the suite
// ---------------------------------------------------------------------------
const VALID_UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_B = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createTestId(id: string): TestEntityID {
  const result = TestEntityID.create(id);
  if (result.isFailure) throw new Error(`Test setup failed: ${result.error}`);
  return result.value;
}

function createAutoId(): TestEntityID {
  const result = TestEntityID.create();
  if (result.isFailure) throw new Error(`Test setup failed: ${result.error}`);
  return result.value;
}

// ===========================================================================
describe('UniqueEntityID', () => {
  // =========================================================================
  describe('constructor', () => {
    it('should accept a valid UUID v4 string', () => {
      const result = TestEntityID.create(VALID_UUID_A);

      expect(result.isSuccess).toBe(true);
      expect(result.value.toValue()).toBe(VALID_UUID_A);
    });

    it('should throw when the provided ID is not a valid UUID', () => {
      // createRaw() bypasses parseId() so the constructor invariant fires.
      expect(() => TestEntityID.createRaw('not-a-uuid')).toThrow(
        /\[UniqueEntityID\] Invariant violation/
      );
    });

    it('should include the offending value in the thrown error message', () => {
      const badId = 'bad-id-value';
      expect(() => TestEntityID.createRaw(badId)).toThrow(
        new RegExp(`"${badId}" is not a valid UUID v4`)
      );
    });

    it('should throw when an empty string is provided', () => {
      expect(() => TestEntityID.createRaw('')).toThrow(
        /\[UniqueEntityID\] Invariant violation/
      );
    });

    it('should throw when a plain integer string is provided', () => {
      expect(() => TestEntityID.createRaw('12345')).toThrow(
        /\[UniqueEntityID\] Invariant violation/
      );
    });

    it('should throw when a UUID v1-style string is provided', () => {
      // v1 UUID — version nibble is '1', not '4'
      expect(() =>
        TestEntityID.createRaw('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
      ).toThrow(/\[UniqueEntityID\] Invariant violation/);
    });

    it('should throw when a UUID-shaped string has an invalid variant nibble', () => {
      // variant nibble must be [89ab]; '0' is invalid
      expect(() =>
        TestEntityID.createRaw('550e8400-e29b-41d4-0716-446655440000')
      ).toThrow(/\[UniqueEntityID\] Invariant violation/);
    });

    it('should throw when a UUID-shaped string has an invalid version nibble', () => {
      // version nibble must be '4'; '5' is a different UUID version
      expect(() =>
        TestEntityID.createRaw('550e8400-e29b-51d4-a716-446655440000')
      ).toThrow(/\[UniqueEntityID\] Invariant violation/);
    });

    it('should throw when a UUID-shaped string uses non-hex characters', () => {
      expect(() =>
        TestEntityID.createRaw('ZZZZZZZZ-ZZZZ-4ZZZ-aZZZ-ZZZZZZZZZZZZ')
      ).toThrow(/\[UniqueEntityID\] Invariant violation/);
    });

    it('should throw when an incomplete UUID string is provided', () => {
      expect(() =>
        TestEntityID.createRaw('550e8400-e29b-41d4-a716')
      ).toThrow(/\[UniqueEntityID\] Invariant violation/);
    });
  });

  // =========================================================================
  describe('auto-generation via createId()', () => {
    it('should produce a valid UUID v4 when no ID is supplied to create()', () => {
      const id = createAutoId();

      expect(UUID_V4_REGEX.test(id.toValue())).toBe(true);
    });

    it('should produce a string value when no ID is supplied', () => {
      const id = createAutoId();

      expect(typeof id.toValue()).toBe('string');
    });

    it('should produce different UUIDs on successive calls', () => {
      const id1 = createAutoId();
      const id2 = createAutoId();

      expect(id1.toValue()).not.toBe(id2.toValue());
    });

    it('should generate 100 distinct UUIDs without collisions', () => {
      const values = new Set<string>();
      const count = 100;

      for (let i = 0; i < count; i++) {
        values.add(createAutoId().toValue());
      }

      expect(values.size).toBe(count);
    });

    it('should produce a Result.ok when create() is called without an ID', () => {
      const result = TestEntityID.create();

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
    });
  });

  // =========================================================================
  describe('toValue()', () => {
    it('should return the exact UUID string passed to the constructor', () => {
      const id = createTestId(VALID_UUID_A);

      expect(id.toValue()).toBe(VALID_UUID_A);
    });

    it('should return a string type', () => {
      const id = createAutoId();

      expect(typeof id.toValue()).toBe('string');
    });

    it('should return a value that matches the UUID v4 regex', () => {
      const id = createAutoId();

      expect(UUID_V4_REGEX.test(id.toValue())).toBe(true);
    });
  });

  // =========================================================================
  describe('toString()', () => {
    it('should return the same string as toValue()', () => {
      const id = createTestId(VALID_UUID_A);

      expect(id.toString()).toBe(id.toValue());
    });

    it('should return a string type', () => {
      const id = createAutoId();

      expect(typeof id.toString()).toBe('string');
    });

    it('should return a value that matches the UUID v4 regex', () => {
      const id = createAutoId();

      expect(UUID_V4_REGEX.test(id.toString())).toBe(true);
    });
  });

  // =========================================================================
  describe('equals()', () => {
    it('should return true when both instances hold the same UUID', () => {
      const id1 = createTestId(VALID_UUID_A);
      const id2 = createTestId(VALID_UUID_A);

      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false when the two instances hold different UUIDs', () => {
      const id1 = createTestId(VALID_UUID_A);
      const id2 = createAutoId();

      expect(id1.equals(id2)).toBe(false);
    });

    it('should return false when compared against null', () => {
      const id = createAutoId();

      // Identifier.equals accepts Identifier<string>; null is cast to test the guard
      expect(id.equals(null as unknown as Identifier<string>)).toBe(false);
    });

    it('should return false when compared against undefined', () => {
      const id = createAutoId();

      expect(id.equals(undefined as unknown as Identifier<string>)).toBe(false);
    });

    it('should return false when comparing instances of different concrete subclasses even with the same UUID', () => {
      // Identifier.equals checks `id instanceof this.constructor`, so a
      // TestEntityID and an OtherEntityID with the same raw UUID must NOT be equal.
      const id1 = createTestId(VALID_UUID_A);
      const id2 = OtherEntityID.create(VALID_UUID_A);

      expect(id1.equals(id2)).toBe(false);
    });

    it('should be reflexive — an instance equals itself', () => {
      const id = createAutoId();

      expect(id.equals(id)).toBe(true);
    });

    it('should be symmetric — if a equals b then b equals a', () => {
      const id1 = createTestId(VALID_UUID_A);
      const id2 = createTestId(VALID_UUID_A);

      expect(id1.equals(id2)).toBe(true);
      expect(id2.equals(id1)).toBe(true);
    });

    it('should return false for two auto-generated IDs', () => {
      const id1 = createAutoId();
      const id2 = createAutoId();

      // Probabilistically guaranteed — two random UUIDs will not collide.
      expect(id1.equals(id2)).toBe(false);
    });
  });

  // =========================================================================
  describe('isValid() static method', () => {
    it('should return true for a well-formed UUID v4 string', () => {
      expect(UniqueEntityID.isValid(VALID_UUID_A)).toBe(true);
    });

    it('should return true for a UUID v4 with uppercase hex digits', () => {
      // RFC 4122 is case-insensitive — the regex uses the /i flag
      expect(UniqueEntityID.isValid('550E8400-E29B-41D4-A716-446655440000')).toBe(
        true
      );
    });

    it('should return false for an empty string', () => {
      expect(UniqueEntityID.isValid('')).toBe(false);
    });

    it('should return false for a plain word string', () => {
      expect(UniqueEntityID.isValid('not-a-uuid')).toBe(false);
    });

    it('should return false for a numeric-only string', () => {
      expect(UniqueEntityID.isValid('12345')).toBe(false);
    });

    it('should return false for an incomplete UUID', () => {
      expect(UniqueEntityID.isValid('550e8400-e29b-41d4-a716')).toBe(false);
    });

    it('should return false for a UUID with a non-4 version nibble', () => {
      // version nibble is '1' — UUID v1
      expect(UniqueEntityID.isValid(VALID_UUID_B)).toBe(false);
    });

    it('should return false for a UUID with an invalid variant nibble', () => {
      // variant nibble '0' is not in [89ab]
      expect(
        UniqueEntityID.isValid('550e8400-e29b-41d4-0716-446655440000')
      ).toBe(false);
    });

    it('should return false for a UUID containing non-hex characters', () => {
      expect(
        UniqueEntityID.isValid('ZZZZZZZZ-ZZZZ-4ZZZ-aZZZ-ZZZZZZZZZZZZ')
      ).toBe(false);
    });

    it('should return false for a UUID with extra segments', () => {
      expect(
        UniqueEntityID.isValid('550e8400-e29b-41d4-a716-446655440000-extra')
      ).toBe(false);
    });

    it('should return false for a UUID missing hyphens', () => {
      expect(UniqueEntityID.isValid('550e8400e29b41d4a716446655440000')).toBe(
        false
      );
    });
  });

  // =========================================================================
  describe('parseId() protected static method', () => {
    // Exercised through TestEntityID.exposeParseId() which simply delegates
    // to the inherited protected static method.

    it('should return Result.ok containing the UUID string for a valid UUID', () => {
      const result = TestEntityID.exposeParseId(VALID_UUID_A);

      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(typeof result.value).toBe('string');
      expect(UUID_V4_REGEX.test(result.value)).toBe(true);
    });

    it('should normalise the UUID to lowercase when parsing', () => {
      const upperCaseUuid = '550E8400-E29B-41D4-A716-446655440000';
      const result = TestEntityID.exposeParseId(upperCaseUuid);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBe(upperCaseUuid.toLowerCase());
    });

    it('should return Result.fail for a non-UUID string', () => {
      const result = TestEntityID.exposeParseId('not-a-uuid');

      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
    });

    it('should return Result.fail for an empty string', () => {
      const result = TestEntityID.exposeParseId('');

      expect(result.isFailure).toBe(true);
    });

    it('should return Result.fail for a UUID with a non-4 version nibble', () => {
      const result = TestEntityID.exposeParseId(VALID_UUID_B);

      expect(result.isFailure).toBe(true);
    });

    it('should return Result.fail for an incomplete UUID', () => {
      const result = TestEntityID.exposeParseId('550e8400-e29b-41d4-a716');

      expect(result.isFailure).toBe(true);
    });

    it('should include a descriptive error message on failure', () => {
      const result = TestEntityID.exposeParseId('bad-input');

      expect(result.isFailure).toBe(true);
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });

    it('should return Result.ok whose value can be used to construct a valid ID', () => {
      const parsed = TestEntityID.exposeParseId(VALID_UUID_A);
      expect(parsed.isSuccess).toBe(true);

      // The parsed value must round-trip through the constructor without throwing
      const id = TestEntityID.create(parsed.value);
      expect(id.isSuccess).toBe(true);
      expect(id.value.toValue()).toBe(VALID_UUID_A.toLowerCase());
    });
  });

  // =========================================================================
  describe('createId() protected static method', () => {
    // Exercised through TestEntityID.exposeCreateId() which simply delegates
    // to the inherited protected static method.

    it('should return a string', () => {
      const raw = TestEntityID.exposeCreateId();

      expect(typeof raw).toBe('string');
    });

    it('should return a valid UUID v4 string', () => {
      const raw = TestEntityID.exposeCreateId();

      expect(UUID_V4_REGEX.test(raw)).toBe(true);
    });

    it('should satisfy UniqueEntityID.isValid()', () => {
      const raw = TestEntityID.exposeCreateId();

      expect(UniqueEntityID.isValid(raw)).toBe(true);
    });

    it('should produce a different value on each call', () => {
      const raw1 = TestEntityID.exposeCreateId();
      const raw2 = TestEntityID.exposeCreateId();

      expect(raw1).not.toBe(raw2);
    });

    it('should return a value that can be passed directly to the constructor without throwing', () => {
      const raw = TestEntityID.exposeCreateId();

      expect(() => TestEntityID.create(raw)).not.toThrow();
    });
  });

  // =========================================================================
  describe('inheritance and structural guarantees', () => {
    it('should be an instance of Identifier', () => {
      const id = createAutoId();

      expect(id).toBeInstanceOf(Identifier);
    });

    it('should be an instance of UniqueEntityID', () => {
      const id = createAutoId();

      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should be an instance of the concrete subclass', () => {
      const id = createAutoId();

      expect(id).toBeInstanceOf(TestEntityID);
    });

    it('should NOT be considered an instance of a sibling concrete subclass', () => {
      const id = createAutoId();

      expect(id).not.toBeInstanceOf(OtherEntityID);
    });
  });
});
