/**
 * Data Transfer Objects (DTOs) for NetworkDevice operations.
 *
 * These DTOs define the contract between the presentation layer (HTTP)
 * and the application layer (use cases).
 *
 * Separation of concerns:
 * - Domain entities: Business logic and invariants
 * - DTOs: Data structure for external communication
 * - Mappers: Convert between entities and DTOs
 *
 * REQ-002: Enhanced with lifecycle management DTOs:
 * - ActivateNetworkDeviceRequestDTO: DRAFT → ACTIVE transition
 * - SoftDeleteNetworkDeviceRequestDTO: Soft delete with 7-day grace period
 * - RestoreNetworkDeviceRequestDTO: Restore from soft delete
 */

// ===================================
// REQUEST DTOs (Input)
// ===================================
/*export * from './CreateNetworkDeviceDTO';
export * from './UpdateNetworkDeviceDTO';
export * from './DeleteNetworkDeviceDTO';
export * from './GetNetworkDeviceByIpDTO';
export * from './ListNetworkDevicesQueryDTO';
export * from './ConfigureDevicePollingDTO';

// REQ-002: Lifecycle Management Request DTOs
export * from './ActivateNetworkDeviceRequestDTO';
export * from './SoftDeleteNetworkDeviceRequestDTO';
export * from './RestoreNetworkDeviceRequestDTO';

// ===================================
// RESPONSE DTOs (Output)
// ===================================
export * from './NetworkDeviceResponseDTO';
export * from './NetworkDeviceListResponseDTO';

// REQ-002: Bulk Import Response DTO
export * from './BulkImportRequestDTO';
export * from './BulkImportResponseDTO';
*/
export * from './CreateLocationRequestDTO';
export * from './GetLocationRequestDTO';
export * from './ListLocationsQueryDTO';
export * from './LocationListResponseDTO';
export * from './LocationResponseDTO';
