import { WirelessPollingConfig } from 'domain/wireless-monitoring';
import { WirelessConfigResponseDTO } from '../dtos/WirelessConfigResponseDTO';

/**
 * WirelessPollingConfigMapper
 *
 * Responsible for transforming WirelessPollingConfig domain entities into
 * application-layer DTOs. Contains no business logic — structural mapping only.
 *
 * Mapping direction: Domain → DTO (read-only, outbound).
 */
export class WirelessPollingConfigMapper {
  /**
   * Maps a WirelessPollingConfig entity to its response DTO.
   *
   * Converts domain identifiers and value objects to primitives,
   * and serialises the lastPolledAt date to ISO 8601.
   *
   * @param config - The WirelessPollingConfig entity to map
   * @returns WirelessConfigResponseDTO ready for presentation
   */
  static toDTO(
    config: WirelessPollingConfig
  ): WirelessConfigResponseDTO {
    return {
      id: config.id.toString(),
      deviceId: config.deviceId.toString(),
      ipAddress: config.ipAddress?.value ?? null,
      enabled: config.enabled,
      intervalSecs: config.intervalSecs,
      deviceType: config.deviceType,
      linkCapacityBps: config.linkCapacityBps,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      lastPolledAt: config.lastPolledAt?.toISOString() ?? null
    };
  }
}
