import {
  AggregateRoot,
  Entity,
  Result,
  UniqueEntityID,
  IDomainEvent
} from '../../../src/domain';

// ---------------------------
// Domain Event Fake
// ---------------------------
class FakeDomainEvent implements IDomainEvent {
  public dateTimeOccurred: Date = new Date();

  constructor(private readonly id: TestID) {}

  get aggregateId(): TestID {
    return this.id;
  }
}

// ---------------------------
// Concrete class for testing
// ---------------------------
interface FakeProps {
  name: string;
}

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

class FakeAggregateRoot extends AggregateRoot<FakeProps, TestID> {
  private constructor(props: FakeProps, id?: TestID) {
    if (!id) {
      id = TestID.create() as TestID;
    }
    super(props, id);
  }

  public static create(
    props: FakeProps,
    id?: TestID
  ): FakeAggregateRoot {
    const aggregate = new FakeAggregateRoot(props, id);
    if (!aggregate) {
      Result.fail<FakeAggregateRoot>(
        'Failed to create FakeAggregateRoot'
      );
    }
    return aggregate;
  }

  // Expose protected method ONLY for unit testing
  public publish(event: IDomainEvent) {
    this.addDomainEvent(event);
  }
}

describe('AggregateRoot (abstract class)', () => {
  it('should extend Entity', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });

    expect(aggregate).toBeInstanceOf(Entity);
  });

  it('should start with an empty list of domain events', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });

    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should add domain events using addDomainEvent()', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });
    const event = new FakeDomainEvent(TestID.create() as TestID);

    aggregate.publish(event);

    expect(aggregate.domainEvents.length).toBe(1);
    expect(aggregate.domainEvents[0]).toBe(event);
  });

  it('should preserve the order of domain events', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });

    const event1 = new FakeDomainEvent(TestID.create() as TestID);
    const event2 = new FakeDomainEvent(TestID.create() as TestID);

    aggregate.publish(event1);
    aggregate.publish(event2);

    expect(aggregate.domainEvents[0]).toBe(event1);
    expect(aggregate.domainEvents[1]).toBe(event2);
  });

  it('should clear events when clearEvents() is called', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });

    const event = new FakeDomainEvent(TestID.create() as TestID);
    aggregate.publish(event);

    expect(aggregate.domainEvents.length).toBe(1);

    aggregate.clearEvents();

    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should not allow external mutation of the internal events array', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });
    const event = new FakeDomainEvent(TestID.create() as TestID);
    aggregate.publish(event);

    const external = aggregate.domainEvents;
    external.push(event); // attempt to mutate externally

    expect(aggregate.domainEvents.length).toBe(1);
  });

  it('should return a copy of the domain events array instead of the original', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });

    const event1 = new FakeDomainEvent(TestID.create() as TestID);
    const event2 = new FakeDomainEvent(TestID.create() as TestID);

    const external = aggregate.domainEvents;
    aggregate.publish(event1);
    expect(external.length).toBe(0);

    aggregate.publish(event2);
    expect(external.length).toBe(0);
    expect(aggregate.domainEvents.length).toBe(2);
  });
});
