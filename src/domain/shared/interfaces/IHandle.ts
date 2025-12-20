import { IDomainEvent } from './IDomainEvent';

/**
 * Interface for domain event handlers.
 *
 * Handlers subscribe to specific domain event types and process them
 * when they are dispatched by the EventDispatcher dispatcher.
 *
 * Each handler class should:
 * - Implement this interface for a specific event type
 * - Contain all necessary dependencies (repositories, services)
 * - Be resilient (catch and log errors, don't throw)
 * - Be registered at application startup
 *
 * @template T - The type of domain event this handler processes
 *
 * @example
 * ```typescript
 * export class DeviceStatusChangedHandler
 *   implements IHandle<NetworkDeviceStatusChangedEvent>
 * {
 *   constructor(
 *     private readonly alertRepo: IAlertRepository,
 *     private readonly emailService: IEmailService
 *   ) {}
 *
 *   async handle(event: NetworkDeviceStatusChangedEvent): Promise<void> {
 *     try {
 *       if (event.isGoingOffline()) {
 *         // Create alert and send notification
 *       }
 *     } catch (error) {
 *       console.error('Error handling event:', error);
 *     }
 *   }
 * }
 * ```
 */
export interface IHandle<T extends IDomainEvent> {
  /**
   * Handles the domain event.
   *
   * This method is called by the EventDispatcher dispatcher when
   * an event of type T is dispatched.
   *
   * Handlers should:
   * - Be idempotent (safe to call multiple times)
   * - Be resilient (catch errors, don't throw)
   * - Log errors for debugging
   * - Use eventual consistency patterns
   * - Not make assumptions about execution order
   *
   * @param event - The domain event to handle
   * @returns Promise that resolves when handling is complete
   */
  handle(event: T): Promise<void> | void;
}
