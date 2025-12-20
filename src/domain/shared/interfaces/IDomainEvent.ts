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
   * The ID of the aggregate that produced the event.
   * This allows the event dispatcher to know which object
   * triggered the event.
   */
  aggregateId: UniqueEntityID;
}
