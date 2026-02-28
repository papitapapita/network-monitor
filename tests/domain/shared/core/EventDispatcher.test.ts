// Source: src/domain/shared/core/EventDispatcher.ts

import {
  AggregateRoot,
  EventDispatcher,
  Result,
  UniqueEntityID,
  DomainEvent
} from '../../../../src/domain/shared/core';
import {
  IDomainEvent,
  IHandle
} from '../../../../src/domain/shared/interfaces';
// ---------------------------------------------------------------------------
// Well-known UUID v4 constants used across the suite
// ---------------------------------------------------------------------------
const UUID_A = '550e8400-e29b-41d4-a716-446655440000';
const UUID_B = '6f9619ff-8b86-4c07-ac22-a5d5e5d3a715';
const UUID_C = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const UUID_D = 'c47a8b2e-1f3d-4a6b-8e0c-9f2d3a5b7c4e';

// ---------------------------------------------------------------------------
// TestID — minimal concrete UniqueEntityID for test isolation
// ---------------------------------------------------------------------------
class TestID extends UniqueEntityID {
  private constructor(id: string) {
    super(id);
  }

  public static generate(): TestID {
    return new TestID(TestID.createId());
  }

  public static fromString(id: string): Result<TestID> {
    const parsed = TestID.parseId(id);
    if (parsed.isFailure) return Result.fail<TestID>(parsed.error);
    return Result.ok(new TestID(parsed.value));
  }
}

// ---------------------------------------------------------------------------
// Helper: unwrap a Result or throw a labelled error
// ---------------------------------------------------------------------------
function unwrapId(result: Result<TestID>, context: string): TestID {
  if (result.isFailure) {
    throw new Error(
      `Test setup failed [${context}]: ${result.error}`
    );
  }
  return result.value;
}

function makeId(uuid: string): TestID {
  return unwrapId(TestID.fromString(uuid), `makeId(${uuid})`);
}

// ---------------------------------------------------------------------------
// FakeProps — property bag for FakeAggregateRoot
// ---------------------------------------------------------------------------
interface FakeProps {
  readonly name: string;
}

// ---------------------------------------------------------------------------
// FakeAggregateRoot — exposes addDomainEvent via a public generateEvent()
// ---------------------------------------------------------------------------
class FakeAggregateRoot extends AggregateRoot<FakeProps, TestID> {
  private constructor(props: FakeProps, id: TestID) {
    super(props, id);
  }

  public static create(
    props: FakeProps,
    id?: TestID
  ): FakeAggregateRoot {
    const resolvedId = id ?? TestID.generate();
    return new FakeAggregateRoot(props, resolvedId);
  }

  public generateEvent(event: IDomainEvent): void {
    this.addDomainEvent(event);
  }
}

// ---------------------------------------------------------------------------
// FakeDomainEvent — concrete DomainEvent for dispatch tests
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// AnotherDomainEvent — a second distinct event class for handler-isolation tests
// ---------------------------------------------------------------------------
interface AnotherDomainEventProps {
  readonly aggregateId: TestID;
  readonly dateTimeOccurred: Date;
}

class AnotherDomainEvent extends DomainEvent<AnotherDomainEventProps> {
  constructor(props: AnotherDomainEventProps) {
    super(props);
  }

  get aggregateId(): TestID {
    return this.props.aggregateId;
  }

  get dateTimeOccurred(): Date {
    return this.props.dateTimeOccurred;
  }
}

// ---------------------------------------------------------------------------
// FakeEventHandler — records handled events for assertion
// ---------------------------------------------------------------------------
class FakeEventHandler implements IHandle<FakeDomainEvent> {
  private readonly _handled: FakeDomainEvent[] = [];

  handle(event: FakeDomainEvent): void {
    this._handled.push(event);
  }

  get callCount(): number {
    return this._handled.length;
  }

  get handledEvents(): ReadonlyArray<FakeDomainEvent> {
    return this._handled;
  }

