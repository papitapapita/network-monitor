/**
 * Application Event Handlers
 *
 * Domain event handlers that perform side effects and cross-aggregate coordination.
 *
 * Event handlers implement the event-driven architecture pattern:
 * - Aggregates emit domain events when state changes
 * - Handlers listen to events and react accordingly
 * - Cross-aggregate coordination via eventual consistency
 * - Handlers are resilient (catch errors, don't throw)
 * - Handlers are idempotent (safe to retry)
 *
 * Register all handlers at application startup using DomainEvents.register()
 */
/*
export { DeviceStatusWebSocketHandler } from './DeviceStatusWebSocketHandler';
export { UpdateNetworkDevicePollingStateHandler } from './UpdateNetworkDevicePollingStateHandler';
*/
