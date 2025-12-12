import { NetworkDevice } from '../../domain';
import {
  NetworkDeviceResponseDTO,
  NetworkDeviceListResponseDTO,
  CreateNetworkDeviceDTO,
  UpdateNetworkDeviceDTO
} from '../dtos';

/**
 * Mapper for pure data structure transformation between DTOs and Domain.
 *
 * Responsibilities (ONLY):
 * - Transform data structures (DTO ↔ Domain)
 * - Extract primitive values from Value Objects
 * - Flatten nested domain structures into DTOs
 * - Provide data-level defaults for optional DTO fields
 *
 * Does NOT:
 * - Validate business rules (use case responsibility)
 * - Create value objects (use case responsibility)
 * - Create domain entities (use case responsibility)
 * - Make business decisions (use case responsibility)
 * - Map string enums to domain enums (use case responsibility)
 * - Call repositories or external services
 * - Perform any side effects
 *
 * @see APPLICATION-MAPPER-STANDARD.md for complete specification
 */
export class NetworkDeviceMapper {
  /**
   * Converts a NetworkDevice domain entity to response DTO.
   * Pure data transformation only - extracts primitives from Value Objects.
   *
   * @param device - Domain entity
   * @returns Response DTO with complete device information
   */
  public static toDTO(
    device: NetworkDevice
  ): NetworkDeviceResponseDTO {
    return {
      // Extract string ID from Value Object
      id: device.id.toString(),

      // Primitive fields (direct access)
      name: device.name,
      description: device.description,
      installDate: device.installDate,
      managementPort: device.managementPort,
      enabledRemoteAccess: device.enabledRemoteAccess,
      deviceId: device.deviceId,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,

      // Extract string values from Value Objects
      ipAddress: device.ipAddress.toString(),
      macAddress: device.macAddress.toString(),

      // Extract string values from domain enums
      deviceType: device.deviceType.toString(),
      status: device.status.toString(),
      connectivityType: device.connectivityType.toString(),
      managementProtocol: device.managementProtocol.toString(),

      // Flatten nested PollingConfiguration aggregate
      pollingConfiguration: {
        id: device.pollingConfiguration.id.toString(),
        enabled: device.pollingConfiguration.enabled,
        intervalSeconds: device.pollingConfiguration.interval.seconds,
        pingCount: device.pollingConfiguration.pingCount,
        maxRetryAttempts:
          device.pollingConfiguration.retryPolicy.maxAttempts,
        retryDelayMs:
          device.pollingConfiguration.retryPolicy.baseDelayMs,
        lastScheduledAt: device.pollingConfiguration.lastScheduledAt,
        nextScheduledAt: device.pollingConfiguration.nextScheduledAt
      }
    };
  }

  /**
   * Converts an array of NetworkDevice entities to list response DTO.
   * Includes pagination metadata.
   *
   * @param devices - Array of domain entities
   * @param total - Total count (for pagination metadata)
   * @param limit - Current limit
   * @param offset - Current offset
   * @returns List response DTO with pagination metadata
   */
  public static toListDTO(
    devices: NetworkDevice[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): NetworkDeviceListResponseDTO {
    return {
      devices: devices.map((device) => this.toDTO(device)),
      total,
      hasMore: offset + devices.length < total,
      limit,
      offset
    };
  }

  /**
   * Extracts raw data from CreateDTO with data-level defaults.
   *
   * Pure data transformation - no validation, no business logic.
   * Returns raw primitives (strings, numbers, booleans) that use case
   * will validate and convert to Value Objects and domain entities.
   *
   * Data-level defaults are simple fallback values (null, false, 0, 'DEFAULT')
   * that require no business knowledge. Business defaults (like polling
   * interval based on device type) are the use case's responsibility.
   *
   * @param dto - Create device DTO from HTTP request
   * @returns Object with raw data ready for use case processing
   */
  public static extractCreateData(dto: CreateNetworkDeviceDTO) {
    return {
      // Required fields (as-is, no validation)
      name: dto.name,
      deviceType: dto.deviceType,
      ipAddress: dto.ipAddress,
      macAddress: dto.macAddress,
      deviceId: dto.deviceId,

      // Optional fields with data-level defaults (not business defaults)
      // These are simple structural defaults that require no domain knowledge
      description: dto.description ?? null,
      location: dto.location ?? null,
      connectivityType: dto.connectivityType ?? 'ETHERNET',
      managementProtocol: dto.managementProtocol ?? 'ICMP',
      managementPort: dto.managementPort ?? 161,
      enabledRemoteAccess: dto.enabledRemoteAccess ?? false,
      performPingTest: dto.performPingTest ?? false
    };
  }

  /**
   * Extracts update data from UpdateDTO.
   *
   * Pure data transformation - no validation, no domain method calls.
   * Returns only the fields present in the DTO (partial update support).
   *
   * The use case will:
   * - Validate the extracted data
   * - Map string enums to domain enums
   * - Call appropriate domain methods (updateName, updateDescription, etc.)
   *
   * @param dto - Update device DTO with partial fields
   * @returns Object with only the fields that were provided in DTO
   */
  public static extractUpdateData(dto: UpdateNetworkDeviceDTO) {
    const updates: any = {};

    // Only include fields that are explicitly provided in the DTO
    // This enables partial updates
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined)
      updates.description = dto.description;
    if (dto.deviceType !== undefined) updates.deviceType = dto.deviceType;
    if (dto.connectivityType !== undefined)
      updates.connectivityType = dto.connectivityType;
    if (dto.managementProtocol !== undefined)
      updates.managementProtocol = dto.managementProtocol;
    if (dto.managementPort !== undefined)
      updates.managementPort = dto.managementPort;
    if (dto.enabledRemoteAccess !== undefined)
      updates.enabledRemoteAccess = dto.enabledRemoteAccess;

    return updates;
  }
}
