import {
  Result,
  UniqueEntityID
} from '../../../src/domain/shared/kernel';
import { validate as validateUuid } from 'uuid';

// Concrete test implementation since UniqueEntityID is abstract
class TestEntityID extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<TestEntityID> {
    const entityId = new TestEntityID(id);

    if (!entityId) {
      Result.fail<TestEntityID>('Failed to create TestEntityID');
    }
    return Result.ok<TestEntityID>(entityId);
  }
}

describe('UniqueEntityID', () => {
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  describe('Constructor behavior', () => {
    it('should generate a valid UUID when no ID is provided', () => {
      const id = TestEntityID.create().value;
      const value = id.toValue();

      expect(typeof value).toBe('string');
      expect(UUID_REGEX.test(value)).toBe(true);
      expect(validateUuid(value)).toBe(true);
    });

    it('should accept a valid UUID string', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      const id = TestEntityID.create(validUuid).value;

      expect(id.toValue()).toBe(validUuid);
    });

    it('should throw error for invalid UUID string', () => {
      const invalidId = 'my-custom-id-123';

      expect(() => TestEntityID.create(invalidId)).toThrow();
      expect(() => TestEntityID.create(invalidId)).toThrow(
        /Invalid UUID format/
      );
    });

    it('should throw error for non-UUID formatted strings', () => {
      const testCases = ['abc', '12345', 'not-a-uuid'];

      testCases.forEach((invalidId) => {
        expect(() => TestEntityID.create(invalidId)).toThrow();
        expect(() => TestEntityID.create(invalidId)).toThrow(
          /Invalid UUID format/
        );
      });
    });
  });

  describe('Value methods', () => {
    it('should return the UUID value via toValue()', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const id = TestEntityID.create(uuid).value;

      expect(id.toValue()).toBe(uuid);
    });

    it('should return the UUID value via toString()', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const id = TestEntityID.create(uuid).value;

      expect(id.toString()).toBe(uuid);
    });
  });

  describe('Equality comparison', () => {
    it('should return true when comparing two instances with the same UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const id1 = TestEntityID.create(uuid).value;
      const id2 = TestEntityID.create(uuid).value;

      expect(id1.equals(id2)).toBe(true);
    });

    it('should return false when comparing two instances with different UUIDs', () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const id1 = TestEntityID.create(uuid1).value;
      const id2 = TestEntityID.create(uuid2).value;

      expect(id1.equals(id2)).toBe(false);
    });

    it('should return false when comparing with null', () => {
      const id = TestEntityID.create().value;
      expect(id.equals(null)).toBe(false);
    });

    it('should return false when comparing with undefined', () => {
      const id = TestEntityID.create().value;
      expect(id.equals(undefined)).toBe(false);
    });
  });

  describe('UUID generation', () => {
    it('should generate different UUIDs for each instance', () => {
      const id1 = TestEntityID.create().value;
      const id2 = TestEntityID.create().value;
      const value1 = id1.toValue();
      const value2 = id2.toValue();

      expect(value1).not.toBe(value2);
      expect(UUID_REGEX.test(value1)).toBe(true);
      expect(UUID_REGEX.test(value2)).toBe(true);
    });

    it('should generate multiple unique UUIDs', () => {
      const ids = new Set<string>();
      const count = 100;

      for (let i = 0; i < count; i++) {
        const result = TestEntityID.create();
        expect(result.isSuccess).toBe(true);
        ids.add(result.value.toValue());
      }

      expect(ids.size).toBe(count);
    });
  });

  describe('Static validation method', () => {
    it('should validate correct UUID format', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(TestEntityID.isValid(validUuid)).toBe(true);
    });

    it('should reject invalid UUID format', () => {
      const invalidCases = [
        'my-custom-id',
        '12345',
        'not-a-uuid',
        '',
        '550e8400-e29b-41d4-a716', // incomplete
        'ZZZZZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZZZZZZZZZ' // invalid characters
      ];

      invalidCases.forEach((invalidId) => {
        expect(TestEntityID.isValid(invalidId)).toBe(false);
      });
    });
  });
});
