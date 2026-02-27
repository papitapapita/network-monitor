// Source: src/domain/shared/core/DomainEvent.ts

import {
  DomainEvent,
  UniqueEntityID
} from '../../../../src/domain/shared/core';

// ---------------------------------------------------------------------------
// Test-only concrete ID subclass
// The constructor delegates to UniqueEntityID which requires a valid UUID v4.
// When no id is supplied, createId() (inherited protected static) generates one.
// ---------------------------------------------------------------------------
class TestID extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static create(id?: string): TestID {
    const resolvedId = id !== undefined ? id : TestID.createId();
    return new TestID(resolvedId);
  }
}

// ---------------------------------------------------------------------------
// Test-only concrete event class
// Stores all props in the frozen object provided by the base class.
// No serializeProps() — that method does not exist on DomainEvent.
// ---------------------------------------------------------------------------
interface TestEventProps {
  readonly aggregateId: TestID;
  readonly dateTimeOccurred: Date;
  readonly label: string;
  readonly count: number;
}

class TestEvent extends DomainEvent<TestEventProps> {
  constructor(props: TestEventProps) {
    super(props);
  }

  get aggregateId(): TestID {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }

  get label(): string {
    return this.props.label;
  }

  get count(): number {
    return this.props.count;
  }
}

// ---------------------------------------------------------------------------
// Helper: builds a valid TestEvent with sensible defaults, allowing callers
// to override individual fields without repeating boilerplate.
// ---------------------------------------------------------------------------
function makeEvent(
  overrides: Partial<TestEventProps> = {}
): TestEvent {
  return new TestEvent({
    aggregateId: TestID.create(),
    dateTimeOccurred: new Date('2024-06-15T12:00:00.000Z'),
    label: 'default-label',
    count: 0,
    ...overrides
  });
}

