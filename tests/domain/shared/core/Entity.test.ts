// Source: src/domain/shared/core/Entity.ts

import {
  Result,
  UniqueEntityID,
  Entity,
  Identifier
} from '../../../../src/domain/shared/core';

// ---------------------------------------------------------------------------
// UUID v4 regex — mirrors the pattern used internally by UUID.ts
// ---------------------------------------------------------------------------
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Well-known UUID v4 constants used across the suite
// ---------------------------------------------------------------------------
const VALID_UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_B = '6f9619ff-8b86-4c07-ac22-a5d5e5d3a715';

// ---------------------------------------------------------------------------
// TestID — a minimal concrete subclass of UniqueEntityID.
//
// Follows the canonical pattern described in the project conventions:
//   - private constructor that delegates straight to super(id)
//   - static create() that uses the inherited protected helpers
// ---------------------------------------------------------------------------
class TestID extends UniqueEntityID {
  private constructor(id: string) {
    super(id); // id must already be a validated UUID v4 string
  }

  /** Overloads give TypeScript precise return types at each call site. */
  public static create(): Result<TestID>;
  public static create(id: string): Result<TestID>;
  public static create(id?: string): Result<TestID> {
    if (id !== undefined) {
      const parsed = TestID.parseId(id);
      if (parsed.isFailure) return Result.fail<TestID>(parsed.error);
      return Result.ok<TestID>(new TestID(parsed.value));
    }
    return Result.ok<TestID>(new TestID(TestID.createId()));
  }
}

// ---------------------------------------------------------------------------
// A sibling ID type — used to verify that Entity.equals() uses the ID's own
// Identifier.equals() which is class-aware via `instanceof this.constructor`.
// ---------------------------------------------------------------------------
class OtherID extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(id?: string): Result<OtherID> {
    if (id !== undefined) {
      const parsed = OtherID.parseId(id);
      if (parsed.isFailure) return Result.fail<OtherID>(parsed.error);
      return Result.ok<OtherID>(new OtherID(parsed.value));
    }
    return Result.ok<OtherID>(new OtherID(OtherID.createId()));
  }
}

// ---------------------------------------------------------------------------
// TestProps — the shape of state carried by TestEntity
// ---------------------------------------------------------------------------
interface TestProps {
  name: string;
  age: number;
}

// ---------------------------------------------------------------------------
// TestEntity — minimal concrete subclass of Entity<TestProps, TestID>.
//
// create() is a static factory that wraps construction in a Result, as is
// idiomatic throughout this codebase.  The ID is never generated inside the
// Entity base; the caller is responsible for supplying a TestID.
// ---------------------------------------------------------------------------
class TestEntity extends Entity<TestProps, TestID> {
  private constructor(props: TestProps, id: TestID) {
    super(props, id);
  }

  public static create(props: TestProps, id?: TestID): Result<TestEntity> {
    const entityId = id ?? TestID.create().value;
    return Result.ok<TestEntity>(new TestEntity(props, entityId));
  }

  get name(): string {
    return this.props.name;
  }

  get age(): number {
    return this.props.age;
  }
}

// ---------------------------------------------------------------------------
// AnotherEntity — a second entity type sharing the same ID type.
// Used to validate that equals() works across different entity subtypes when
// they share the same ID class.
// ---------------------------------------------------------------------------
interface AnotherProps {
  label: string;
}

class AnotherEntity extends Entity<AnotherProps, TestID> {
  private constructor(props: AnotherProps, id: TestID) {
    super(props, id);
  }

  public static create(
    props: AnotherProps,
    id?: TestID
  ): Result<AnotherEntity> {
    const entityId = id ?? TestID.create().value;
    return Result.ok<AnotherEntity>(new AnotherEntity(props, entityId));
  }

  get label(): string {
    return this.props.label;
  }
}

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

/** Unwraps a Result or throws, keeping test setup failures clearly identifiable. */
function unwrap<T>(result: Result<T>, context: string): T {
  if (result.isFailure) {
    throw new Error(`Test setup failed [${context}]: ${result.error}`);
  }
  return result.value;
}

function makeTestID(uuid?: string): TestID {
  return uuid !== undefined
    ? unwrap(TestID.create(uuid), 'makeTestID with uuid')
    : unwrap(TestID.create(), 'makeTestID auto');
}

