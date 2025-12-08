import { PollingResultId } from '../../../src/domain/entities/PollingResultId';
import {
  Result,
  UniqueEntityID
} from '../../../src/domain/shared/kernel';

class TestID extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<TestID> | TestID {
    const testID = new TestID(id);

    if (!testID) {
      return Result.fail<TestID>('Failed to create TestID');
    }

    return testID;
  }
}

describe('PollingResultId', () => {
  describe('create static method', () => {
    it('should return success Result when given valid UUID', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const result = PollingResultId.create(rawId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingResultId);
      expect(result.value.toValue()).toBe(rawId);
    });

    it('should return failure Result when given invalid UUID', () => {
      const invalidId = 'invalid-uuid-string';
      const result = PollingResultId.create(invalidId);

      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(typeof result.error).toBe('string');
    });

    it('should return failure Result when given numeric ID', () => {
      const numericId = 12345;
      const result = PollingResultId.create(numericId as unknown as string);

      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
    });

    it('should return success Result with new UUID when given empty string', () => {
      const result = PollingResultId.create('');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingResultId);
      expect(result.value.toValue()).toBeDefined();
      expect(result.value.toValue().length).toBeGreaterThan(0);
    });

    it('should return success Result with new UUID when given null', () => {
      const result = PollingResultId.create(null as unknown as string);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingResultId);
      expect(result.value.toValue()).toBeDefined();
    });

    it('should return success Result with new UUID when given undefined', () => {
      const result = PollingResultId.create(undefined as unknown as string);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingResultId);
      expect(result.value.toValue()).toBeDefined();
    });

    it('should create different IDs when called multiple times without arguments', () => {
      const result1 = PollingResultId.create(undefined as unknown as string);
      const result2 = PollingResultId.create(undefined as unknown as string);

      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
      expect(result1.value.toValue()).not.toBe(result2.value.toValue());
    });
  });

  describe('equality and identity', () => {
    it('should be equal when ID values are the same', () => {
      const rawId = 'c5228bee-15a8-420c-a5ca-39d209f944e5';
      const resultId1 = PollingResultId.create(rawId).value;
      const resultId2 = PollingResultId.create(rawId).value;

      expect(resultId1.equals(resultId2)).toBe(true);
    });

    it('should not be equal when ID values differ', () => {
      const resultId1 = PollingResultId.create('c5228bee-15a8-420c-a5ca-39d209f944e5').value;
      const resultId2 = PollingResultId.create('c5228bee-15a8-420c-a5ca-39d209f944e3').value;

      expect(resultId1.equals(resultId2)).toBe(false);
    });

    it('should not be equal with different UniqueEntityID subclass (identity comparison)', () => {
      const idTest = 'c5228bee-15a8-420c-a5ca-39d209f944e5';
      const resultId = PollingResultId.create(idTest).value;
      const testId = TestID.create(idTest);

      expect(resultId.equals(testId)).toBe(false);
    });

    it('should not be equal with null', () => {
      const resultId = PollingResultId.create('c5228bee-15a8-420c-a5ca-39d209f944e5').value;

      expect(resultId.equals(null as any)).toBe(false);
    });

    it('should not be equal with undefined', () => {
      const resultId = PollingResultId.create('c5228bee-15a8-420c-a5ca-39d209f944e5').value;

      expect(resultId.equals(undefined as any)).toBe(false);
    });
  });

  describe('toValue method', () => {
    it('should return the raw UUID string', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const resultId = PollingResultId.create(rawId).value;

      expect(resultId.toValue()).toBe(rawId);
      expect(typeof resultId.toValue()).toBe('string');
    });

    it('should return a valid UUID format', () => {
      const resultId = PollingResultId.create(undefined as unknown as string).value;
      const value = resultId.toValue();

      // UUID v4 format: 8-4-4-4-12 hexadecimal characters
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(value).toMatch(uuidRegex);
    });
  });

  describe('toString method', () => {
    it('should return the UUID string', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const resultId = PollingResultId.create(rawId).value;

      expect(resultId.toString()).toBe(rawId);
    });

    it('should match toValue result', () => {
      const resultId = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000').value;

      expect(resultId.toString()).toBe(resultId.toValue());
    });
  });

  describe('integration scenarios', () => {
    it('should work correctly when creating from database UUID', () => {
      // Simulate database returning a UUID
      const databaseId = '550e8400-e29b-41d4-a716-446655440000';
      const result = PollingResultId.create(databaseId);

      expect(result.isSuccess).toBe(true);
      expect(result.value.toValue()).toBe(databaseId);
    });

    it('should handle creating new ID for new polling result', () => {
      // Simulate creating a new polling result that needs a new ID
      const result = PollingResultId.create(undefined as unknown as string);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingResultId);
      expect(result.value.toValue()).toBeDefined();
      expect(result.value.toValue().length).toBeGreaterThan(0);
    });

    it('should allow comparison of IDs from different sources', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const idFromCreate1 = PollingResultId.create(rawId).value;
      const idFromCreate2 = PollingResultId.create(rawId).value;

      expect(idFromCreate1.equals(idFromCreate2)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should normalize UUID to lowercase (case-insensitive)', () => {
      const upperCaseId = '550E8400-E29B-41D4-A716-446655440000';
      const result = PollingResultId.create(upperCaseId);

      expect(result.isSuccess).toBe(true);
      expect(result.value.toValue()).toBe(upperCaseId.toLowerCase());
    });

    it('should reject UUID with extra whitespace', () => {
      const idWithSpaces = ' 550e8400-e29b-41d4-a716-446655440000 ';
      const result = PollingResultId.create(idWithSpaces);

      expect(result.isFailure).toBe(true);
    });

    it('should reject UUID with missing hyphens', () => {
      const idWithoutHyphens = '550e8400e29b41d4a716446655440000';
      const result = PollingResultId.create(idWithoutHyphens);

      expect(result.isFailure).toBe(true);
    });

    it('should reject partial UUID', () => {
      const partialId = '550e8400-e29b-41d4';
      const result = PollingResultId.create(partialId);

      expect(result.isFailure).toBe(true);
    });

    it('should handle error objects correctly', () => {
      const invalidId = 'not-a-uuid';
      const result = PollingResultId.create(invalidId);

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    });

    it('should reject boolean as ID', () => {
      const result = PollingResultId.create(true as unknown as string);

      expect(result.isFailure).toBe(true);
    });

    it('should reject object as ID', () => {
      const result = PollingResultId.create({} as unknown as string);

      expect(result.isFailure).toBe(true);
    });

    it('should reject array as ID', () => {
      const result = PollingResultId.create([] as unknown as string);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('type safety', () => {
    it('should only accept string parameter (type checking)', () => {
      const validId = '550e8400-e29b-41d4-a716-446655440000';
      const result = PollingResultId.create(validId);

      expect(result.isSuccess).toBe(true);
    });

    it('should be instance of PollingResultId', () => {
      const result = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000');

      expect(result.value).toBeInstanceOf(PollingResultId);
      expect(result.value).toBeInstanceOf(UniqueEntityID);
    });
  });

  describe('Result pattern consistency', () => {
    it('should return Result object with isSuccess property', () => {
      const result = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000');

      expect(result).toHaveProperty('isSuccess');
      expect(result).toHaveProperty('isFailure');
      expect(typeof result.isSuccess).toBe('boolean');
      expect(typeof result.isFailure).toBe('boolean');
    });

    it('should have mutually exclusive isSuccess and isFailure', () => {
      const successResult = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000');
      expect(successResult.isSuccess).toBe(true);
      expect(successResult.isFailure).toBe(false);

      const failureResult = PollingResultId.create('invalid');
      expect(failureResult.isSuccess).toBe(false);
      expect(failureResult.isFailure).toBe(true);
    });

    it('should provide value property on success', () => {
      const result = PollingResultId.create('550e8400-e29b-41d4-a716-446655440000');

      expect(result.value).toBeDefined();
      expect(result.value).toBeInstanceOf(PollingResultId);
    });

    it('should provide error property on failure', () => {
      const result = PollingResultId.create('invalid-uuid');

      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });
});
