/**
 * Domain Events
 *
 * This module exports all domain events for the Network Management System.
 * Domain events represent significant occurrences within the domain that
 * other parts of the system may need to react to.
 */

// NetworkDevice events
export * from './NetworkDeviceCreatedEvent';
export * from './NetworkDeviceStatusChangedEvent';

// Polling events
export * from './DevicePolledSuccessfullyEvent';
export * from './DevicePollingFailedEvent';
export * from './PollingIntervalChangedEvent';
export * from './PingCountChangedEvent';
export * from './PollingConfigurationChangedEvent';
export * from './NetworkDeviceUpdatedEvent';
export * from './NetworkDeviceDeletedEvent';
