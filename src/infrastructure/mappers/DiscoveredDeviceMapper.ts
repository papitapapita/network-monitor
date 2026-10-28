import { DiscoveredDeviceId } from 'domain/shared/ids';
import { DiscoveredDevice } from 'domain/device-inventory/aggregates';
import { DiscoverySource } from 'domain/device-inventory/enums';

export type PrismaDiscoveredDeviceRecord = {
  id: string;
  macAddress: string;
  ipAddress: string | null;
  manufacturer: string | null;
  source: string;
  segment: string | null;
  hostname: string | null;
  model: string | null;
  accessPointId: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  ignoredAt: Date | null;
};

export class DiscoveredDeviceMapper {
  public static toDomain(
    raw: PrismaDiscoveredDeviceRecord
  ): DiscoveredDevice {
    const idResult = DiscoveredDeviceId.parse(raw.id);
    if (idResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid id "${raw.id}" in discovered_devices`
      );
    }

    return DiscoveredDevice.reconstitute(idResult.value, {
      macAddress: raw.macAddress,
      ipAddress: raw.ipAddress,
      manufacturer: raw.manufacturer,
      source: raw.source as DiscoverySource,
      segment: raw.segment,
      hostname: raw.hostname,
      model: raw.model,
      accessPointId: raw.accessPointId,
      firstSeenAt: raw.firstSeenAt,
      lastSeenAt: raw.lastSeenAt,
      ignoredAt: raw.ignoredAt
    });
  }

  public static toPersistence(
    entity: DiscoveredDevice
  ): PrismaDiscoveredDeviceRecord {
    return {
      id: entity.id.toString(),
      macAddress: entity.macAddress,
      ipAddress: entity.ipAddress,
      manufacturer: entity.manufacturer,
      source: entity.source,
      segment: entity.segment,
      hostname: entity.hostname,
      model: entity.model,
      accessPointId: entity.accessPointId,
      firstSeenAt: entity.firstSeenAt,
      lastSeenAt: entity.lastSeenAt,
      ignoredAt: entity.ignoredAt
    };
  }
}
