import { DomainEvent, UniqueEntityID } from '../../../src/domain';

/**
 * Test event props interface
 */
interface TestEventProps {
  readonly aggregateId: UniqueEntityID;
  readonly testProperty: string;
  readonly numericProperty: number;
  readonly dateTimeOccurred: Date;
}

class TestID extends UniqueEntityID {
  private constructor(id?: string) {
    super(id);
  }

  public static create(id?: string): TestID {
    const testID = new TestID(id);

    return testID;
  }
}

/**
 * Concrete test event class for testing DomainEvent base class
 */
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

  get testProperty(): string {
    return this.props.testProperty;
  }

  get numericProperty(): number {
    return this.props.numericProperty;
  }

  // Override serializeProps for testing custom serialization
  protected serializeProps(): Record<string, any> {
    return {
      aggregateId: this.props.aggregateId.toString(),
      testProperty: this.props.testProperty,
      numericProperty: this.props.numericProperty
    };
  }
}

describe('DomainEvent<TProps>', () => {
  describe('constructor', () => {
    it('should create an event with all properties', () => {
      // Arrange
      const aggregateId = TestID.create();
      const testProperty = 'test value';
      const numericProperty = 42;
      const dateTimeOccurred = new Date();

      // Act
      const event = new TestEvent({
        aggregateId,
        testProperty,
        numericProperty,
        dateTimeOccurred
      });

      // Assert
      expect(event).toBeDefined();
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.testProperty).toBe(testProperty);
      expect(event.numericProperty).toBe(numericProperty);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should freeze props object automatically', () => {
      // Arrange
      const aggregateId = TestID.create();
      const dateTimeOccurred = new Date();

      // Act
      const event = new TestEvent({
        aggregateId,
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred
      });

      // Assert
      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should create a copy of props object (not reference)', () => {
      // Arrange
      const aggregateId = TestID.create();
      const dateTimeOccurred = new Date();
      const originalProps = {
        aggregateId,
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred
      };

      // Act
      const event = new TestEvent(originalProps);

      // Assert - props should be a copy, not the same reference
      expect((event as any).props).not.toBe(originalProps);
    });
  });

  describe('immutability', () => {
    it('should not allow modification of props', () => {
      // Arrange
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'original',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act & Assert
      expect(() => {
        (event as any).props.testProperty = 'modified';
      }).toThrow();
    });

    it('should not allow adding new properties to props', () => {
      // Arrange
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act & Assert
      expect(() => {
        (event as any).props.newProperty = 'new value';
      }).toThrow();
    });

    it('should not allow deleting properties from props', () => {
      // Arrange
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act & Assert
      expect(() => {
        delete (event as any).props.testProperty;
      }).toThrow();
    });

    it('should maintain immutability across multiple instances', () => {
      // Arrange
      const event1 = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'event1',
        numericProperty: 1,
        dateTimeOccurred: new Date()
      });

      const event2 = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'event2',
        numericProperty: 2,
        dateTimeOccurred: new Date()
      });

      // Assert
      expect(Object.isFrozen((event1 as any).props)).toBe(true);
      expect(Object.isFrozen((event2 as any).props)).toBe(true);
      expect(event1.testProperty).toBe('event1');
      expect(event2.testProperty).toBe('event2');
    });
  });

  describe('getAggregateId', () => {
    it('should return the aggregate ID from props', () => {
      // Arrange
      const aggregateId = TestID.create();
      const event = new TestEvent({
        aggregateId,
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act
      const result = event.aggregateId;

      // Assert
      expect(result).toBe(aggregateId);
    });

    it('should return the same aggregate ID on multiple calls', () => {
      // Arrange
      const aggregateId = TestID.create();
      const event = new TestEvent({
        aggregateId,
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act
      const result1 = event.aggregateId;
      const result2 = event.aggregateId;

      // Assert
      expect(result1).toBe(result2);
      expect(result1).toBe(aggregateId);
    });
  });

  describe('dateTimeOccurred', () => {
    it('should return the dateTimeOccurred from props', () => {
      // Arrange
      const dateTimeOccurred = new Date('2024-01-15T10:30:00Z');
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred
      });

      // Act
      const result = event.dateTimeOccurred;

      // Assert
      expect(result).toBe(dateTimeOccurred);
    });

    it('should return the same date on multiple accesses', () => {
      // Arrange
      const dateTimeOccurred = new Date('2024-01-15T10:30:00Z');
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred
      });

      // Act
      const result1 = event.dateTimeOccurred;
      const result2 = event.dateTimeOccurred;

      // Assert
      expect(result1).toBe(result2);
      expect(result1.toISOString()).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  describe('toString', () => {
    it('should return formatted string with event name, aggregate ID, and timestamp', () => {
      // Arrange
      const aggregateId = TestID.create(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      const dateTimeOccurred = new Date('2024-01-15T10:30:00Z');
      const event = new TestEvent({
        aggregateId,
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred
      });

      // Act
      const result = event.toString();

      // Assert
      expect(result).toContain('TestEvent');
      expect(result).toContain('aggregateId');
      expect(result).toContain(
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(result).toContain('occurred');
      expect(result).toContain('2024-01-15T10:30:00.000Z');
    });

    it('should include event class name in output', () => {
      // Arrange
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act
      const result = event.toString();

      // Assert
      expect(result).toMatch(/^TestEvent\(/);
    });

    it('should be consistent across multiple calls', () => {
      // Arrange
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act
      const result1 = event.toString();
      const result2 = event.toString();

      // Assert
      expect(result1).toBe(result2);
    });
  });

  describe('property access', () => {
    it('should provide access to all props via getters', () => {
      // Arrange
      const aggregateId = TestID.create();
      const testProperty = 'accessible value';
      const numericProperty = 456;
      const dateTimeOccurred = new Date();

      const event = new TestEvent({
        aggregateId,
        testProperty,
        numericProperty,
        dateTimeOccurred
      });

      // Act & Assert
      expect(event.testProperty).toBe(testProperty);
      expect(event.numericProperty).toBe(numericProperty);
      expect(event.aggregateId).toBe(aggregateId);
      expect(event.dateTimeOccurred).toBe(dateTimeOccurred);
    });

    it('should not expose props directly', () => {
      // Arrange
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'test',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act & Assert - props should be protected, not public
      expect((event as any).props).toBeDefined(); // Accessible via any, but not public
      // TypeScript prevents direct access: event.props would be a compile error
    });
  });

  describe('edge cases', () => {
    it('should handle events with minimal props', () => {
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

      // Act
      const event = new MinimalEvent({
        id: TestID.create(),
        occurred: new Date()
      });

      // Assert
      expect(event).toBeDefined();
      expect(event.aggregateId).toBeDefined();
      expect(event.dateTimeOccurred).toBeDefined();
    });

    it('should handle events with complex nested value objects', () => {
      // Arrange
      interface ComplexProps {
        readonly aggregateId: UniqueEntityID;
        readonly nestedObject: {
          readonly value: string;
          readonly count: number;
        };
        readonly dateTimeOccurred: Date;
      }

      class ComplexEvent extends DomainEvent<ComplexProps> {
        constructor(props: ComplexProps) {
          super(props);
        }

        get aggregateId(): UniqueEntityID {
          return this.props.aggregateId;
        }

        get dateTimeOccurred(): Date {
          return this.props.dateTimeOccurred;
        }

        get nestedObject() {
          return this.props.nestedObject;
        }
      }

      const nestedObject = {
        value: 'nested',
        count: 10
      };

      // Act
      const event = new ComplexEvent({
        aggregateId: TestID.create(),
        nestedObject,
        dateTimeOccurred: new Date()
      });

      // Assert
      expect(event.nestedObject).toBeDefined();
      expect(event.nestedObject.value).toBe('nested');
      expect(event.nestedObject.count).toBe(10);
      expect(Object.isFrozen((event as any).props)).toBe(true);
    });

    it('should handle events created at the same timestamp', () => {
      // Arrange
      const sharedTimestamp = new Date('2024-01-15T10:30:00Z');

      // Act
      const event1 = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'event1',
        numericProperty: 1,
        dateTimeOccurred: sharedTimestamp
      });

      const event2 = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'event2',
        numericProperty: 2,
        dateTimeOccurred: sharedTimestamp
      });

      // Assert
      expect(event1.dateTimeOccurred).toBe(event2.dateTimeOccurred);
      expect(event1.dateTimeOccurred.getTime()).toBe(
        event2.dateTimeOccurred.getTime()
      );
      expect(event1.testProperty).not.toBe(event2.testProperty);
    });
  });

  describe('type safety', () => {
    it('should enforce type safety for props', () => {
      // This test verifies TypeScript compilation
      // If this compiles, type safety is working

      const validProps: TestEventProps = {
        aggregateId: TestID.create(),
        testProperty: 'string value',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      };

      const event = new TestEvent(validProps);

      expect(event.testProperty).toBe('string value');
      expect(event.numericProperty).toBe(42);
    });

    it('should provide readonly access to properties', () => {
      // Arrange
      const event = new TestEvent({
        aggregateId: TestID.create(),
        testProperty: 'readonly',
        numericProperty: 42,
        dateTimeOccurred: new Date()
      });

      // Act & Assert
      // TypeScript prevents this at compile time:
      // event.testProperty = 'new value'; // Would be a compile error

      // At runtime, getters only provide read access
      const value = event.testProperty;
      expect(value).toBe('readonly');
    });
  });
});