function makeEntity(props: TestProps = { name: 'Alice', age: 30 }, id?: TestID): TestEntity {
  return unwrap(TestEntity.create(props, id), 'makeEntity');
}

// ---------------------------------------------------------------------------
// OtherEntity — an entity that uses OtherID instead of TestID.
//
// Used to verify that Entity.equals() returns false when the two entities
// carry ID instances of different concrete subclasses, even when the
// underlying UUID string is identical.  This is guaranteed by
// Identifier.equals() which checks `id instanceof this.constructor`.
// ---------------------------------------------------------------------------
interface OtherProps {
  code: string;
}

class OtherEntity extends Entity<OtherProps, OtherID> {
  private constructor(props: OtherProps, id: OtherID) {
    super(props, id);
  }

  public static create(props: OtherProps, id?: OtherID): Result<OtherEntity> {
    const entityId = id ?? unwrap(OtherID.create(), 'OtherEntity auto id');
    return Result.ok<OtherEntity>(new OtherEntity(props, entityId));
  }

  get code(): string {
    return this.props.code;
  }
}

// ===========================================================================
describe('Entity', () => {
  // =========================================================================
  describe('id getter', () => {
    it('should return a UniqueEntityID instance when the entity is created without an explicit ID', () => {
      const entity = makeEntity();

      expect(entity.id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return a TestID instance when the entity is created without an explicit ID', () => {
      const entity = makeEntity();

      expect(entity.id).toBeInstanceOf(TestID);
    });

    it('should return a value that is a string when the entity is auto-generated', () => {
      const entity = makeEntity();

      expect(typeof entity.id.toValue()).toBe('string');
    });

    it('should return a value that matches UUID v4 format when auto-generated', () => {
      const entity = makeEntity();

      expect(UUID_V4_REGEX.test(entity.id.toValue())).toBe(true);
    });

    it('should return the exact UUID string passed in when a specific ID is provided', () => {
      const id = makeTestID(VALID_UUID_A);
      const entity = makeEntity({ name: 'Bob', age: 40 }, id);

      expect(entity.id.toValue()).toBe(VALID_UUID_A);
    });

    it('should return the same TestID instance that was passed into the factory', () => {
      const id = makeTestID(VALID_UUID_A);
      const entity = makeEntity({ name: 'Bob', age: 40 }, id);

      expect(entity.id).toBe(id);
    });

    it('should produce distinct auto-generated IDs across two independently created entities', () => {
      const e1 = makeEntity();
      const e2 = makeEntity();

      expect(e1.id.toValue()).not.toBe(e2.id.toValue());
    });
  });

  // =========================================================================
  describe('props storage', () => {
    it('should expose the name prop via its getter after creation', () => {
      const props: TestProps = { name: 'Carlos', age: 25 };
      const entity = makeEntity(props);

      expect(entity.name).toBe(props.name);
    });

    it('should expose the age prop via its getter after creation', () => {
      const props: TestProps = { name: 'Carlos', age: 25 };
      const entity = makeEntity(props);

      expect(entity.age).toBe(props.age);
    });

    it('should independently store distinct props for each entity instance', () => {
      const e1 = makeEntity({ name: 'Alice', age: 30 });
      const e2 = makeEntity({ name: 'Bob', age: 45 });

      expect(e1.name).toBe('Alice');
      expect(e1.age).toBe(30);
      expect(e2.name).toBe('Bob');
      expect(e2.age).toBe(45);
    });

    it('should store a name that is an empty string without modification', () => {
      const entity = makeEntity({ name: '', age: 0 });

      expect(entity.name).toBe('');
    });

    it('should store an age of zero without modification', () => {
      const entity = makeEntity({ name: 'Zara', age: 0 });

      expect(entity.age).toBe(0);
    });
  });

  // =========================================================================
  describe('equals()', () => {
    // -----------------------------------------------------------------------
    describe('null and undefined guards', () => {
      it('should return false when called with null', () => {
        const entity = makeEntity();

        // null is cast because the method signature accepts undefined but not
        // null; the implementation defends against it explicitly.
        expect(entity.equals(null as unknown as TestEntity)).toBe(false);
      });

      it('should return false when called with undefined', () => {
        const entity = makeEntity();

        expect(entity.equals(undefined)).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('same-reference (identity) check', () => {
      it('should return true when compared with itself', () => {
        const entity = makeEntity();

        expect(entity.equals(entity)).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('ID-based equality', () => {
      it('should return true for two different instances that share the same ID', () => {
        const sharedId = makeTestID(VALID_UUID_A);
        const e1 = makeEntity({ name: 'Alice', age: 30 }, sharedId);
        const e2 = makeEntity({ name: 'Alice', age: 30 }, sharedId);

        expect(e1.equals(e2)).toBe(true);
      });

      it('should return true even when the two instances carry different props but share the same ID', () => {
        const sharedId = makeTestID(VALID_UUID_A);
        const e1 = makeEntity({ name: 'Alice', age: 30 }, sharedId);
        const e2 = makeEntity({ name: 'Different Name', age: 99 }, sharedId);

        expect(e1.equals(e2)).toBe(true);
      });

      it('should return false for two different instances with independently auto-generated IDs', () => {
        const e1 = makeEntity();
        const e2 = makeEntity();

        expect(e1.equals(e2)).toBe(false);
      });

      it('should return false for two instances created with distinct explicit UUIDs', () => {
        const e1 = makeEntity({ name: 'Alice', age: 30 }, makeTestID(VALID_UUID_A));
        const e2 = makeEntity({ name: 'Alice', age: 30 }, makeTestID(VALID_UUID_B));

        expect(e1.equals(e2)).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('non-entity comparisons', () => {
      it('should return false when compared with a plain object that is not an Entity', () => {
        const entity = makeEntity();
        const plainObject = { id: entity.id };

        expect(entity.equals(plainObject as unknown as TestEntity)).toBe(false);
      });

      it('should return false when compared with a plain object that has matching id and props shapes', () => {
        const id = makeTestID(VALID_UUID_A);
        const entity = makeEntity({ name: 'Alice', age: 30 }, id);
        const imposter = { id, props: { name: 'Alice', age: 30 } };

        expect(entity.equals(imposter as unknown as TestEntity)).toBe(false);
      });

      it('should return false when compared with a number primitive', () => {
        const entity = makeEntity();

        expect(entity.equals(42 as unknown as TestEntity)).toBe(false);
      });

      it('should return false when compared with a string primitive', () => {
        const entity = makeEntity();

        expect(entity.equals(VALID_UUID_A as unknown as TestEntity)).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    describe('symmetry and transitivity invariants', () => {
      it('should be symmetric — if e1 equals e2 then e2 equals e1', () => {
        const sharedId = makeTestID(VALID_UUID_A);
        const e1 = makeEntity({ name: 'Alice', age: 30 }, sharedId);
        const e2 = makeEntity({ name: 'Alice', age: 30 }, sharedId);

        expect(e1.equals(e2)).toBe(true);
        expect(e2.equals(e1)).toBe(true);
      });

      it('should be transitive — if e1 equals e2 and e2 equals e3, e1 equals e3', () => {
        const sharedId = makeTestID(VALID_UUID_A);
        const e1 = makeEntity({ name: 'Alice', age: 30 }, sharedId);
        const e2 = makeEntity({ name: 'Alice', age: 30 }, sharedId);
        const e3 = makeEntity({ name: 'Alice', age: 30 }, sharedId);

        expect(e1.equals(e2)).toBe(true);
        expect(e2.equals(e3)).toBe(true);
        expect(e1.equals(e3)).toBe(true);
      });

      it('should be reflexive — an entity always equals itself', () => {
        const entity = makeEntity();

        expect(entity.equals(entity)).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    describe('cross-entity-type behaviour', () => {
      it('should return true for two different Entity subclass instances that share the same ID instance', () => {
        // Entity.equals() dispatches to this._id.equals(object.id).
        // Identifier.equals() uses `instanceof this.constructor`, meaning
        // TestID.equals(TestID) returns true when both hold the same UUID.
        // The outer Entity type (TestEntity vs AnotherEntity) does not matter
        // because Entity.isEntity() only checks instanceof Entity.
        const sharedId = makeTestID(VALID_UUID_A);
        const testEntity = makeEntity({ name: 'Alice', age: 30 }, sharedId);
        const anotherEntity = unwrap(
          AnotherEntity.create({ label: 'X' }, sharedId),
          'anotherEntity'
        );

        // Cast is required because equals() is typed with the same TID/T
        // generic parameters; at runtime behaviour is correct.
        expect(
          testEntity.equals(anotherEntity as unknown as TestEntity)
        ).toBe(true);
      });

      it('should return false when two entities carry IDs of different concrete subclasses even when the underlying UUID string is identical', () => {
        // Identifier.equals() checks `id instanceof this.constructor`.
        // A TestID and an OtherID holding the same raw UUID string are NOT
        // equal because they are instances of different classes.
        // Consequently the two Entity instances must also be unequal.
        const testId = makeTestID(VALID_UUID_A);
        const otherId = unwrap(OtherID.create(VALID_UUID_A), 'OtherID for cross-type test');

        const testEntity = makeEntity({ name: 'Alice', age: 30 }, testId);
        const otherEntity = unwrap(
          OtherEntity.create({ code: 'X-001' }, otherId),
          'otherEntity cross-type'
        );

        expect(
          testEntity.equals(otherEntity as unknown as TestEntity)
        ).toBe(false);
      });
    });
  });

  // =========================================================================
  describe('Entity.isEntity() static type guard', () => {
    it('should return true for a TestEntity instance', () => {
      const entity = makeEntity();

      expect(Entity.isEntity(entity)).toBe(true);
    });

    it('should return true for an AnotherEntity instance', () => {
      const entity = unwrap(
        AnotherEntity.create({ label: 'test' }),
        'isEntity AnotherEntity'
      );

      expect(Entity.isEntity(entity)).toBe(true);
    });

    it('should return true for an OtherEntity instance (which uses a different ID subclass)', () => {
      const entity = unwrap(
        OtherEntity.create({ code: 'Y-001' }),
        'isEntity OtherEntity'
      );

      expect(Entity.isEntity(entity)).toBe(true);
    });

    it('should return false for a plain object', () => {
      expect(Entity.isEntity({})).toBe(false);
    });

    it('should return false for an object that structurally resembles an entity but is not one', () => {
      const lookalike = {
        id: makeTestID(VALID_UUID_A),
        props: { name: 'Alice', age: 30 },
        equals: () => false
      };

      expect(Entity.isEntity(lookalike)).toBe(false);
    });

    it('should return false for null', () => {
      expect(Entity.isEntity(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(Entity.isEntity(undefined)).toBe(false);
    });

    it('should return false for a number primitive', () => {
      expect(Entity.isEntity(42)).toBe(false);
    });

    it('should return false for a string primitive', () => {
      expect(Entity.isEntity('some-string')).toBe(false);
    });

    it('should return false for a boolean primitive', () => {
      expect(Entity.isEntity(true)).toBe(false);
    });

    it('should return false for an array', () => {
      expect(Entity.isEntity([])).toBe(false);
    });

    it('should return false for a UniqueEntityID instance (not an Entity)', () => {
      const id = makeTestID(VALID_UUID_A);

      expect(Entity.isEntity(id)).toBe(false);
    });

    it('should return false for an Identifier instance (not an Entity)', () => {
      const id = new Identifier<string>(VALID_UUID_A);

      expect(Entity.isEntity(id)).toBe(false);
    });
  });

  // =========================================================================
  describe('structural invariants', () => {
    it('should expose the id as readonly — reassignment via the protected field is not possible from outside', () => {
      const entity = makeEntity();
      const originalIdValue = entity.id.toValue();

      // The id getter returns the same reference across multiple accesses.
      expect(entity.id.toValue()).toBe(originalIdValue);
      expect(entity.id).toBe(entity.id);
    });

    it('should produce a fresh auto-generated UUID for every entity created without an explicit ID', () => {
      const count = 20;
      const values = new Set<string>();

      for (let i = 0; i < count; i++) {
        values.add(makeEntity().id.toValue());
      }

      // All 20 IDs must be distinct — no collisions across random UUIDs.
      expect(values.size).toBe(count);
    });
  });
});

// TODO: Test - equals() behaviour when the Entity subclass overrides the equals() method
// TODO: Test - verifying that the `props` field is mutable (protected) by a subclass that mutates state inside a domain method
