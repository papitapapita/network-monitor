import {
  PollingConfigurationId,
  Result,
  UniqueEntityID
} from '../../../../src/domain/device-inventory';

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

describe('PollingConfigurationId', () => {
  describe('constructor', () => {
    it('should create a new UUID when no id is provided', () => {
      const configId = new PollingConfigurationId();

      expect(configId).toBeInstanceOf(PollingConfigurationId);
      expect(typeof configId.toValue()).toBe('string');
      expect(configId.toValue().length).toBeGreaterThan(10); // UUID formatting expected
    });

    it('should accept a provided string UUID', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const configId = new PollingConfigurationId(rawId);

      expect(configId.toValue()).toBe(rawId);
    });

    it('should throw error when provided with invalid UUID', () => {
      const invalidId = 'not-a-valid-uuid';

      expect(() => new PollingConfigurationId(invalidId)).toThrow();
    });

    it('should throw error when provided with numeric ID', () => {
      const numericId = 12345;

      expect(
        () =>
          new PollingConfigurationId(numericId as unknown as string)
      ).toThrow();
    });

    it('should create a new UUID when provided with empty string', () => {
      const configId = new PollingConfigurationId('');

      expect(configId).toBeInstanceOf(PollingConfigurationId);
      expect(configId.toValue()).toBeDefined();
      expect(configId.toValue().length).toBeGreaterThan(0);
    });

    it('should create different IDs when called multiple times without arguments', () => {
      const configId1 = new PollingConfigurationId();
      const configId2 = new PollingConfigurationId();

      expect(configId1.toValue()).not.toBe(configId2.toValue());
    });
  });

  describe('create static method', () => {
    it('should return success Result when given valid UUID', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const result = PollingConfigurationId.create(rawId);

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingConfigurationId);
      expect(result.value.toValue()).toBe(rawId);
    });

    it('should return failure Result when given invalid UUID', () => {
      const invalidId = 'invalid-uuid-string';
      const result = PollingConfigurationId.create(invalidId);

      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
      expect(typeof result.error).toBe('string');
    });

    it('should return failure Result when given numeric ID', () => {
      const numericId = 12345;
      const result = PollingConfigurationId.create(
        numericId as unknown as string
      );

      expect(result.isFailure).toBe(true);
      expect(result.isSuccess).toBe(false);
    });

    it('should return success Result with new UUID when given empty string', () => {
      const result = PollingConfigurationId.create('');

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingConfigurationId);
      expect(result.value.toValue()).toBeDefined();
    });

    it('should return success Result with new UUID when given null', () => {
      const result = PollingConfigurationId.create(
        null as unknown as string
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingConfigurationId);
      expect(result.value.toValue()).toBeDefined();
    });

    it('should return success Result with new UUID when given undefined', () => {
      const result = PollingConfigurationId.create(
        undefined as unknown as string
      );

      expect(result.isSuccess).toBe(true);
      expect(result.value).toBeInstanceOf(PollingConfigurationId);
      expect(result.value.toValue()).toBeDefined();
    });
  });

  describe('equality and identity', () => {
    it('should be equal when ID values are the same', () => {
      const rawId = 'c5228bee-15a8-420c-a5ca-39d209f944e5';
      const configId1 = new PollingConfigurationId(rawId);
      const configId2 = new PollingConfigurationId(rawId);

      expect(configId1.equals(configId2)).toBe(true);
    });

    it('should not be equal when ID values differ', () => {
      const configId1 = new PollingConfigurationId(
        'c5228bee-15a8-420c-a5ca-39d209f944e5'
      );
      const configId2 = new PollingConfigurationId(
        'c5228bee-15a8-420c-a5ca-39d209f944e3'
      );

      expect(configId1.equals(configId2)).toBe(false);
    });

    it('should not be equal with different UniqueEntityID subclass (identity comparison)', () => {
      const idTest = 'c5228bee-15a8-420c-a5ca-39d209f944e5';
      const configId = new PollingConfigurationId(idTest);
      const testId = TestID.create(idTest);

      expect(configId.equals(testId)).toBe(false);
    });

    it('should not be equal with null', () => {
      const configId = new PollingConfigurationId();

      expect(configId.equals(null as any)).toBe(false);
    });

    it('should not be equal with undefined', () => {
      const configId = new PollingConfigurationId();

      expect(configId.equals(undefined as any)).toBe(false);
    });
  });

  describe('toValue method', () => {
    it('should return the raw UUID string', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const configId = new PollingConfigurationId(rawId);

      expect(configId.toValue()).toBe(rawId);
      expect(typeof configId.toValue()).toBe('string');
    });

    it('should return a valid UUID format', () => {
      const configId = new PollingConfigurationId();
      const value = configId.toValue();

      // UUID v4 format: 8-4-4-4-12 hexadecimal characters
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(value).toMatch(uuidRegex);
    });
  });

  describe('toString method', () => {
    it('should return the UUID string', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const configId = new PollingConfigurationId(rawId);

      expect(configId.toString()).toBe(rawId);
    });

    it('should match toValue result', () => {
      const configId = new PollingConfigurationId();

      expect(configId.toString()).toBe(configId.toValue());
    });
  });

  describe('integration scenarios', () => {
    it('should work correctly when creating from database UUID', () => {
      // Simulate database returning a UUID
      const databaseId = '550e8400-e29b-41d4-a716-446655440000';
      const result = PollingConfigurationId.create(databaseId);

      expect(result.isSuccess).toBe(true);
      expect(result.value.toValue()).toBe(databaseId);
    });

    it('should handle creating new ID for new entity', () => {
      // Simulate creating a new entity that needs a new ID
      const configId = new PollingConfigurationId();

      expect(configId).toBeInstanceOf(PollingConfigurationId);
      expect(configId.toValue()).toBeDefined();
      expect(configId.toValue().length).toBeGreaterThan(0);
    });

    it('should allow comparison of IDs from different sources', () => {
      const rawId = '550e8400-e29b-41d4-a716-446655440000';
      const idFromConstructor = new PollingConfigurationId(rawId);
      const idFromCreate = PollingConfigurationId.create(rawId).value;

      expect(idFromConstructor.equals(idFromCreate)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle UUID with uppercase letters', () => {
      const upperCaseId = '550E8400-E29B-41D4-A716-446655440000';
      const configId = new PollingConfigurationId(upperCaseId);

      expect(configId.toValue()).toBe(upperCaseId.toLowerCase());
    });

    it('should reject UUID with extra whitespace', () => {
      const idWithSpaces = ' 550e8400-e29b-41d4-a716-446655440000 ';

      expect(
        () => new PollingConfigurationId(idWithSpaces)
      ).toThrow();
    });

    it('should reject UUID with missing hyphens', () => {
      const idWithoutHyphens = '550e8400e29b41d4a716446655440000';

      expect(
        () => new PollingConfigurationId(idWithoutHyphens)
      ).toThrow();
    });

    it('should reject partial UUID', () => {
      const partialId = '550e8400-e29b-41d4';

      expect(() => new PollingConfigurationId(partialId)).toThrow();
    });
  });
});