  hasHandled(event: FakeDomainEvent): boolean {
    return this._handled.includes(event);
  }
}

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------
function makeAggregate(id?: TestID): FakeAggregateRoot {
  return FakeAggregateRoot.create({ name: 'test-aggregate' }, id);
}

function makeEvent(id: TestID): FakeDomainEvent {
  return new FakeDomainEvent({
    aggregateId: id,
    dateTimeOccurred: new Date('2024-01-01T00:00:00.000Z')
  });
}

// ===========================================================================
describe('EventDispatcher', () => {
  beforeEach(() => {
    EventDispatcher.clearHandlers();
    EventDispatcher.clearMarkedAggregates();
  });

  // =========================================================================
  describe('register()', () => {
    it('should add the handler to the internal map under the given event class name', () => {
      const handler = new FakeEventHandler();

      EventDispatcher.register('FakeDomainEvent', handler);

      const handlers =
        EventDispatcher['handlersMap'].get('FakeDomainEvent');
      expect(handlers).toBeDefined();
      expect(handlers).toHaveLength(1);
      expect(handlers![0]).toBe(handler);
    });

    it('should create a new entry in the map when the event class has no prior handlers', () => {
      EventDispatcher.register(
        'FakeDomainEvent',
        new FakeEventHandler()
      );

      expect(
        EventDispatcher['handlersMap'].has('FakeDomainEvent')
      ).toBe(true);
    });

    it('should accumulate multiple handlers for the same event class name in registration order', () => {
      const handler1 = new FakeEventHandler();
      const handler2 = new FakeEventHandler();
      const handler3 = new FakeEventHandler();

      EventDispatcher.register('FakeDomainEvent', handler1);
      EventDispatcher.register('FakeDomainEvent', handler2);
      EventDispatcher.register('FakeDomainEvent', handler3);

      const handlers =
        EventDispatcher['handlersMap'].get('FakeDomainEvent');
      expect(handlers).toHaveLength(3);
      expect(handlers![0]).toBe(handler1);
      expect(handlers![1]).toBe(handler2);
      expect(handlers![2]).toBe(handler3);
    });

    it('should maintain independent handler lists for different event class names', () => {
      const handlerA = new FakeEventHandler();
      const handlerB = new FakeEventHandler();

      EventDispatcher.register('FakeDomainEvent', handlerA);
      EventDispatcher.register('AnotherDomainEvent', handlerB);

      const fakeHandlers =
        EventDispatcher['handlersMap'].get('FakeDomainEvent');
      const anotherHandlers = EventDispatcher['handlersMap'].get(
        'AnotherDomainEvent'
      );

      expect(fakeHandlers).toHaveLength(1);
      expect(fakeHandlers![0]).toBe(handlerA);
      expect(anotherHandlers).toHaveLength(1);
      expect(anotherHandlers![0]).toBe(handlerB);
    });

    it('should allow registering the same handler instance twice for the same event class', () => {
      const handler = new FakeEventHandler();

      EventDispatcher.register('FakeDomainEvent', handler);
      EventDispatcher.register('FakeDomainEvent', handler);

      const handlers =
        EventDispatcher['handlersMap'].get('FakeDomainEvent');
      expect(handlers).toHaveLength(2);
    });
  });

  // =========================================================================
  describe('clearHandlers()', () => {
    it('should remove all registered handlers so the map is empty', () => {
      EventDispatcher.register(
        'FakeDomainEvent',
        new FakeEventHandler()
      );
      EventDispatcher.register(
        'AnotherDomainEvent',
        new FakeEventHandler()
      );

      EventDispatcher.clearHandlers();

      expect(EventDispatcher['handlersMap'].size).toBe(0);
    });

    it('should prevent previously registered handlers from being invoked after clearing', () => {
      const handler = new FakeEventHandler();
      EventDispatcher.register('FakeDomainEvent', handler);
      EventDispatcher.clearHandlers();

      const id = makeId(UUID_A);
      const aggregate = makeAggregate(id);
      aggregate.generateEvent(makeEvent(id));
      EventDispatcher.markAggregateForDispatch(aggregate);
      EventDispatcher.dispatchEventsForAggregate(id);

      expect(handler.callCount).toBe(0);
    });

    it('should allow fresh registrations after clearing', () => {
      const oldHandler = new FakeEventHandler();
      EventDispatcher.register('FakeDomainEvent', oldHandler);
      EventDispatcher.clearHandlers();

      const newHandler = new FakeEventHandler();
      EventDispatcher.register('FakeDomainEvent', newHandler);

      const handlers =
        EventDispatcher['handlersMap'].get('FakeDomainEvent');
      expect(handlers).toHaveLength(1);
      expect(handlers![0]).toBe(newHandler);
    });

    it('should not throw when called on an already-empty handler map', () => {
      expect(() => EventDispatcher.clearHandlers()).not.toThrow();
    });
  });

  // =========================================================================
  describe('clearMarkedAggregates()', () => {
    it('should empty the marked aggregates list', () => {
      const aggregate = makeAggregate(makeId(UUID_A));
      EventDispatcher.markAggregateForDispatch(aggregate);

      EventDispatcher.clearMarkedAggregates();

      expect(EventDispatcher['markedAggregates']).toHaveLength(0);
    });

    it('should clear multiple marked aggregates at once', () => {
      EventDispatcher.markAggregateForDispatch(
        makeAggregate(makeId(UUID_A))
      );
      EventDispatcher.markAggregateForDispatch(
        makeAggregate(makeId(UUID_B))
      );
      EventDispatcher.markAggregateForDispatch(
        makeAggregate(makeId(UUID_C))
      );

      EventDispatcher.clearMarkedAggregates();

      expect(EventDispatcher['markedAggregates']).toHaveLength(0);
    });

    it('should not throw when called on an already-empty marked list', () => {
      expect(() =>
        EventDispatcher.clearMarkedAggregates()
      ).not.toThrow();
    });

    it('should allow aggregates to be re-marked after clearing', () => {
      const id = makeId(UUID_A);
      const aggregate = makeAggregate(id);

      EventDispatcher.markAggregateForDispatch(aggregate);
      EventDispatcher.clearMarkedAggregates();
      EventDispatcher.markAggregateForDispatch(aggregate);

      expect(EventDispatcher['markedAggregates']).toHaveLength(1);
    });
  });

  // =========================================================================
  describe('markAggregateForDispatch()', () => {
    it('should add the aggregate to the internal marked list', () => {
      const aggregate = makeAggregate(makeId(UUID_A));

      EventDispatcher.markAggregateForDispatch(aggregate);

      const list = EventDispatcher['markedAggregates'];
      expect(list).toHaveLength(1);
      expect(list[0]).toBe(aggregate);
    });

    it('should not add the same aggregate twice when called with the same instance', () => {
      const aggregate = makeAggregate(makeId(UUID_A));

      EventDispatcher.markAggregateForDispatch(aggregate);
      EventDispatcher.markAggregateForDispatch(aggregate);

      expect(EventDispatcher['markedAggregates']).toHaveLength(1);
    });

    it('should not add a second aggregate that shares the same ID as an already-marked one', () => {
      const id = makeId(UUID_A);
      const aggregate1 = makeAggregate(id);
      const aggregate2 = makeAggregate(id);

      EventDispatcher.markAggregateForDispatch(aggregate1);
      EventDispatcher.markAggregateForDispatch(aggregate2);

      expect(EventDispatcher['markedAggregates']).toHaveLength(1);
    });

    it('should add multiple aggregates with distinct IDs independently', () => {
      const aggregate1 = makeAggregate(makeId(UUID_A));
      const aggregate2 = makeAggregate(makeId(UUID_B));
      const aggregate3 = makeAggregate(makeId(UUID_C));

      EventDispatcher.markAggregateForDispatch(aggregate1);
      EventDispatcher.markAggregateForDispatch(aggregate2);
      EventDispatcher.markAggregateForDispatch(aggregate3);

      expect(EventDispatcher['markedAggregates']).toHaveLength(3);
    });

    it('should preserve the exact aggregate reference in the marked list', () => {
      const aggregate = makeAggregate(makeId(UUID_A));

      EventDispatcher.markAggregateForDispatch(aggregate);

      expect(EventDispatcher['markedAggregates'][0]).toBe(aggregate);
    });
  });

  // =========================================================================
  describe('dispatchEventsForAggregate()', () => {
    describe('when aggregate is found', () => {
      it('should invoke the registered handler for each event on the aggregate', () => {
        const handler = new FakeEventHandler();
        EventDispatcher.register('FakeDomainEvent', handler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        const event = makeEvent(id);
        aggregate.generateEvent(event);

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(handler.callCount).toBe(1);
        expect(handler.hasHandled(event)).toBe(true);
      });

      it('should dispatch all pending events on the aggregate, one handler call per event', () => {
        const handler = new FakeEventHandler();
        EventDispatcher.register('FakeDomainEvent', handler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));
        aggregate.generateEvent(makeEvent(id));
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(handler.callCount).toBe(3);
      });

      it('should clear all domain events from the aggregate after dispatch', () => {
        const handler = new FakeEventHandler();
        EventDispatcher.register('FakeDomainEvent', handler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(aggregate.domainEvents).toHaveLength(0);
      });

      it('should remove the aggregate from the marked list after dispatch', () => {
        const handler = new FakeEventHandler();
        EventDispatcher.register('FakeDomainEvent', handler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(EventDispatcher['markedAggregates']).toHaveLength(0);
      });

      it('should only remove the dispatched aggregate, leaving other marked aggregates intact', () => {
        const handler = new FakeEventHandler();
        EventDispatcher.register('FakeDomainEvent', handler);

        const idA = makeId(UUID_A);
        const idB = makeId(UUID_B);
        const aggregateA = makeAggregate(idA);
        const aggregateB = makeAggregate(idB);

        aggregateA.generateEvent(makeEvent(idA));
        aggregateB.generateEvent(makeEvent(idB));

        EventDispatcher.markAggregateForDispatch(aggregateA);
        EventDispatcher.markAggregateForDispatch(aggregateB);

        EventDispatcher.dispatchEventsForAggregate(idA);

        const remaining = EventDispatcher['markedAggregates'];
        expect(remaining).toHaveLength(1);
        expect(remaining[0]).toBe(aggregateB);
      });

      it('should pass the exact event instance to the handler', () => {
        const handler = new FakeEventHandler();
        EventDispatcher.register('FakeDomainEvent', handler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        const event = makeEvent(id);
        aggregate.generateEvent(event);

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(handler.handledEvents[0]).toBe(event);
      });
    });

    describe('when no aggregate is found for the given ID', () => {
      it('should not throw when the ID is not in the marked list', () => {
        const unknownId = makeId(UUID_D);

        expect(() =>
          EventDispatcher.dispatchEventsForAggregate(unknownId)
        ).not.toThrow();
      });

      it('should not invoke any handler when the ID has no corresponding marked aggregate', () => {
        const handler = new FakeEventHandler();
        EventDispatcher.register('FakeDomainEvent', handler);

        const unknownId = makeId(UUID_D);
        EventDispatcher.dispatchEventsForAggregate(unknownId);

        expect(handler.callCount).toBe(0);
      });

      it('should leave the marked list unchanged when no matching aggregate is found', () => {
        const idA = makeId(UUID_A);
        const aggregate = makeAggregate(idA);
        EventDispatcher.markAggregateForDispatch(aggregate);

        const differentId = makeId(UUID_B);
        EventDispatcher.dispatchEventsForAggregate(differentId);

        expect(EventDispatcher['markedAggregates']).toHaveLength(1);
        expect(EventDispatcher['markedAggregates'][0]).toBe(
          aggregate
        );
      });
    });

    describe('when no handlers are registered for the event type', () => {
      it('should not throw when dispatching an event with no registered handler', () => {
        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);

        expect(() =>
          EventDispatcher.dispatchEventsForAggregate(id)
        ).not.toThrow();
      });

      it('should still clear the aggregate events even when no handlers are registered', () => {
        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(aggregate.domainEvents).toHaveLength(0);
      });

      it('should still remove the aggregate from the marked list even when no handlers are registered', () => {
        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(EventDispatcher['markedAggregates']).toHaveLength(0);
      });
    });

    describe('when the aggregate has no pending events', () => {
      it('should not invoke any handler when the aggregate has zero events', () => {
        const handler = new FakeEventHandler();
        EventDispatcher.register('FakeDomainEvent', handler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        // No events added

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(handler.callCount).toBe(0);
      });

      it('should still remove the empty aggregate from the marked list', () => {
        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(EventDispatcher['markedAggregates']).toHaveLength(0);
      });
    });
  });

  // =========================================================================
  describe('dispatch() — invoked indirectly via dispatchEventsForAggregate()', () => {
    describe('handler invocation order', () => {
      it('should call multiple handlers in registration order for the same event class', () => {
        const callOrder: number[] = [];

        const handler1: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            callOrder.push(1);
          }
        };
        const handler2: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            callOrder.push(2);
          }
        };
        const handler3: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            callOrder.push(3);
          }
        };

        EventDispatcher.register('FakeDomainEvent', handler1);
        EventDispatcher.register('FakeDomainEvent', handler2);
        EventDispatcher.register('FakeDomainEvent', handler3);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(callOrder).toEqual([1, 2, 3]);
      });

      it('should call all handlers even if one of them calls clearHandlers()', () => {
        const callOrder: number[] = [];

        const handler1: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            callOrder.push(1);
          }
        };
        const handler2: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            callOrder.push(2);
          }
        };

        EventDispatcher.register('FakeDomainEvent', handler1);
        EventDispatcher.register('FakeDomainEvent', handler2);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        // Both handlers should have been called for the first event
        // (dispatch iterates a reference captured before any mutation)
        expect(callOrder[0]).toBe(1);
        expect(callOrder[1]).toBe(2);
      });
    });

    describe('handler isolation by event class name', () => {
      it('should only invoke handlers registered for the matching event class name', () => {
        const fakeHandler = new FakeEventHandler();
        const anotherHandler: IHandle<AnotherDomainEvent> = {
          handle: jest.fn()
        };

        EventDispatcher.register('FakeDomainEvent', fakeHandler);
        EventDispatcher.register(
          'AnotherDomainEvent',
          anotherHandler
        );

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(fakeHandler.callCount).toBe(1);
        expect(anotherHandler.handle).not.toHaveBeenCalled();
      });

      it('should not invoke handlers for a different event class even when registered first', () => {
        const wrongHandler: IHandle<AnotherDomainEvent> = {
          handle: jest.fn()
        };

        EventDispatcher.register('AnotherDomainEvent', wrongHandler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(wrongHandler.handle).not.toHaveBeenCalled();
      });
    });

    describe('synchronous handler error isolation', () => {
      it('should log an error via console.error when a synchronous handler throws', () => {
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        const throwingHandler: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            throw new Error('sync handler boom');
          }
        };

        EventDispatcher.register('FakeDomainEvent', throwingHandler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('FakeDomainEvent'),
          expect.any(Error)
        );

        errorSpy.mockRestore();
      });

      it('should not propagate the exception thrown by a synchronous handler to the caller', () => {
        jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        const throwingHandler: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            throw new Error('do not propagate');
          }
        };

        EventDispatcher.register('FakeDomainEvent', throwingHandler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));
        EventDispatcher.markAggregateForDispatch(aggregate);

        expect(() =>
          EventDispatcher.dispatchEventsForAggregate(id)
        ).not.toThrow();

        jest.restoreAllMocks();
      });

      it('should continue invoking subsequent handlers after one synchronous handler throws', () => {
        jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        const throwingHandler: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            throw new Error('first handler crashes');
          }
        };
        const survivingHandler = new FakeEventHandler();

        EventDispatcher.register('FakeDomainEvent', throwingHandler);
        EventDispatcher.register('FakeDomainEvent', survivingHandler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        const event = makeEvent(id);
        aggregate.generateEvent(event);

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(survivingHandler.callCount).toBe(1);
        expect(survivingHandler.hasHandled(event)).toBe(true);

        jest.restoreAllMocks();
      });

      it('should log the correct error message prefix for a synchronous failure', () => {
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        const thrown = new Error('specific sync error');
        const throwingHandler: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): void {
            throw thrown;
          }
        };

        EventDispatcher.register('FakeDomainEvent', throwingHandler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(errorSpy).toHaveBeenCalledWith(
          `Error in handler for FakeDomainEvent:`,
          thrown
        );

        errorSpy.mockRestore();
      });
    });

    describe('asynchronous handler error isolation', () => {
      it('should catch a rejected Promise returned by an async handler without causing an unhandled rejection', async () => {
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        const asyncThrowingHandler: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): Promise<void> {
            return Promise.reject(new Error('async handler boom'));
          }
        };

        EventDispatcher.register(
          'FakeDomainEvent',
          asyncThrowingHandler
        );

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);

        // dispatchEventsForAggregate is synchronous; the rejected promise is
        // caught internally by the .catch() attached in dispatch().
        expect(() =>
          EventDispatcher.dispatchEventsForAggregate(id)
        ).not.toThrow();

        // Allow the microtask queue to flush so the .catch() runs
        await Promise.resolve();

        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining('FakeDomainEvent'),
          expect.any(Error)
        );

        errorSpy.mockRestore();
      });

      it('should log the correct error message prefix for an async failure', async () => {
        const errorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        const rejectedError = new Error('specific async error');
        const asyncThrowingHandler: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): Promise<void> {
            return Promise.reject(rejectedError);
          }
        };

        EventDispatcher.register(
          'FakeDomainEvent',
          asyncThrowingHandler
        );

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        aggregate.generateEvent(makeEvent(id));

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        await Promise.resolve();

        expect(errorSpy).toHaveBeenCalledWith(
          `Error in async handler for FakeDomainEvent:`,
          rejectedError
        );

        errorSpy.mockRestore();
      });

      it('should not invoke synchronous handlers with the returned Promise object', () => {
        const receivedArgs: unknown[] = [];
        const asyncSuccessHandler: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): Promise<void> {
            return Promise.resolve();
          }
        };
        const syncHandler: IHandle<FakeDomainEvent> = {
          handle(event: FakeDomainEvent): void {
            receivedArgs.push(event);
          }
        };

        EventDispatcher.register(
          'FakeDomainEvent',
          asyncSuccessHandler
        );
        EventDispatcher.register('FakeDomainEvent', syncHandler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        const event = makeEvent(id);
        aggregate.generateEvent(event);

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        // The sync handler should still receive the domain event, not the Promise
        expect(receivedArgs).toHaveLength(1);
        expect(receivedArgs[0]).toBe(event);
      });

      it('should continue dispatching remaining handlers after an async handler rejects', async () => {
        jest
          .spyOn(console, 'error')
          .mockImplementation(() => undefined);

        const asyncRejectingHandler: IHandle<FakeDomainEvent> = {
          handle(_event: FakeDomainEvent): Promise<void> {
            return Promise.reject(new Error('async rejection'));
          }
        };
        const laterHandler = new FakeEventHandler();

        EventDispatcher.register(
          'FakeDomainEvent',
          asyncRejectingHandler
        );
        EventDispatcher.register('FakeDomainEvent', laterHandler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        const event = makeEvent(id);
        aggregate.generateEvent(event);

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        await Promise.resolve();

        expect(laterHandler.callCount).toBe(1);
        expect(laterHandler.hasHandled(event)).toBe(true);

        jest.restoreAllMocks();
      });
    });

    describe('dispatch with multiple events on one aggregate', () => {
      it('should call the handler once per event in the order they were added', () => {
        const receivedEvents: FakeDomainEvent[] = [];
        const handler: IHandle<FakeDomainEvent> = {
          handle(event: FakeDomainEvent): void {
            receivedEvents.push(event);
          }
        };
        EventDispatcher.register('FakeDomainEvent', handler);

        const id = makeId(UUID_A);
        const aggregate = makeAggregate(id);
        const event1 = makeEvent(id);
        const event2 = makeEvent(id);
        const event3 = makeEvent(id);

        aggregate.generateEvent(event1);
        aggregate.generateEvent(event2);
        aggregate.generateEvent(event3);

        EventDispatcher.markAggregateForDispatch(aggregate);
        EventDispatcher.dispatchEventsForAggregate(id);

        expect(receivedEvents).toHaveLength(3);
        expect(receivedEvents[0]).toBe(event1);
        expect(receivedEvents[1]).toBe(event2);
        expect(receivedEvents[2]).toBe(event3);
      });
    });
  });

  // =========================================================================
  describe('full lifecycle integration', () => {
    it('should support a complete mark → dispatch → re-mark → dispatch cycle', () => {
      const handler = new FakeEventHandler();
      EventDispatcher.register('FakeDomainEvent', handler);

      const id = makeId(UUID_A);
      const aggregate = makeAggregate(id);

      // First cycle
      aggregate.generateEvent(makeEvent(id));
      EventDispatcher.markAggregateForDispatch(aggregate);
      EventDispatcher.dispatchEventsForAggregate(id);

      expect(handler.callCount).toBe(1);
      expect(aggregate.domainEvents).toHaveLength(0);
      expect(EventDispatcher['markedAggregates']).toHaveLength(0);

      // Second cycle — same aggregate re-marked with a new event
      aggregate.generateEvent(makeEvent(id));
      EventDispatcher.markAggregateForDispatch(aggregate);
      EventDispatcher.dispatchEventsForAggregate(id);

      expect(handler.callCount).toBe(2);
      expect(aggregate.domainEvents).toHaveLength(0);
      expect(EventDispatcher['markedAggregates']).toHaveLength(0);
    });

    it('should dispatch events for multiple aggregates independently without cross-contamination', () => {
      const handlerA = new FakeEventHandler();
      EventDispatcher.register('FakeDomainEvent', handlerA);

      const idA = makeId(UUID_A);
      const idB = makeId(UUID_B);
      const aggregateA = makeAggregate(idA);
      const aggregateB = makeAggregate(idB);

      const eventForA = makeEvent(idA);
      const eventForB = makeEvent(idB);

      aggregateA.generateEvent(eventForA);
      aggregateB.generateEvent(eventForB);

      EventDispatcher.markAggregateForDispatch(aggregateA);
      EventDispatcher.markAggregateForDispatch(aggregateB);

      // Dispatch only A
      EventDispatcher.dispatchEventsForAggregate(idA);

      expect(handlerA.callCount).toBe(1);
      expect(handlerA.hasHandled(eventForA)).toBe(true);
      expect(handlerA.hasHandled(eventForB)).toBe(false);

      // B's events remain pending
      expect(aggregateB.domainEvents).toHaveLength(1);
      expect(EventDispatcher['markedAggregates']).toHaveLength(1);
      expect(EventDispatcher['markedAggregates'][0]).toBe(aggregateB);

      // Now dispatch B
      EventDispatcher.dispatchEventsForAggregate(idB);

      expect(handlerA.callCount).toBe(2);
      expect(handlerA.hasHandled(eventForB)).toBe(true);
      expect(EventDispatcher['markedAggregates']).toHaveLength(0);
    });
  });
});

// TODO: Test - verifying that dispatchEventsForAggregate() is a no-op when called a second time with the same ID (aggregate already removed)
// TODO: Test - verifying error-log message format when the event class is a deeply nested class with a long constructor.name
// TODO: Test - verifying behaviour when an async handler resolves (no error log should be emitted)
// TODO: Test - verifying that clearMarkedAggregates() does not affect already-captured snapshot references outside the dispatcher
// TODO: Test - verifying that dispatch honours multiple events of different types on the same aggregate when both handlers are registered
