import { UniqueEntityID } from './UniqueEntityID';
import { IDomainEvent } from '../interfaces';

/**
 * Base class for Domain Events used in Domain-Driven Design (DDD).
 *
 * Domain Events represent something significant that happened in the domain.
 * They are immutable records of domain occurrences, used to:
 * - Decouple aggregates from each other
 * - Trigger side effects (emails, notifications, etc.)
 * - Enable eventual consistency across aggregate boundaries
 * - Provide an audit trail of domain changes
 *
 * This base class ensures:
 * - All events are immutable (props are frozen)
 * - Consistent structure across all domain events
 * - Type-safe access to event properties
 * - Common utility methods (toString for debugging)
 *
 * Events should be named in past tense (e.g., OrderCreated, DeviceWentOffline).
 *
 * @template TProps - The shape of properties this event contains
 * @property {TProps} props - The immutable properties of the event
 */
export abstract class DomainEvent<TProps> implements IDomainEvent {
  protected readonly props: Readonly<TProps>;

  /**
   * The provided props object is frozen to prevent any mutation.
   * This ensures events remain immutable after creation, which is
   * critical for event sourcing and reliable event handling.
   *
   * @param props - The properties representing the event data
   */
  constructor(props: TProps) {
    this.props = Object.freeze({ ...props }) as Readonly<TProps>;
  }

  /**
   * Returns the ID of the aggregate that produced this event.
   *
   * This is used by the event dispatcher to track which aggregate
   * published the event and to dispatch events after the aggregate
   * has been successfully persisted.
   *
   * Must be implemented by each concrete event class.
   *
   * @returns The unique identifier of the aggregate
   */
  abstract get aggregateId(): UniqueEntityID;

  /**
   * The exact date and time when the event occurred.
   *
   * This timestamp should be set when the event is created
   * (typically in the aggregate method that creates the event).
   *
   * Must be implemented by each concrete event class to return
   * the appropriate timestamp property from props.
   *
   * @returns The timestamp when this event occurred
   */
  abstract get dateTimeOccurred(): Date;

  /**
   * Returns a string representation of the event for logging.
   *
   * Default implementation includes the event class name,
   * aggregate ID, and timestamp. Subclasses can override
   * to provide more detailed information.
   *
   * @returns A human-readable string describing the event
   */
  public toString(): string {
    return `${this.constructor.name}(aggregateId: ${this.aggregateId.toString()}, occurred: ${this.dateTimeOccurred.toISOString()})`;
  }
}
