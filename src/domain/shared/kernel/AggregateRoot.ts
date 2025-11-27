import { Entity } from './Entity';
import { IDomainEvent } from '../interfaces';

/**
 * Base class for all Aggregate Roots in Domain-Driven Design (DDD).
 *
 * An Aggregate Root:
 * - Is the main **entry point** for modifying an aggregate.
 * - Enforces business invariants for the entire aggregate.
 * - Can publish domain events when important business actions occur.
 *
 * The AggregateRoot class extends the `Entity` class and adds
 * the ability to track and manage domain events generated
 * by the aggregate.
 *
 * @typeParam T - The shape of the properties stored in the entity.
 */
export class AggregateRoot<T> extends Entity<T> {
  /**
   * Internal collection of domain events raised by this aggregate.
   *
   * Events are stored here until a dispatcher processes them.
   */
  private _domainEvents: IDomainEvent[] = [];

  /**
   * Returns all domain events that the aggregate has raised.
   *
   * These events are typically handled by an event dispatcher
   * after the aggregate operation completes.
   */
  get domainEvents(): IDomainEvent[] {
    return this._domainEvents;
  }

  /**
   * Registers a new domain event inside the aggregate.
   *
   * Use this method whenever something meaningful happens
   * in the business logic (e.g., "DeviceWentOffline").
   *
   * @param domainEvent - The domain event to add.
   */
  protected addDomainEvent(domainEvent: IDomainEvent): void {
    this._domainEvents.push(domainEvent);
  }

  /**
   * Clears all stored domain events.
   *
   * This is typically called by the event dispatcher AFTER
   * all events have been published.
   */
  public clearEvents(): void {
    this._domainEvents.splice(0, this._domainEvents.length);
  }
}
