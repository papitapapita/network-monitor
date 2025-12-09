import { IDomainEvent, EventHandler } from '../';
import { AggregateRoot } from './AggregateRoot';
import { UniqueEntityID } from './UniqueEntityID';

/**
 * DomainEvents is a static event dispatcher used in Domain-Driven Design (DDD)
 * to track and publish domain events raised by Aggregate Roots.
 *
 * This system allows the domain layer to express important business events
 * (e.g., `UserCreated`, `OrderPaid`, etc.) without depending directly on
 * infrastructure code.
 *
 * The DomainEvents class:
 * - Stores handlers (subscribers) for each event type.
 * - Keeps a list of Aggregate Roots that have un-dispatched events.
 * - Dispatches domain events AFTER the aggregate has been persisted.
 *
 * Usage pattern:
 * 1. An AggregateRoot calls `this.addDomainEvent()` internally.
 * 2. The application service calls `DomainEvents.markAggregateForDispatch()`.
 * 3. After persistence, the service calls `DomainEvents.dispatchEventsForAggregate()`.
 * 4. Registered handlers are executed for each event.
 */
export abstract class DomainEvents {
  /**
   * Internal map storing event handlers by event class name.
   * Key: event class name
   * Value: array of handlers listening to that event
   */
  private static handlersMap: Map<string, EventHandler[]> = new Map();

  /**
   * List of aggregates that have domain events pending dispatch.
   */
  private static markedAggregates: AggregateRoot<any, any>[] = [];

  /**
   * Marks the given Aggregate Root so its domain events will be dispatched later.
   *
   * This should be called in your application service AFTER saving the aggregate
   * to your database or repository.
   *
   * @param aggregate - The AggregateRoot instance that contains pending events.
   */
  public static markAggregateForDispatch<
    T,
    TID extends UniqueEntityID
  >(aggregate: AggregateRoot<T, TID>): void {
    const aggregateFound = !!this.findMarkedAggregateByID(
      aggregate.id
    );

    if (!aggregateFound) {
      this.markedAggregates.push(aggregate);
    }
  }

  /**
   * Dispatches all domain events recorded inside the given aggregate.
   *
   * @param aggregate - The AggregateRoot whose events should be dispatched.
   */
  private static dispatchAggregateEvents<
    T,
    TID extends UniqueEntityID
  >(aggregate: AggregateRoot<T, TID>): void {
    aggregate.domainEvents.forEach((event: IDomainEvent) =>
      this.dispatch(event)
    );
  }

  /**
   * Removes an aggregate from the dispatch list after its events
   * have already been sent.
   *
   * @param aggregate - The AggregateRoot that should be removed.
   */
  private static removeAggregateFromMarkedDispatchList<
    T,
    TID extends UniqueEntityID
  >(aggregate: AggregateRoot<T, TID>): void {
    const index = this.markedAggregates.findIndex((a) =>
      a.equals(aggregate)
    );
    this.markedAggregates.splice(index, 1);
  }

  /**
   * Finds a marked aggregate by its ID.
   *
   * @param id - The UniqueEntityID instance of the aggregate.
   * @returns The matching AggregateRoot instance, or undefined if not found.
   */
  private static findMarkedAggregateByID<
    K,
    KID extends UniqueEntityID
  >(id: KID): AggregateRoot<K, KID> | undefined {
    return this.markedAggregates.find((aggregate) =>
      aggregate.id.equals(id)
    );
  }

  /**
   * Dispatches all events for the aggregate with the given ID.
   *
   * Steps:
   * 1. Find aggregate
   * 2. Dispatch its events
   * 3. Clear the events inside the aggregate
   * 4. Remove aggregate from the marked list
   *
   * Typically called after a successful repository save.
   *
   * @param id - The UniqueEntityID of the aggregate.
   */
  public static dispatchEventsForAggregate<
    TID extends UniqueEntityID
  >(id: TID): void {
    const aggregate = this.findMarkedAggregateByID(id);

    if (aggregate) {
      this.dispatchAggregateEvents(aggregate);
      aggregate.clearEvents();
      this.removeAggregateFromMarkedDispatchList(aggregate);
    }
  }

  /**
   * Registers a handler (subscriber) for a specific domain event type.
   *
   * Example:
   * DomainEvents.register("UserCreatedEvent", handlerFn);
   *
   * @param eventClassName - The name of the event class.
   * @param callback - The handler function to execute when the event is dispatched.
   */
  public static register(
    eventClassName: string,
    callback: EventHandler
  ): void {
    if (!this.handlersMap.has(eventClassName)) {
      this.handlersMap.set(eventClassName, []);
    }
    this.handlersMap.get(eventClassName)!.push(callback);
  }

  /**
   * Clears all registered event handlers.
   * Useful for testing.
   */
  public static clearHandlers(): void {
    this.handlersMap = new Map();
  }

  /**
   * Clears the list of aggregates that are pending event dispatch.
   * Useful for testing.
   */
  public static clearMarkedAggregates(): void {
    this.markedAggregates = [];
  }

  /**
   * Dispatches a single event by executing all handlers
   * registered for its event class name.
   *
   * @param event - The domain event instance to dispatch.
   */
  private static dispatch(event: IDomainEvent): void {
    const eventClassName: string = event.constructor.name;

    if (this.handlersMap.has(eventClassName)) {
      const handlers: EventHandler[] =
        this.handlersMap.get(eventClassName)!;
      for (const handler of handlers) {
        handler(event);
      }
    }
  }
}
