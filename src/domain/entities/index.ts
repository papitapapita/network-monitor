/**
 * Domain Entities
 *
 * This module exports all entity classes for the Network Management System.
 * Entities are domain objects with unique identity and lifecycle.
 */

// NetworkDevice aggregate
export { NetworkDeviceId } from './NetworkDeviceId';
export {
  NetworkDevice,
  NetworkDeviceProps,
  ConnectivityType,
  ManagementProtocol
} from './NetworkDevice';

// Polling entities
export { PollingConfigurationId } from './PollingConfigurationId';
export {
  PollingConfiguration,
  PollingConfigurationProps
} from './PollingConfiguration';
export { PollingResultId } from './PollingResultId';
export { PollingResult, PollingResultProps } from './PollingResult';
