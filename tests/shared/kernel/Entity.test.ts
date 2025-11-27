import { Entity } from '../../../src/domain/shared/kernel/Entity';
import { UniqueEntityID } from '../../../src/domain/shared/kernel/UniqueEntityID';

interface TestProps {
  name: string;
  age: number;
}

class TestEntity extends Entity<TestProps> {
  get name() {
    return this.props.name;
  }

  get age() {
    return this.props.age;
  }
}

describe('Entity Base Class', () => {
  it('should create an entity with an automatically generated ID', () => {
    const entity = new TestEntity({ name: 'Alice', age: 30 });

    expect(entity.id).toBeInstanceOf(UniqueEntityID);
    expect(typeof entity.id.toValue()).toBe('string');
  });

  it('should create an entity with a provided ID', () => {
    const customId = 'custom-id';
    const predefinedId = new UniqueEntityID(customId);
    const entity = new TestEntity(
      { name: 'Bob', age: 40 },
      predefinedId
    );

    expect(entity.id.toValue()).toBe(customId);
  });

  it('should store and expose props', () => {
    const props: TestProps = { name: 'Carlos', age: 25 };
    const entity = new TestEntity(props);

    expect(entity.name).toBe(props.name);
    expect(entity.age).toBe(props.age);
  });

  describe('equals()', () => {
    it('should return false when comparing with null or undefined', () => {
      const e1 = new TestEntity({ name: 'A', age: 20 });

      expect(e1.equals(null as any)).toBe(false);
      expect(e1.equals(undefined)).toBe(false);
    });

    it('should return true when comparing with itself (same reference)', () => {
      const e1 = new TestEntity({ name: 'B', age: 22 });

      expect(e1.equals(e1)).toBe(true);
    });

    it('should return true for two different instances with the same ID', () => {
      const sharedId = new UniqueEntityID('shared-id');

      const e1 = new TestEntity({ name: 'A', age: 20 }, sharedId);
      const e2 = new TestEntity({ name: 'A', age: 20 }, sharedId);

      expect(e1.equals(e2)).toBe(true);
    });

    it('should return false for two entities with different IDs', () => {
      const e1 = new TestEntity({ name: 'A', age: 20 });
      const e2 = new TestEntity({ name: 'A', age: 20 });

      expect(e1.equals(e2)).toBe(false); // auto-generated IDs differ
    });

    it('should return false when comparing with a non-entity object', () => {
      const e1 = new TestEntity({ name: 'A', age: 20 });
      const notEntity = { id: e1.id };

      expect(e1.equals(notEntity as Entity<TestProps>)).toBe(false);
    });
  });
});
