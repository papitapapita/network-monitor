import { WirelessDeviceConfig } from 'domain/wireless-monitoring/aggregates';
import { WirelessDeviceConfigProps } from 'domain/wireless-monitoring/props';
import { DeviceId } from 'domain/shared';
import { WirelessDeviceConfigId } from 'domain/shared/ids';
import { IPAddress, PollingInterval } from 'domain/shared/value-objects';

type PrismaWirelessDeviceConfigRow = {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  intervalSecs: number;
  deviceType: string;
  linkCapacityBps: bigint | null;
  clientsProvisionedLimit: number | null;
  lastPolledAt: Date | null;
  targetFirmwareVersion: string | null;
  maxLinkDistanceM: number | null;
};

type PersistenceData = {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  intervalSecs: number;
  deviceType: string;
  linkCapacityBps: bigint | null;
  clientsProvisionedLimit: number | null;
  lastPolledAt: Date | null;
  targetFirmwareVersion: string | null;
  maxLinkDistanceM: number | null;
};

export class WirelessDeviceConfigPrismaMapper {
  static toDomain(
    raw: PrismaWirelessDeviceConfigRow
  ): WirelessDeviceConfig {
    const deviceId = DeviceId.parse(raw.deviceId);
    if (deviceId.isFailure)
      throw new Error(`Invalid device ID: ${deviceId.error}`);
    const id = WirelessDeviceConfigId.parse(raw.id);
    if (id.isFailure)
      throw new Error(`Invalid config ID: ${id.error}`);

    const ipAddress: IPAddress | null = raw.ipAddress
      ? IPAddress.reconstitute(raw.ipAddress)
      : null;

    const props: WirelessDeviceConfigProps = {
      deviceId: deviceId.value,
      ipAddress,
      enabled: raw.enabled,
      pollingInterval: PollingInterval.reconstitute(raw.intervalSecs),
      deviceType: raw.deviceType as 'STATION' | 'ACCESS_POINT',
      linkCapacityBps:
        raw.linkCapacityBps !== null
          ? Number(raw.linkCapacityBps)
          : null,
      clientsProvisionedLimit: raw.clientsProvisionedLimit,
      lastPolledAt: raw.lastPolledAt,
      targetFirmwareVersion: raw.targetFirmwareVersion,
      maxLinkDistanceM: raw.maxLinkDistanceM
    };

    return WirelessDeviceConfig.reconstitute(id.value, props);
  }

  static toPersistence(
    config: WirelessDeviceConfig
  ): PersistenceData {
    return {
      id: config.id.toString(),
      deviceId: config.deviceId.toString(),
      ipAddress: config.ipAddress?.value ?? null,
      enabled: config.enabled,
      intervalSecs: config.pollingInterval.seconds,
      deviceType: config.deviceType,
      linkCapacityBps:
        config.linkCapacityBps !== null
          ? BigInt(config.linkCapacityBps)
          : null,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      lastPolledAt: config.lastPolledAt,
      targetFirmwareVersion: config.targetFirmwareVersion,
      maxLinkDistanceM: config.maxLinkDistanceM
    };
  }
}
