import { UniqueEntityID } from '../../core';

/**
 * Represents a domain event in Domain-Driven Design (DDD).
 *
 * A domain event models something significant that happened
 * **inside the domain** (business logic), such as:
 * - UserRegistered
 * - OrderPaid
 * - DeviceWentOffline
 *
 * Domain events allow the system to react to important changes
 * without tightly coupling components.
 */
export interface IDomainEvent {
  /**
   * The exact date and time when the event occurred.
   */
  dateTimeOccurred: Date;

  /**
   * Returns the ID of the aggregate that produced the event.
   *
   * This allows the event dispatcher to know which object
   * triggered the event.
   */
  getAggregateId(): UniqueEntityID;
}

/**
 * Type definition for a domain event handler function.
 *
 * An event handler processes a specific domain event
 * when it is dispatched by the event dispatcher.
 *
 * @param event - The domain event to handle.
 */
export type EventHandler = (event: IDomainEvent) => void;
