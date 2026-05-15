import {
  WirelessPollingConfig,
  WirelessPollingConfigProps
} from 'domain/wireless-monitoring';
import { DeviceId } from 'domain/shared';
import { WirelessPollingConfigId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';

type PrismaWirelessPollingConfiguration = {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  intervalSecs: number;
  deviceType: string;
  linkCapacityBps: bigint | null;
  clientsProvisionedLimit: number | null;
  lastPolledAt: Date | null;
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
};

export class WirelessPollingConfigPrismaMapper {
  static toDomain(
    raw: PrismaWirelessPollingConfiguration
  ): WirelessPollingConfig {
    const deviceId = DeviceId.parse(raw.deviceId);
    if (deviceId.isFailure)
      throw new Error(`Invalid device ID: ${deviceId.error}`);
    const id = WirelessPollingConfigId.parse(raw.id);
    if (id.isFailure)
      throw new Error(`Invalid config ID: ${id.error}`);

    let ipAddress: IPAddress | null = null;
    if (raw.ipAddress) {
      const ipResult = IPAddress.create(raw.ipAddress);
      ipAddress = ipResult.isSuccess ? ipResult.value : null;
    }

    const props: WirelessPollingConfigProps = {
      deviceId: deviceId.value,
      ipAddress,
      enabled: raw.enabled,
      intervalSecs: raw.intervalSecs,
      deviceType: raw.deviceType as 'CPE' | 'ACCESS_POINT',
      linkCapacityBps:
        raw.linkCapacityBps !== null
          ? Number(raw.linkCapacityBps)
          : null,
      clientsProvisionedLimit: raw.clientsProvisionedLimit,
      lastPolledAt: raw.lastPolledAt
    };

    return WirelessPollingConfig.reconstitute(id.value, props);
  }

  static toPersistence(
    config: WirelessPollingConfig
  ): PersistenceData {
    return {
      id: config.id.toString(),
      deviceId: config.deviceId.toString(),
      ipAddress: config.ipAddress?.value ?? null,
      enabled: config.enabled,
      intervalSecs: config.intervalSecs,
      deviceType: config.deviceType,
      linkCapacityBps:
        config.linkCapacityBps !== null
          ? BigInt(config.linkCapacityBps)
          : null,
      clientsProvisionedLimit: config.clientsProvisionedLimit,
      lastPolledAt: config.lastPolledAt
    };
  }
}
