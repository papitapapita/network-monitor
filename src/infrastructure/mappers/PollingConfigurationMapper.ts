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

/**
 * Mapper for transforming between the Prisma PollingConfiguration record and
 * the PollingConfiguration domain entity.
 *
 * Responsibilities (ONLY):
 * - Reconstruct domain Value Objects (PollingInterval, FailureThreshold, IDs)
 *   from raw persistence values.
 * - Extract primitive values from the entity for persistence writes.
 *
 * Does NOT:
 * - Validate business rules (entity/value object responsibility).
 * - Build DTOs (application mapper responsibility).
 * - Call repositories or perform side effects.
 */
export class PollingConfigurationMapper {
  /**
   * Converts a raw Prisma record to a PollingConfiguration domain entity.
   * Uses reconstitute() — bypasses validation since the data is trusted persistence.
   *
   * Throws if any persisted value cannot be mapped to a domain object,
   * which would indicate a data integrity violation.
   */
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

  /**
   * Extracts the persistence-ready fields from a PollingConfiguration entity.
   * Used for both INSERT (create) and UPDATE operations.
   */
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
