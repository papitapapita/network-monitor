import {
  Result,
  PollingConfiguration,
  PollingConfigurationId,
  NetworkDeviceId,
  PollingInterval,
  RetryPolicy
} from '../../../domain/device-inventory';

/**
 * Mapper for converting PollingConfiguration entity to/from Prisma model.
 *
 * Handles bidirectional conversion between:
 * - Domain entity (PollingConfiguration)
 * - Persistence model (Prisma PollingConfiguration)
 */
export class PollingConfigurationMapper {
  /**
   * Converts a Prisma PollingConfiguration model to domain entity.
   *
   * @param raw - Raw Prisma model data
   * @returns Result containing PollingConfiguration entity or error message
   */
  public static toDomain(raw: any): Result<PollingConfiguration> {
    // Convert IDs
    const pollingConfigId = PollingConfigurationId.create(raw.id);
    if (pollingConfigId.isFailure) {
      return Result.fail<PollingConfiguration>(
        pollingConfigId.error!
      );
    }

    const networkDeviceId = NetworkDeviceId.create(
      raw.networkDeviceId
    );
    if (networkDeviceId.isFailure) {
      return Result.fail<PollingConfiguration>(
        networkDeviceId.error!
      );
    }

    // Convert value objects
    const interval = PollingInterval.create(raw.intervalSeconds);
    if (interval.isFailure) {
      return Result.fail<PollingConfiguration>(interval.error!);
    }

    const retryPolicy = RetryPolicy.create(
      raw.maxRetryAttempts,
      raw.retryDelayMs
    );
    if (retryPolicy.isFailure) {
      return Result.fail<PollingConfiguration>(retryPolicy.error!);
    }

    // Create domain entity
    return PollingConfiguration.create(
      {
        networkDeviceId: networkDeviceId.value,
        interval: interval.value,
        enabled: raw.enabled,
        retryPolicy: retryPolicy.value,
        pingCount: raw.pingCount,
        lastScheduledAt: raw.lastScheduledAt,
        nextScheduledAt: raw.nextScheduledAt
      },
      pollingConfigId.value
    );
  }

  /**
   * Converts a PollingConfiguration domain entity to Prisma model format.
   *
   * @param config - Domain entity
   * @returns Object ready for Prisma create/update operations
   */
  public static toPersistence(config: PollingConfiguration): any {
    return {
      id: config.id.toString(),
      networkDeviceId: config.networkDeviceId.toString(),
      intervalSeconds: config.interval.seconds,
      enabled: config.enabled,
      pingCount: config.pingCount,
      maxRetryAttempts: config.retryPolicy.maxAttempts,
      retryDelayMs: config.retryPolicy.delayMs,
      lastScheduledAt: config.lastScheduledAt,
      nextScheduledAt: config.nextScheduledAt
    };
  }
}
