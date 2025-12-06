/**
 * Domain Events
 *
 * This module exports all domain events for the Network Management System.
 * Domain events represent significant occurrences within the domain that
 * other parts of the system may need to react to.
 */

// NetworkDevice events
export { NetworkDeviceCreatedEvent } from './NetworkDeviceCreatedEvent';
export { NetworkDeviceStatusChangedEvent } from './NetworkDeviceStatusChangedEvent';

// Polling events
export { DevicePolledSuccessfullyEvent } from './DevicePolledSuccessfullyEvent';
export { DevicePollingFailedEvent } from './DevicePollingFailedEvent';
export { PollingIntervalChangedEvent } from './PollingIntervalChangedEvent';
export { PingCountChangedEvent } from './PingCountChangedEvent';
export { PollingConfigurationChangedEvent } from './PollingConfigurationChangedEvent';
