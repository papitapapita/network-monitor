import {
  AggregateRoot,
  DomainEvents,
  Result,
  UniqueEntityID,
  IDomainEvent
} from '../../../src/domain';

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

// ---------------------------------------------------
// Fake Domain Event
// ---------------------------------------------------
class FakeDomainEvent implements IDomainEvent {
  public dateTimeOccurred: Date = new Date();

  constructor(public readonly aggregateId: TestID) {}

  getAggregateId(): TestID {
    return this.aggregateId;
  }
}

// ---------------------------------------------------
// Fake Aggregate Root for testing
// ---------------------------------------------------
interface FakeProps {
  name: string;
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

  public generateEvent(event: IDomainEvent) {
    this.addDomainEvent(event);
  }
}

describe('DomainEvents', () => {
  beforeEach(() => {
    DomainEvents.clearHandlers();
    DomainEvents.clearMarkedAggregates();
  });

  // ---------------------------------------------------
  // register()
  // ---------------------------------------------------
  it('should register handlers for an event class', () => {
    const handler = jest.fn();
    DomainEvents.register('FakeDomainEvent', handler);

    const handlers =
      DomainEvents['handlersMap'].get('FakeDomainEvent');

    expect(handlers).toBeDefined();
    expect(handlers!.length).toBe(1);
    expect(handlers![0]).toBe(handler);
  });

  // ---------------------------------------------------
  // markAggregateForDispatch()
  // ---------------------------------------------------
  it('should mark aggregates for event dispatch only once', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });

    DomainEvents.markAggregateForDispatch(aggregate);
    DomainEvents.markAggregateForDispatch(aggregate);

    const list = DomainEvents['markedAggregates'];

    expect(list.length).toBe(1);
    expect(list[0]).toBe(aggregate);
  });

  // ---------------------------------------------------
  // dispatchEventsForAggregate()
  // ---------------------------------------------------
  it('should dispatch events for a marked aggregate', () => {
    const handler = jest.fn();
    DomainEvents.register('FakeDomainEvent', handler);

    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create(
      { name: 'Aggregate' },
      id
    );
    const event = new FakeDomainEvent(id);

    aggregate.generateEvent(event);

    DomainEvents.markAggregateForDispatch(aggregate);
    DomainEvents.dispatchEventsForAggregate(id);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should clear events from aggregate after dispatch', () => {
    const handler = jest.fn();
    DomainEvents.register('FakeDomainEvent', handler);

    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create({ name: 'A' }, id);
    const event = new FakeDomainEvent(id);

    aggregate.generateEvent(event);

    DomainEvents.markAggregateForDispatch(aggregate);
    DomainEvents.dispatchEventsForAggregate(id);

    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should remove aggregate from marked list after dispatch', () => {
    const handler = jest.fn();
    DomainEvents.register('FakeDomainEvent', handler);

    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create({ name: 'A' }, id);
    const event = new FakeDomainEvent(id);

    aggregate.generateEvent(event);

    DomainEvents.markAggregateForDispatch(aggregate);
    DomainEvents.dispatchEventsForAggregate(id);

    const list = DomainEvents['markedAggregates'];

    expect(list.length).toBe(0);
  });

  // ---------------------------------------------------
  // dispatch() multiple handlers
  // ---------------------------------------------------
  it('should call multiple handlers in order for the same event', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    DomainEvents.register('FakeDomainEvent', handler1);
    DomainEvents.register('FakeDomainEvent', handler2);

    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create({ name: 'X' }, id);
    const event = new FakeDomainEvent(id);

    aggregate.generateEvent(event);

    DomainEvents.markAggregateForDispatch(aggregate);
    DomainEvents.dispatchEventsForAggregate(id);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    // ensure calling order
    expect(handler1.mock.invocationCallOrder[0]).toBeLessThan(
      handler2.mock.invocationCallOrder[0]
    );
  });

  // ---------------------------------------------------
  // No handlers registered
  // ---------------------------------------------------
  it('should safely skip dispatching when no handlers exist', () => {
    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create({ name: 'Z' }, id);
    const event = new FakeDomainEvent(id);

    aggregate.generateEvent(event);

    DomainEvents.markAggregateForDispatch(aggregate);

    expect(() =>
      DomainEvents.dispatchEventsForAggregate(id)
    ).not.toThrow();
  });
});