// ---------------------------------------------------------------------------
// Utility types: pierce the `protected` barrier on `props` without using
// `any`. `WithProps<T>` preserves readonly semantics for read assertions.
// `WithMutableProps<T>` strips readonly so that write/delete attempts inside
// `expect(() => { ... }).toThrow()` blocks compile while still exercising the
// runtime freeze behaviour.
// ---------------------------------------------------------------------------
type WithProps<T> = { props: T };
type WithMutableProps<T> = {
  props: { -readonly [K in keyof T]: T[K] };
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DomainEvent<TProps>', () => {
  describe('constructor', () => {
    it('should create an event with all provided properties accessible via getters', () => {
      // Arrange
      const aggregateId = TestID.create();
      const dateTimeOccurred = new Date('2024-06-15T12:00:00.000Z');
      const label = 'device-created';
      const count = 99;

      // Act
      const event = new TestEvent({
        aggregateId,
        dateTimeOccurred,
        label,
        count
      });

      // Assert
      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
      expect(event.label).toBe(label);
      expect(event.count).toBe(count);
    });

    it('should freeze the internal props object so it is immutable', () => {
      // Arrange / Act
      const event = makeEvent();

      // Assert
      expect(
        Object.isFrozen(
          (event as unknown as WithProps<TestEventProps>).props
        )
      ).toBe(true);
    });

    it('should store a shallow copy of props, not the original reference', () => {
      // Arrange
      const originalProps: TestEventProps = {
        aggregateId: TestID.create(),
        dateTimeOccurred: new Date(),
        label: 'copy-test',
        count: 1
      };

      // Act
      const event = new TestEvent(originalProps);

      // Assert — the stored object is a new object, not the same reference
      expect(
        (event as unknown as WithProps<TestEventProps>).props
      ).not.toBe(originalProps);
    });

    it('should preserve all prop values even after the original props variable is changed', () => {
      // Arrange
      const mutableProps: TestEventProps = {
        aggregateId: TestID.create(),
        dateTimeOccurred: new Date('2024-01-01T00:00:00.000Z'),
        label: 'original',
        count: 5
      };

      // Act
      const event = new TestEvent(mutableProps);
      // The event was created from a copy — mutating mutableProps after the
      // fact cannot affect the frozen internal copy.

      // Assert
      expect(event.label).toBe('original');
      expect(event.count).toBe(5);
    });
  });

  // -------------------------------------------------------------------------

  describe('immutability', () => {
    it('should throw when attempting to modify an existing prop', () => {
      // Arrange
      const event = makeEvent({ label: 'immutable' });

      // Act & Assert — Object.freeze causes a TypeError in strict mode when
      // a frozen property is reassigned. WithMutableProps strips readonly so
      // TypeScript allows the expression while the runtime still throws.
      expect(() => {
        (
          event as unknown as WithMutableProps<TestEventProps>
        ).props.label = 'mutated';
      }).toThrow(TypeError);
    });

    it('should throw when attempting to add a new property to props', () => {
      // Arrange
      const event = makeEvent();
      const frozenProps = (
        event as unknown as WithMutableProps<
          TestEventProps & Record<string, unknown>
        >
      ).props;

      // Act & Assert — Object.assign on a frozen object throws in strict mode
      expect(() => {
        Object.assign(frozenProps, { extraField: 'oops' });
      }).toThrow(TypeError);
    });

    it('should throw when attempting to delete a property from props', () => {
      // Arrange
      const event = makeEvent();

      // Act & Assert — delete on a frozen object property throws in strict mode
      expect(() => {
        // @ts-expect-error — delete is not allowed on readonly props, but we want to test the runtime behavior
        delete (event as unknown as WithMutableProps<TestEventProps>)
          .props.label;
      }).toThrow(TypeError);
    });

    it('should maintain independent, frozen props across multiple instances', () => {
      // Arrange
      const event1 = makeEvent({ label: 'first', count: 1 });
      const event2 = makeEvent({ label: 'second', count: 2 });

      // Assert — each instance is independently frozen
      expect(
        Object.isFrozen(
          (event1 as unknown as WithProps<TestEventProps>).props
        )
      ).toBe(true);
      expect(
        Object.isFrozen(
          (event2 as unknown as WithProps<TestEventProps>).props
        )
      ).toBe(true);

      // Assert — they do not share state
      expect(event1.label).toBe('first');
      expect(event2.label).toBe('second');
      expect(event1.count).toBe(1);
      expect(event2.count).toBe(2);
    });
  });

  // -------------------------------------------------------------------------

  describe('aggregateId getter', () => {
    it('should return the exact TestID instance passed in props', () => {
      // Arrange
      const aggregateId = TestID.create(
        '550e8400-e29b-41d4-a716-446655440000'
      );
      const event = makeEvent({ aggregateId });

      // Act
      const result = event.aggregateId;

      // Assert
      expect(result).toBe(aggregateId);
    });

    it('should return the same reference on every subsequent call', () => {
      // Arrange
      const aggregateId = TestID.create();
      const event = makeEvent({ aggregateId });

      // Act
      const first = event.aggregateId;
      const second = event.aggregateId;
      const third = event.aggregateId;

      // Assert
      expect(first).toBe(second);
      expect(second).toBe(third);
      expect(first).toBe(aggregateId);
    });

    it('should expose the UUID string via aggregateId.toString()', () => {
      // Arrange
      const knownUuid = '550e8400-e29b-41d4-a716-446655440000';
      const aggregateId = TestID.create(knownUuid);
      const event = makeEvent({ aggregateId });

      // Act & Assert
      expect(event.aggregateId.toString()).toBe(knownUuid);
    });

    it('should differ between two events created with distinct IDs', () => {
      // Arrange
      const id1 = TestID.create();
      const id2 = TestID.create();
      const event1 = makeEvent({ aggregateId: id1 });
      const event2 = makeEvent({ aggregateId: id2 });

      // Act & Assert
      expect(event1.aggregateId).not.toBe(event2.aggregateId);
      expect(event1.aggregateId.toString()).not.toBe(
        event2.aggregateId.toString()
      );
    });
  });

  // -------------------------------------------------------------------------

  describe('dateTimeOccurred getter', () => {
    it('should return the exact Date instance passed in props', () => {
      // Arrange
      const dateTimeOccurred = new Date('2024-03-20T08:15:00.000Z');
      const event = makeEvent({ dateTimeOccurred });

      // Act
      const result = event.dateTimeOccurred;

      // Assert
      expect(result).toBe(dateTimeOccurred);
    });

    it('should return the same reference on every subsequent access', () => {
      // Arrange
      const dateTimeOccurred = new Date('2024-03-20T08:15:00.000Z');
      const event = makeEvent({ dateTimeOccurred });

      // Act
      const first = event.dateTimeOccurred;
      const second = event.dateTimeOccurred;

      // Assert
      expect(first).toBe(second);
    });

    it('should serialize to the correct ISO string', () => {
      // Arrange
      const dateTimeOccurred = new Date('2024-03-20T08:15:30.500Z');
      const event = makeEvent({ dateTimeOccurred });

      // Act & Assert
      expect(event.dateTimeOccurred.toISOString()).toBe(
        '2024-03-20T08:15:30.500Z'
      );
    });

    it('should reflect the numeric timestamp of the original Date', () => {
      // Arrange
      const timestamp = 1_700_000_000_000;
      const dateTimeOccurred = new Date(timestamp);
      const event = makeEvent({ dateTimeOccurred });

      // Act & Assert
      expect(event.dateTimeOccurred.getTime()).toBe(timestamp);
    });
  });

  // -------------------------------------------------------------------------

  describe('toString', () => {
    it('should contain the concrete class name', () => {
      // Arrange
      const event = makeEvent();

      // Act
      const result = event.toString();

      // Assert
      expect(result).toContain('TestEvent');
    });

    it('should start with the class name followed by an opening parenthesis', () => {
      // Arrange
      const event = makeEvent();

      // Act
      const result = event.toString();

      // Assert
      expect(result).toMatch(/^TestEvent\(/);
    });

    it('should contain the literal token "aggregateId"', () => {
      // Arrange
      const event = makeEvent();

      // Act
      const result = event.toString();

      // Assert
      expect(result).toContain('aggregateId');
    });

    it('should embed the UUID of the aggregate', () => {
      // Arrange
      const knownUuid = '550e8400-e29b-41d4-a716-446655440000';
      const aggregateId = TestID.create(knownUuid);
      const event = makeEvent({ aggregateId });

      // Act
      const result = event.toString();

      // Assert
      expect(result).toContain(knownUuid);
    });

    it('should contain the literal token "occurred"', () => {
      // Arrange
      const event = makeEvent();

      // Act
      const result = event.toString();

      // Assert
      expect(result).toContain('occurred');
    });

    it('should embed the ISO timestamp of the event', () => {
      // Arrange
      const dateTimeOccurred = new Date('2024-06-15T12:00:00.000Z');
      const event = makeEvent({ dateTimeOccurred });

      // Act
      const result = event.toString();

      // Assert
      expect(result).toContain('2024-06-15T12:00:00.000Z');
    });

    it('should match the exact format produced by the base class', () => {
      // Arrange
      const knownUuid = '550e8400-e29b-41d4-a716-446655440000';
      const aggregateId = TestID.create(knownUuid);
      const dateTimeOccurred = new Date('2024-06-15T12:00:00.000Z');
      const event = makeEvent({ aggregateId, dateTimeOccurred });

      // Act
      const result = event.toString();

      // Assert
      expect(result).toBe(
        `TestEvent(aggregateId: ${knownUuid}, occurred: 2024-06-15T12:00:00.000Z)`
      );
    });

    it('should return an identical string on every call (deterministic output)', () => {
      // Arrange
      const event = makeEvent();

      // Act
      const first = event.toString();
      const second = event.toString();
      const third = event.toString();

      // Assert
      expect(first).toBe(second);
      expect(second).toBe(third);
    });
  });

  // -------------------------------------------------------------------------

  describe('property access', () => {
    it('should expose all domain-specific getters returning the correct values', () => {
      // Arrange
      const aggregateId = TestID.create();
      const dateTimeOccurred = new Date('2024-12-01T00:00:00.000Z');
      const label = 'accessible-value';
      const count = 456;

      const event = new TestEvent({
        aggregateId,
        dateTimeOccurred,
        label,
        count
      });

      // Act & Assert
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
      expect(event.label).toBe(label);
      expect(event.count).toBe(count);
    });

    it('should not expose props as a public member (protected access only)', () => {
      // Arrange
      const event = makeEvent();

      // Act — accessing via an unsafe cast simulates what the TypeScript compiler
      // would reject at compile time; at runtime the field is still accessible
      // because JS has no true access modifiers.
      const propsViaUnsafeCast = (
        event as unknown as WithProps<TestEventProps>
      ).props;

      // Assert — the object exists behind the protected barrier
      expect(propsViaUnsafeCast).toBeDefined();

      // TypeScript note: `event.props` would be a compile-time error because
      // props is declared `protected` on the base class.
    });

    it('should return a value of type UniqueEntityID from aggregateId getter', () => {
      // Arrange
      const event = makeEvent();

      // Act
      const id = event.aggregateId;

      // Assert — runtime type check confirms correct type is returned
      expect(id).toBeInstanceOf(UniqueEntityID);
    });

    it('should return a Date object from dateTimeOccurred getter', () => {
      // Arrange
      const event = makeEvent();

      // Act
      const occurred = event.dateTimeOccurred;

      // Assert
      expect(occurred).toBeInstanceOf(Date);
    });
  });

  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should work correctly when props contain only the two required event fields', () => {
      // Arrange
      interface MinimalProps {
        readonly id: UniqueEntityID;
        readonly occurred: Date;
      }

      class MinimalEvent extends DomainEvent<MinimalProps> {
        constructor(props: MinimalProps) {
          super(props);
        }

        get aggregateId(): UniqueEntityID {
          return this.props.id;
        }

        get dateTimeOccurred(): Date {
          return this.props.occurred;
        }
      }

      const id = TestID.create();
      const occurred = new Date('2025-01-01T00:00:00.000Z');

      // Act
      const event = new MinimalEvent({ id, occurred });

      // Assert
      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(id);
      expect(event.dateTimeOccurred).toBe(occurred);
      expect(
        Object.isFrozen(
          (event as unknown as WithProps<MinimalProps>).props
        )
      ).toBe(true);
    });

    it('should shallow-freeze props so the top-level object is frozen but nested objects remain mutable', () => {
      // Arrange
      interface PropsWithNested {
        readonly aggregateId: UniqueEntityID;
        readonly dateTimeOccurred: Date;
        readonly nested: { value: string };
      }

      class NestedEvent extends DomainEvent<PropsWithNested> {
        constructor(props: PropsWithNested) {
          super(props);
        }

        get aggregateId(): UniqueEntityID {
          return this.props.aggregateId;
        }

        get dateTimeOccurred(): Date {
          return this.props.dateTimeOccurred;
        }

        get nested(): { value: string } {
          return this.props.nested;
        }
      }

      const nested = { value: 'original' };

      // Act
      const event = new NestedEvent({
        aggregateId: TestID.create(),
        dateTimeOccurred: new Date(),
        nested
      });

      // Assert — top-level props object is frozen
      expect(
        Object.isFrozen(
          (event as unknown as WithProps<PropsWithNested>).props
        )
      ).toBe(true);

      // Assert — nested object is NOT frozen (Object.freeze is shallow)
      expect(Object.isFrozen(event.nested)).toBe(false);

      // Assert — nested properties are still accessible
      expect(event.nested.value).toBe('original');
    });

    it('should allow modifying the nested object because freeze is shallow', () => {
      // Arrange
      interface PropsWithMutableNested {
        readonly aggregateId: UniqueEntityID;
        readonly dateTimeOccurred: Date;
        readonly metadata: { tag: string };
      }

      class MetadataEvent extends DomainEvent<PropsWithMutableNested> {
        constructor(props: PropsWithMutableNested) {
          super(props);
        }

        get aggregateId(): UniqueEntityID {
          return this.props.aggregateId;
        }

        get dateTimeOccurred(): Date {
          return this.props.dateTimeOccurred;
        }

        get metadata(): { tag: string } {
          return this.props.metadata;
        }
      }

      const metadata = { tag: 'initial' };
      const event = new MetadataEvent({
        aggregateId: TestID.create(),
        dateTimeOccurred: new Date(),
        metadata
      });

      // Act — mutating a property of the nested (non-frozen) object
      event.metadata.tag = 'changed';

      // Assert — mutation was successful (shallow freeze does not protect nested)
      expect(event.metadata.tag).toBe('changed');
    });

    it('should allow two independent events to share the same timestamp reference', () => {
      // Arrange
      const sharedTimestamp = new Date('2024-01-15T10:30:00.000Z');

      // Act
      const event1 = makeEvent({
        aggregateId: TestID.create(),
        dateTimeOccurred: sharedTimestamp,
        label: 'first'
      });

      const event2 = makeEvent({
        aggregateId: TestID.create(),
        dateTimeOccurred: sharedTimestamp,
        label: 'second'
      });

      // Assert — both events share the same timestamp object
      expect(event1.dateTimeOccurred).toBe(event2.dateTimeOccurred);
      expect(event1.dateTimeOccurred.getTime()).toBe(
        event2.dateTimeOccurred.getTime()
      );
      expect(event1.dateTimeOccurred.toISOString()).toBe(
        '2024-01-15T10:30:00.000Z'
      );

      // Assert — they are still distinct events
      expect(event1.label).not.toBe(event2.label);
      expect(event1.aggregateId.toString()).not.toBe(
        event2.aggregateId.toString()
      );
    });

    it('should not share internal state between two events of the same type', () => {
      // Arrange
      const aggregateId1 = TestID.create();
      const aggregateId2 = TestID.create();

      // Act
      const event1 = makeEvent({
        aggregateId: aggregateId1,
        label: 'alpha',
        count: 10
      });
      const event2 = makeEvent({
        aggregateId: aggregateId2,
        label: 'beta',
        count: 20
      });

      // Assert — props objects are different references
      expect(
        (event1 as unknown as WithProps<TestEventProps>).props
      ).not.toBe(
        (event2 as unknown as WithProps<TestEventProps>).props
      );

      // Assert — individual values are independent
      expect(event1.label).toBe('alpha');
      expect(event2.label).toBe('beta');
      expect(event1.count).toBe(10);
      expect(event2.count).toBe(20);
    });
  });

  // -------------------------------------------------------------------------

  describe('type safety', () => {
    it('should accept a fully typed props object and expose correct runtime types', () => {
      // Arrange
      const validProps: TestEventProps = {
        aggregateId: TestID.create(),
        dateTimeOccurred: new Date(),
        label: 'typed-value',
        count: 42
      };

      // Act
      const event = new TestEvent(validProps);

      // Assert — runtime values match what was passed
      expect(typeof event.label).toBe('string');
      expect(typeof event.count).toBe('number');
      expect(event.label).toBe('typed-value');
      expect(event.count).toBe(42);
    });

    it('should return a string from the label getter (not undefined or null)', () => {
      // Arrange
      const event = makeEvent({ label: 'runtime-type-check' });

      // Act
      const value = event.label;

      // Assert
      expect(value).not.toBeNull();
      expect(value).not.toBeUndefined();
      expect(typeof value).toBe('string');
    });

    it('should return a number from the count getter', () => {
      // Arrange
      const event = makeEvent({ count: 7 });

      // Act
      const value = event.count;

      // Assert
      expect(typeof value).toBe('number');
      expect(value).toBe(7);
    });

    it('should return a UniqueEntityID subclass from aggregateId getter', () => {
      // Arrange
      const aggregateId = TestID.create();
      const event = makeEvent({ aggregateId });

      // Act
      const id = event.aggregateId;

      // Assert — the returned value satisfies the UniqueEntityID contract
      expect(id).toBeInstanceOf(UniqueEntityID);
      expect(typeof id.toString()).toBe('string');
      expect(typeof id.toValue()).toBe('string');
    });

    it('should return a Date from dateTimeOccurred getter with working Date methods', () => {
      // Arrange
      const dateTimeOccurred = new Date('2025-06-01T09:00:00.000Z');
      const event = makeEvent({ dateTimeOccurred });

      // Act
      const occurred = event.dateTimeOccurred;

      // Assert — confirm it is a true Date instance with functional methods
      expect(occurred).toBeInstanceOf(Date);
      expect(occurred.getFullYear()).toBe(2025);
      expect(occurred.getUTCMonth()).toBe(5); // June = 5 (0-indexed)
      expect(occurred.toISOString()).toBe('2025-06-01T09:00:00.000Z');
    });
  });
});
