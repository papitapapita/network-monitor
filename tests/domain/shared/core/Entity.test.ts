import {
  Result,
  UniqueEntityID,
  Entity
} from '../../../src/domain/shared/core';

interface TestProps {
  name: string;
  age: number;
}

class TestID extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): Result<TestID> {
    const testID = new TestID(id);

    if (!testID) {
      return Result.fail<TestID>('Failed to create TestID');
    }

    return Result.ok<TestID>(testID);
  }
}

class TestEntity extends Entity<TestProps, TestID> {
  private constructor(props: TestProps, id?: TestID) {
    if (!id) {
      id = TestID.create().value;
    }
    super(props, id);
  }

  public static create(props: TestProps, id?: TestID): TestEntity {
    const entity = new TestEntity(props, id);
    if (!entity) {
      Result.fail<TestEntity>('Failed to create TestEntity');
    }
    return Result.ok<TestEntity>(entity).value;
  }

  get name() {
    return this.props.name;
  }

  get age() {
    return this.props.age;
  }
}

describe('Entity Base Class', () => {
  it('should create an entity with an automatically generated ID', () => {
    const entity = TestEntity.create({ name: 'Alice', age: 30 });

    expect(entity.id).toBeInstanceOf(UniqueEntityID);
    expect(typeof entity.id.toValue()).toBe('string');
  });

  it('should create an entity with a provided ID', () => {
    const customId = '550e8400-e29b-41d4-a716-446655440000';
    const predefinedId = TestID.create(customId).value;
    const entity = TestEntity.create(
      { name: 'Bob', age: 40 },
      predefinedId
    );

    expect(entity.id.toValue()).toBe(customId);
  });

  it('should store and expose props', () => {
    const props: TestProps = { name: 'Carlos', age: 25 };
    const entity = TestEntity.create(props);

    expect(entity.name).toBe(props.name);
    expect(entity.age).toBe(props.age);
  });

  describe('equals()', () => {
    it('should return false when comparing with null or undefined', () => {
      const e1 = TestEntity.create({ name: 'A', age: 20 });

      expect(e1.equals(null as any)).toBe(false);
      expect(e1.equals(undefined)).toBe(false);
    });

    it('should return true when comparing with itself (same reference)', () => {
      const e1 = TestEntity.create({ name: 'B', age: 22 });

      expect(e1.equals(e1)).toBe(true);
    });

    it('should return true for two different instances with the same ID', () => {
      const sharedId = TestID.create(
        '550e8400-e29b-41d4-a716-446655440000'
      ).value;

      const e1 = TestEntity.create({ name: 'A', age: 20 }, sharedId);
      const e2 = TestEntity.create({ name: 'A', age: 20 }, sharedId);

      expect(e1.equals(e2)).toBe(true);
    });

    it('should return false for two entities with different IDs', () => {
      const e1 = TestEntity.create({ name: 'A', age: 20 });
      const e2 = TestEntity.create({ name: 'A', age: 20 });

      expect(e1.equals(e2)).toBe(false); // auto-generated IDs differ
    });

    it('should return false when comparing with a non-entity object', () => {
      const e1 = TestEntity.create({ name: 'A', age: 20 });
      const notEntity = { id: e1.id };

      expect(e1.equals(notEntity as Entity<TestProps, TestID>)).toBe(
        false
      );
    });
  });
});
