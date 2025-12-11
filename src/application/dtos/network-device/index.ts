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
 */
export * from './CreateNetworkDeviceDTO';
export * from './DeleteNetworkDeviceDTO';
export * from './GetNetworkDeviceByIpDTO';
export * from './ListNetworkDevicesQueryDTO';
export * from './NetworkDeviceListResponseDTO';
export * from './NetworkDeviceResponseDTO';
export * from './UpdateNetworkDeviceDTO';
