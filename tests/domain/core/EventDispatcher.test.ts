import {
  AggregateRoot,
  EventDispatcher,
  Result,
  UniqueEntityID,
  IDomainEvent,
  IHandle,
  DomainEvent
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
interface FakeDomainEventProps {
  readonly aggregateId: TestID;
  readonly dateTimeOccurred: Date;
}

class FakeDomainEvent extends DomainEvent<FakeDomainEventProps> {
  constructor(props: FakeDomainEventProps) {
    super(props);
  }

  get aggregateId(): TestID {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
}

// ---------------------------------------------------
// Fake Event Handlers for testing
// ---------------------------------------------------
class FakeEventHandler implements IHandle<FakeDomainEvent> {
  public handledEvents: FakeDomainEvent[] = [];

  handle(event: FakeDomainEvent): void {
    this.handledEvents.push(event);
  }

  hasHandled(event: FakeDomainEvent): boolean {
    return this.handledEvents.includes(event);
  }

  getCallCount(): number {
    return this.handledEvents.length;
  }

  reset(): void {
    this.handledEvents = [];
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

describe('EventDispatcher', () => {
  beforeEach(() => {
    EventDispatcher.clearHandlers();
    EventDispatcher.clearMarkedAggregates();
  });

  // ---------------------------------------------------
  // register()
  // ---------------------------------------------------
  it('should register handlers for an event class', () => {
    const handler = new FakeEventHandler();
    EventDispatcher.register('FakeDomainEvent', handler);

    const handlers =
      EventDispatcher['handlersMap'].get('FakeDomainEvent');

    expect(handlers).toBeDefined();
    expect(handlers!.length).toBe(1);
    expect(handlers![0]).toBe(handler);
  });

  // ---------------------------------------------------
  // markAggregateForDispatch()
  // ---------------------------------------------------
  it('should mark aggregates for event dispatch only once', () => {
    const aggregate = FakeAggregateRoot.create({ name: 'Test' });

    EventDispatcher.markAggregateForDispatch(aggregate);
    EventDispatcher.markAggregateForDispatch(aggregate);

    const list = EventDispatcher['markedAggregates'];

    expect(list.length).toBe(1);
    expect(list[0]).toBe(aggregate);
  });

  // ---------------------------------------------------
  // dispatchEventsForAggregate()
  // ---------------------------------------------------
  it('should dispatch events for a marked aggregate', () => {
    const handler = new FakeEventHandler();
    EventDispatcher.register('FakeDomainEvent', handler);

    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create(
      { name: 'Aggregate' },
      id
    );
    const event = new FakeDomainEvent({
      aggregateId: id,
      dateTimeOccurred: new Date()
    });

    aggregate.generateEvent(event);

    EventDispatcher.markAggregateForDispatch(aggregate);
    EventDispatcher.dispatchEventsForAggregate(id);

    expect(handler.getCallCount()).toBe(1);
    expect(handler.hasHandled(event)).toBe(true);
  });

  it('should clear events from aggregate after dispatch', () => {
    const handler = new FakeEventHandler();
    EventDispatcher.register('FakeDomainEvent', handler);

    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create({ name: 'A' }, id);
    const event = new FakeDomainEvent({
      aggregateId: id,
      dateTimeOccurred: new Date()
    });

    aggregate.generateEvent(event);

    EventDispatcher.markAggregateForDispatch(aggregate);
    EventDispatcher.dispatchEventsForAggregate(id);

    expect(aggregate.domainEvents.length).toBe(0);
  });

  it('should remove aggregate from marked list after dispatch', () => {
    const handler = new FakeEventHandler();
    EventDispatcher.register('FakeDomainEvent', handler);

    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create({ name: 'A' }, id);
    const event = new FakeDomainEvent({
      aggregateId: id,
      dateTimeOccurred: new Date()
    });

    aggregate.generateEvent(event);

    EventDispatcher.markAggregateForDispatch(aggregate);
    EventDispatcher.dispatchEventsForAggregate(id);

    const list = EventDispatcher['markedAggregates'];

    expect(list.length).toBe(0);
  });

  // ---------------------------------------------------
  // dispatch() multiple handlers
  // ---------------------------------------------------
  it('should call multiple handlers in order for the same event', () => {
    const callOrder: number[] = [];

    class OrderedHandler1 extends FakeEventHandler {
      handle(event: FakeDomainEvent): void {
        callOrder.push(1);
        super.handle(event);
      }
    }

    class OrderedHandler2 extends FakeEventHandler {
      handle(event: FakeDomainEvent): void {
        callOrder.push(2);
        super.handle(event);
      }
    }

    const handler1 = new OrderedHandler1();
    const handler2 = new OrderedHandler2();

    EventDispatcher.register('FakeDomainEvent', handler1);
    EventDispatcher.register('FakeDomainEvent', handler2);

    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create({ name: 'X' }, id);
    const event = new FakeDomainEvent({
      aggregateId: id,
      dateTimeOccurred: new Date()
    });

    aggregate.generateEvent(event);

    EventDispatcher.markAggregateForDispatch(aggregate);
    EventDispatcher.dispatchEventsForAggregate(id);

    expect(handler1.getCallCount()).toBe(1);
    expect(handler2.getCallCount()).toBe(1);

    // ensure calling order
    expect(callOrder).toEqual([1, 2]);
  });

  // ---------------------------------------------------
  // No handlers registered
  // ---------------------------------------------------
  it('should safely skip dispatching when no handlers exist', () => {
    const id = TestID.create() as TestID;
    const aggregate = FakeAggregateRoot.create({ name: 'Z' }, id);
    const event = new FakeDomainEvent({
      aggregateId: id,
      dateTimeOccurred: new Date()
    });

    aggregate.generateEvent(event);

    EventDispatcher.markAggregateForDispatch(aggregate);

    expect(() =>
      EventDispatcher.dispatchEventsForAggregate(id)
    ).not.toThrow();
  });
});
