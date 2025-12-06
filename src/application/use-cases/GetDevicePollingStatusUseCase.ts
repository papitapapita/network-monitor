import { UseCase } from '../core/UseCase';
import { Result } from '../../domain/shared/kernel/Result';
import { ILogger } from '../interfaces/ILogger';
import {
  INetworkDeviceRepository,
  IPollingResultRepository
} from '../../domain/repository';
import { NetworkDeviceId } from '../../domain/entities/NetworkDeviceId';
import { DevicePollingStatusDTO } from '../dtos';
import { PollingMapper } from '../mappers/PollingMapper';
import { PollingStatus } from '../../domain/value-objects';

/**
 * GetDevicePollingStatusQuery
 *
 * Query to get the current polling status for a device.
 */
export interface GetDevicePollingStatusQuery {
  /**
   * ID of the network device.
   */
  networkDeviceId: string;
}

/**
 * GetDevicePollingStatusUseCase
 *
 * Query use case to retrieve current polling status and configuration for a device.
 * Returns:
 * - Current polling configuration (interval, enabled, ping count)
 * - Last poll result with multi-ping statistics
 * - Consecutive failure count
 * - Next scheduled poll time
 */
export class GetDevicePollingStatusUseCase extends UseCase<
  GetDevicePollingStatusQuery,
  DevicePollingStatusDTO
> {
  constructor(
    private readonly networkDeviceRepository: INetworkDeviceRepository,
    private readonly pollingResultRepository: IPollingResultRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDevicePollingStatusUseCase');
  }

  /**
   * Main use case execution logic.
   */
  protected async executeImpl(
    query: GetDevicePollingStatusQuery
  ): Promise<Result<DevicePollingStatusDTO>> {
    // 1. Load NetworkDevice aggregate
    const deviceId = new NetworkDeviceId(query.networkDeviceId);
    const deviceOrError = await this.networkDeviceRepository.findById(deviceId);

    if (deviceOrError.isFailure) {
      return this.fail(`Failed to load device: ${deviceOrError.error}`);
    }

    const device = deviceOrError.getValue();
    if (!device) {
      return this.fail(
        `Device with ID ${query.networkDeviceId} not found`
      );
    }

    // 2. Get polling configuration
    const pollingConfig = device.pollingConfiguration;

    // 3. Get latest polling result
    const latestResultOrError = await this.pollingResultRepository.findLatestByDevice(
      deviceId
    );

    if (latestResultOrError.isFailure) {
      this.logger.warn('Failed to get latest polling result', {
        error: latestResultOrError.error
      });
    }

    const latestResult = latestResultOrError.isSuccess
      ? latestResultOrError.getValue()
      : null;

    // 4. Count consecutive failures
    const consecutiveFailures = await this.countConsecutiveFailures(deviceId);

    // 5. Map to DTO
    const statusDTO: DevicePollingStatusDTO = {
      deviceId: device.networkDeviceId.toString(),
      deviceName: device.name,
      pollingEnabled: pollingConfig.enabled,
      intervalSeconds: pollingConfig.interval.seconds,
      pingCount: pollingConfig.pingCount,
      lastPolled: pollingConfig.lastScheduledAt,
      nextScheduled: pollingConfig.nextScheduledAt,
      currentStatus: device.status,
      lastResult: latestResult
        ? PollingMapper.toPollingResultDTO(latestResult)
        : null,
      consecutiveFailures,
      lastPollStatistics: latestResult?.metrics
        ? PollingMapper.toLastPollStatistics(latestResult.metrics)
        : null
    };

    return this.ok(statusDTO);
  }

  /**
   * Counts consecutive polling failures for a device.
   *
   * @param deviceId - Network device ID
   * @returns Number of consecutive failures
   */
  private async countConsecutiveFailures(
    deviceId: NetworkDeviceId
  ): Promise<number> {
    // Query recent polling results and count consecutive failures from most recent
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentResultsOrError = await this.pollingResultRepository.findByDeviceAndTimeRange(
      deviceId,
      last24Hours,
      now,
      100 // Last 100 results
    );

    if (recentResultsOrError.isFailure) {
      this.logger.warn('Failed to get recent polling results for failure count', {
        deviceId: deviceId.toString(),
        error: recentResultsOrError.error
      });
      return 0;
    }

    const results = recentResultsOrError.getValue();
    if (results.length === 0) {
      return 0;
    }

    // Sort by timestamp descending (most recent first)
    const sortedResults = results.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Count consecutive failures from most recent
    let count = 0;
    for (const result of sortedResults) {
      if (result.hasFailed()) {
        count++;
      } else {
        break; // Stop at first success
      }
    }

    return count;
  }
}
