/**
 * Domain Repository Interfaces
 *
 * This module exports all repository interfaces for the Network Management System.
 * Repository interfaces define the contract for data persistence without
 * coupling the domain layer to specific infrastructure implementations.
 */

export * from '../../device-inventory/repository/INetworkDeviceRepository';
export * from './IPollingResultRepository';
