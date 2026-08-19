import { IDomainEvent, IHandle } from '../interfaces';
import { AggregateRoot } from './AggregateRoot';
import { UniqueEntityID } from './UniqueEntityID';

export type EventHandlerErrorReporter = (
  eventClassName: string,
  error: Error
) => void;

export abstract class EventDispatcher {
  private static handlersMap: Map<string, IHandle<IDomainEvent>[]> =
    new Map();

  private static markedAggregates: AggregateRoot<
    unknown,
    UniqueEntityID
  >[] = [];

  // The domain layer cannot depend on ILogger, so composition root injects a
  // reporter instead. Defaults to a no-op: handler failures are already
  // isolated from the dispatch loop, reporting them is the outer layer's job.
  private static errorReporter: EventHandlerErrorReporter = () => {};

  public static setErrorReporter(
    reporter: EventHandlerErrorReporter
  ): void {
    this.errorReporter = reporter;
  }

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

  private static dispatchAggregateEvents<
    T,
    TID extends UniqueEntityID
  >(aggregate: AggregateRoot<T, TID>): void {
    aggregate.domainEvents.forEach((event: IDomainEvent) =>
      this.dispatch(event)
    );
  }

  private static removeAggregateFromMarkedDispatchList<
    T,
    TID extends UniqueEntityID
  >(aggregate: AggregateRoot<T, TID>): void {
    const index = this.markedAggregates.findIndex((a) =>
      a.equals(aggregate)
    );
    this.markedAggregates.splice(index, 1);
  }

  private static findMarkedAggregateByID(
    id: UniqueEntityID
  ): AggregateRoot<unknown, UniqueEntityID> | undefined {
    return this.markedAggregates.find((aggregate) =>
      aggregate.id.equals(id)
    );
  }

  // call after a successful repository save — dispatches then clears events
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

  public static register<T extends IDomainEvent>(
    eventClassName: string,
    handler: IHandle<T>
  ): void {
    if (!this.handlersMap.has(eventClassName)) {
      this.handlersMap.set(eventClassName, []);
    }
    this.handlersMap
      .get(eventClassName)!
      .push(handler as IHandle<IDomainEvent>);
  }

  public static clearHandlers(): void {
    // for testing
    this.handlersMap = new Map();
  }

  public static clearMarkedAggregates(): void {
    // for testing
    this.markedAggregates = [];
  }

  public static clearErrorReporter(): void {
    // for testing
    this.errorReporter = () => {};
  }

  // reporting must never take down the dispatch loop it is reporting from
  private static report(
    eventClassName: string,
    error: unknown
  ): void {
    try {
      this.errorReporter(
        eventClassName,
        error instanceof Error ? error : new Error(String(error))
      );
    } catch {
      // swallowed deliberately
    }
  }

  private static dispatch(event: IDomainEvent): void {
    const eventClassName: string = event.constructor.name;

    if (this.handlersMap.has(eventClassName)) {
      const handlers: IHandle<IDomainEvent>[] =
        this.handlersMap.get(eventClassName)!;
      for (const handler of handlers) {
        try {
          const result = handler.handle(event);
          if (result instanceof Promise) {
            result.catch((error) => {
              this.report(eventClassName, error);
            });
          }
        } catch (error) {
          this.report(eventClassName, error);
        }
      }
    }
  }
}
