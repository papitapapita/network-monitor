import { DeviceId, PollingConfigurationId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { PollingConfiguration } from 'domain/device-monitoring/entities';
import {
  PollingInterval,
  FailureThreshold
} from 'domain/device-monitoring/value-objects';

type PrismaPollingConfigurationRecord = {
  id: string;
  deviceId: string;
  ipAddress: string | null;
  enabled: boolean;
  pingIntervalSecs: number;
  failuresBeforeDown: number;
  lastPolledAt: Date | null;
};

export class PollingConfigurationMapper {
  public static toDomain(
    raw: PrismaPollingConfigurationRecord
  ): PollingConfiguration {
    const deviceIdResult = DeviceId.parse(raw.deviceId);
    if (deviceIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid deviceId "${raw.deviceId}" in polling_configurations`
      );
    }

    const configIdResult = PollingConfigurationId.parse(raw.id);
    if (configIdResult.isFailure) {
      throw new Error(
        `Data integrity violation: invalid id "${raw.id}" in polling_configurations`
      );
    }

    return PollingConfiguration.reconstitute(configIdResult.value, {
      deviceId: deviceIdResult.value,
      ipAddress:
        raw.ipAddress !== null
          ? IPAddress.reconstitute(raw.ipAddress)
          : null,
      interval: PollingInterval.reconstitute({
        seconds: raw.pingIntervalSecs
      }),
      failuresBeforeDown: FailureThreshold.reconstitute({
        count: raw.failuresBeforeDown
      }),
      enabled: raw.enabled,
      lastPolledAt: raw.lastPolledAt
    });
  }

  public static toPersistence(entity: PollingConfiguration): {
    id: string;
    deviceId: string;
    ipAddress: string | null;
    enabled: boolean;
    pingIntervalSecs: number;
    failuresBeforeDown: number;
    lastPolledAt: Date | null;
  } {
    return {
      id: entity.id.toString(),
      deviceId: entity.deviceId.toString(),
      ipAddress: entity.ipAddress?.toString() ?? null,
      enabled: entity.enabled,
      pingIntervalSecs: entity.interval.seconds,
      failuresBeforeDown: entity.failuresBeforeDown.value,
      lastPolledAt: entity.lastPolledAt
    };
  }
}
