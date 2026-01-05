/**
 * Domain Entities
 *
 * This module exports all entity classes for the Network Management System.
 * Entities are domain objects with unique identity and lifecycle.
 */

// NetworkDevice aggregate
export * from '../value-objects/NetworkDeviceId';

// Polling entities
export * from './PollingConfiguration';
export * from '../aggregates/PollingResult';
