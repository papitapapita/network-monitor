import { DiscoveredDevice } from 'domain/device-inventory/aggregates';
import { DiscoveredDeviceDTO } from '../dtos';

export class DiscoveredDeviceMapper {
  public static toDTO(
    device: DiscoveredDevice,
    accessPointName: string | null = null
  ): DiscoveredDeviceDTO {
    return {
      id: device.id.toString(),
      macAddress: device.macAddress,
      ipAddress: device.ipAddress,
      manufacturer: device.manufacturer,
      source: device.source,
      segment: device.segment,
      hostname: device.hostname,
      model: device.model,
      accessPointId: device.accessPointId,
      accessPointName,
      firstSeenAt: device.firstSeenAt.toISOString(),
      lastSeenAt: device.lastSeenAt.toISOString(),
      ignoredAt: device.ignoredAt?.toISOString() ?? null
    };
  }
}
