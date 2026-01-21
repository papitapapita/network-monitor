import { NetworkDevice } from '../../domain';
import {
  NetworkDeviceResponseDTO,
  NetworkDeviceListResponseDTO,
  CreateNetworkDeviceDTO,
  UpdateNetworkDeviceDTO,
  ActivateNetworkDeviceRequestDTO,
  SoftDeleteNetworkDeviceRequestDTO,
  RestoreNetworkDeviceRequestDTO
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
      deviceId: device.deviceId,
      managementPort: device.managementPort,
      enabledRemoteAccess: device.enabledRemoteAccess,

      // Extract string values from Value Objects
      ipAddress: device.ipAddress.toString(),
      macAddress: device.macAddress.toString(),

      // Extract string values from domain enums
      deviceType: device.deviceType.toString(),
      status: device.status.toString(),
      connectivityType: device.connectivityType.toString(),
      managementProtocol: device.managementProtocol.toString(),

      // REQ-002: Activation workflow fields
      activationStatus: device.activationStatus.toString(),
      activatedAt: device.activatedAt?.toISOString() ?? null,
      activatedBy: device.activatedBy ?? null,

      // REQ-002: Soft delete fields
      deletedAt: device.deletedAt?.toISOString() ?? null,
      deletedBy: device.deletedBy ?? null,

      // REQ-002: Device replacement fields
      replacedByDeviceId:
        device.replacedByDeviceId?.toString() ?? null,
      replacedAt: device.replacedAt?.toISOString() ?? null,

      // Timestamps (convert to ISO strings)
      installDate: device.installDate.toISOString(),
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString(),

      // Flatten nested PollingConfiguration aggregate
      pollingConfiguration: {
        networkDeviceId:
          device.pollingConfiguration.networkDeviceId.toString(),
        id: device.pollingConfiguration.id.toString(),
        enabled: device.pollingConfiguration.enabled,
        intervalSeconds: device.pollingConfiguration.interval.seconds,
        pingCount: device.pollingConfiguration.pingCount,
        retryPolicy: {
          maxAttempts:
            device.pollingConfiguration.retryPolicy.maxAttempts,
          baseDelayMs:
            device.pollingConfiguration.retryPolicy.baseDelayMs
        },
        lastScheduledAt:
          device.pollingConfiguration.lastScheduledAt?.toISOString() ??
          null,
        nextScheduledAt:
          device.pollingConfiguration.nextScheduledAt?.toISOString() ??
          null
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
      // ===================================
      // REQUIRED FIELDS (Always)
      // ===================================
      ipAddress: dto.ipAddress,
      macAddress: dto.macAddress,
      deviceId: dto.deviceId,

      // ===================================
      // CONDITIONAL FIELDS (Required for ACTIVE)
      // ===================================
      name: dto.name ?? null,
      deviceType: dto.deviceType ?? null,

      // ===================================
      // OPTIONAL FIELDS
      // ===================================
      // These are simple structural defaults that require no domain knowledge
      description: dto.description ?? null,
      location: dto.location ?? null,
      connectivityType: dto.connectivityType ?? null,
      managementProtocol: dto.managementProtocol ?? null,
      managementPort: dto.managementPort ?? null,
      enabledRemoteAccess: dto.enabledRemoteAccess ?? null,
      performPingTest: dto.performPingTest ?? null,

      // ===================================
      // REQ-002: ACTIVATION CONTROL
      // ===================================
      // Whether to activate immediately (false = DRAFT, true = ACTIVE)
      activateImmediately: dto.activateImmediately ?? false
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
    const updates: Partial<CreateNetworkDeviceDTO> = {};

    // Only include fields that are explicitly provided in the DTO
    // This enables partial updates
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.description !== undefined)
      updates.description = dto.description;
    if (dto.deviceType !== undefined)
      updates.deviceType = dto.deviceType;
    if (dto.location !== undefined)
      // REQ-002
      updates.location = dto.location;
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

  // ===================================
  // REQ-002: LIFECYCLE MANAGEMENT METHODS
  // ===================================

  /**
   * Extracts data for activating a DRAFT device to ACTIVE.
   *
   * Pure data transformation - the use case will:
   * - Validate device exists and is in DRAFT status
   * - Validate all required fields are provided
   * - Map string enums to domain enums
   * - Call domain's activate() method
   * - Set activatedAt timestamp and activatedBy from context
   *
   * @param dto - Activate device request DTO
   * @returns Object with raw data for activation
   */
  public static extractActivateData(
    dto: ActivateNetworkDeviceRequestDTO
  ) {
    return {
      // Device ID
      id: dto.id,

      // Required for activation
      name: dto.name,
      deviceType: dto.deviceType,

      // Optional enrichment fields
      description: dto.description ?? null,
      connectivityType: dto.connectivityType ?? null,
      managementProtocol: dto.managementProtocol ?? null,
      managementPort: dto.managementPort ?? null,
      enabledRemoteAccess: dto.enabledRemoteAccess ?? null
    };
  }

  /**
   * Extracts data for soft-deleting a device.
   *
   * Pure data transformation - the use case will:
   * - Validate device ID format
   * - Validate device exists and is not already deleted
   * - Call domain's softDelete() method
   * - Set deletedAt timestamp and deletedBy from authentication context
   *
   * @param dto - Soft delete request DTO
   * @returns Object with device ID and optional deletion reason
   */
  public static extractSoftDeleteData(
    dto: SoftDeleteNetworkDeviceRequestDTO
  ) {
    return {
      id: dto.id,
      reason: dto.reason ?? null
    };
  }

  /**
   * Extracts data for restoring a soft-deleted device.
   *
   * Pure data transformation - the use case will:
   * - Validate device ID format
   * - Validate device exists and is soft-deleted
   * - Validate device is within 7-day grace period
   * - Check for IP/MAC conflicts with active devices
   * - Call domain's restore() method
   * - Clear deletedAt and deletedBy fields
   *
   * @param dto - Restore request DTO
   * @returns Object with device ID
   */
  public static extractRestoreData(
    dto: RestoreNetworkDeviceRequestDTO
  ) {
    return {
      id: dto.id
    };
  }
}
