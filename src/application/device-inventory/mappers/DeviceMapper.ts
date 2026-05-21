import { Device } from '../../../domain/device-inventory/aggregates/Device';
import { DeviceResponseDTO } from '../dtos/DeviceResponseDTO';
import { DeviceListResponseDTO } from '../dtos/DeviceListResponseDTO';

/**
 * Mapper for pure data structure transformation between the Device domain
 * aggregate and its application-layer DTOs.
 *
 * Responsibilities (ONLY):
 * - Extract primitive values from the Device aggregate and its Value Objects.
 * - Convert domain enum values (DeviceStatus, DeviceCategory, DeviceOwnerType)
 *   to their string representations.
 * - Convert Date instances to ISO 8601 strings.
 * - Assemble pagination metadata for list responses.
 *
 * Does NOT:
 * - Validate business rules (use case responsibility).
 * - Create Value Objects (use case responsibility).
 * - Create domain aggregates (use case responsibility).
 * - Map string enums to domain enums (use case responsibility).
 * - Call repositories or external services.
 * - Perform any side effects.
 */
export class DeviceMapper {
  /**
   * Converts a Device domain aggregate to a response DTO.
   * Pure data transformation only — extracts primitives from Value Objects.
   *
   * @param device - Persisted Device domain aggregate
   * @returns Response DTO with complete device information
   */
  public static toDTO(device: Device): DeviceResponseDTO {
    return {
      // Extract string ID from the DeviceId value object
      id: device.id.toString(),

      // Extract string ID from DeviceModelId value object
      deviceModelId: device.deviceModelId.toString(),

      // Extract string ID from LocationId value object, or null
      locationId: device.locationId
        ? device.locationId.toString()
        : null,

      // Extract string value from DeviceStatus value object
      status: device.status.toString(),

      // Extract string value from DeviceCategory value object, or null
      category: device.category ? device.category.toString() : null,

      ownerType: device.ownerType ?? null,

      // Extract string value from DeviceName value object
      name: device.name.toString(),

      // Extract string value from SerialNumber value object, or null
      serialNumber: device.serialNumber
        ? device.serialNumber.toString()
        : null,

      // Extract normalized string from MACAddress value object, or null
      macAddress: device.macAddress
        ? device.macAddress.toString()
        : null,

      // Extract string from IPAddress value object, or null
      ipAddress: device.ipAddress
        ? device.ipAddress.toString()
        : null,

      // Primitive field (direct access)
      description: device.description,

      // Convert Date to ISO 8601 string, or null
      installedDate: device.installedDate
        ? device.installedDate.toISOString()
        : null,

      // Primitive boolean field
      monitoringEnabled: device.monitoringEnabled,

      // Convert Date instances to ISO 8601 strings
      createdAt: device.createdAt.toISOString(),
      updatedAt: device.updatedAt.toISOString()
    };
  }

  /**
   * Converts an array of Device aggregates to a paginated list response DTO.
   * Includes pagination metadata and a hasMore flag derived from the total count.
   *
   * @param devices - Page of Device aggregates (already sliced by the use case)
   * @param total - Total number of devices matching the query (before pagination)
   * @param limit - Page size used for the current query
   * @param offset - Number of items skipped before the current page
   * @returns Paginated list response DTO
   */
  public static toListDTO(
    devices: Device[],
    total: number,
    limit: number = 20,
    offset: number = 0
  ): DeviceListResponseDTO {
    return {
      devices: devices.map((device) => this.toDTO(device)),
      total,
      hasMore: offset + devices.length < total,
      limit,
      offset
    };
  }
}
