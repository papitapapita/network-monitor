import { Result } from '../../../domain/device-inventory';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import {
  INetworkDeviceRepository,
  IPollingResultRepository
} from '../../../domain/device-monitoring/repository';
import { NetworkDeviceId } from '../../domain/device-inventory/value-objects/NetworkDeviceId';
import {
  GetDevicePollingStatusDTO,
  DevicePollingStatusDTO
} from '../dtos';
import { PollingMapper } from '../mappers/PollingMapper';

/**
 * GetDevicePollingStatusUseCase
 *
 * Business Intent: Query current polling status, configuration, and health for a network device
 *
 * Flow:
 * 1. beforeExecute: Validate device ID format
 * 2. executeImpl: Retrieve device, polling config, and recent results
 * 3. afterExecute: No post-processing (read-only query)
 *
 * Business Rules:
 * - Device must exist to retrieve status
 * - Returns current polling configuration (interval, enabled, ping count)
 * - Includes most recent polling result with multi-ping statistics
 * - Calculates consecutive failures from last 24 hours
 * - Next scheduled time is null if polling is disabled
 * - Read-only operation: No data modification
 * - Graceful degradation: Returns partial data if some queries fail
 *
 * Query Characteristics:
 * - Single Device Query:
 *   * Retrieves status for one specific device
 *   * No pagination needed
 *   * Real-time current state
 *
 * - Includes Multi-Ping Statistics:
 *   * Response times for each ping in last poll
 *   * Average, min, max response times
 *   * Jitter calculation
 *   * Packet loss percentage
 *
 * - Consecutive Failure Tracking:
 *   * Counts uninterrupted failures from most recent poll
 *   * Resets to 0 on first success
 *   * Based on last 24 hours of data
 *   * Useful for alerting and SLA monitoring
 *
 * Use Cases:
 * - Display current polling status on device dashboard
 * - Monitor polling health and detect issues
 * - Validate configuration changes took effect
 * - Troubleshoot polling failures with consecutive failure count
 * - View next scheduled poll time for scheduling analysis
 * - Real-time network operations center (NOC) monitoring
 *
 * Requirements:
 * - Fast query response for real-time dashboards (<100ms)
 * - Graceful handling of missing polling results (new devices)
 * - Accurate consecutive failure counting
 * - Multi-ping statistics for network quality assessment
 *
 * Dependencies:
 * - INetworkDeviceRepository: Load device with polling configuration
 * - IPollingResultRepository: Query latest and recent polling results
 * - PollingMapper: Convert aggregates to DTOs
 * - ILogger: Log query operations and warnings
 *
 * Performance Notes:
 * - Repository should use indexes on (deviceId, timestamp DESC)
 * - Latest result query uses LIMIT 1 for efficiency
 * - Consecutive failure count limited to last 100 results
 * - Consider caching status for high-traffic dashboards
 *
 * @example Query polling status for monitoring dashboard
 * ```typescript
 * const useCase = new GetDevicePollingStatusUseCase(
 *   networkDeviceRepository,
 *   pollingResultRepository,
 *   logger
 * );
 *
 * const result = await useCase.execute({
 *   networkDeviceId: '550e8400-e29b-41d4-a716-446655440000'
 * });
 *
 * if (result.isSuccess) {
 *   const status = result.value;
 *   console.log(`Device: ${status.deviceName}`);
 *   console.log(`Polling: ${status.pollingEnabled ? 'Enabled' : 'Disabled'}`);
 *   console.log(`Interval: ${status.intervalSeconds}s`);
 *   console.log(`Status: ${status.currentStatus}`);
 *   console.log(`Consecutive Failures: ${status.consecutiveFailures}`);
 *
 *   if (status.lastPollStatistics) {
 *     console.log(`Avg Response: ${status.lastPollStatistics.average}ms`);
 *     console.log(`Jitter: ${status.lastPollStatistics.jitter}ms`);
 *     console.log(`Packet Loss: ${status.lastPollStatistics.packetLoss}%`);
 *   }
 * }
 * ```
 *
 * @example Real-time alerting based on status
 * ```typescript
 * const result = await useCase.execute({ networkDeviceId: deviceId });
 *
 * if (result.isSuccess) {
 *   const status = result.value;
 *
 *   // Alert on consecutive failures
 *   if (status.consecutiveFailures >= 3) {
 *     await alertingService.sendAlert({
 *       severity: 'HIGH',
 *       message: `Device ${status.deviceName} has ${status.consecutiveFailures} consecutive polling failures`
 *     });
 *   }
 *
 *   // Alert on high packet loss
 *   if (status.lastPollStatistics?.packetLoss > 20) {
 *     await alertingService.sendAlert({
 *       severity: 'MEDIUM',
 *       message: `High packet loss (${status.lastPollStatistics.packetLoss}%) on ${status.deviceName}`
 *     });
 *   }
 * }
 * ```
 */
export class GetDevicePollingStatusUseCase extends UseCase<
  GetDevicePollingStatusDTO,
  DevicePollingStatusDTO
> {
  private static readonly FAILURE_COUNT_TIME_RANGE_HOURS = 24;
  private static readonly FAILURE_COUNT_MAX_RESULTS = 100;

  constructor(
    private readonly networkDeviceRepository: INetworkDeviceRepository,
    private readonly pollingResultRepository: IPollingResultRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDevicePollingStatusUseCase');
  }

  /**
   * Pre-execution validation.
   * Validates query parameters before retrieving data.
   */
  protected async beforeExecute(
    query: GetDevicePollingStatusDTO
  ): Promise<Result<void> | null> {
    // ========================================
    // 1. Validate device ID
    // ========================================
    if (
      !query.networkDeviceId ||
      query.networkDeviceId.trim() === ''
    ) {
      return Result.fail('Network device ID is required');
    }

    return null; // Validation passed
  }

  /**
   * Main execution: Query current polling status and configuration.
   *
   * Steps:
   * 1. Create device ID value object
   * 2. Load device aggregate with polling configuration
   * 3. Get latest polling result
   * 4. Count consecutive failures (last 24 hours)
   * 5. Build and return status DTO
   */
  protected async executeImpl(
    query: GetDevicePollingStatusDTO
  ): Promise<Result<DevicePollingStatusDTO>> {
    // ========================================
    // 1. Create device ID value object
    // ========================================
    const deviceIdResult = NetworkDeviceId.create(
      query.networkDeviceId
    );
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deviceId = deviceIdResult.value;

    // ========================================
    // 2. Load device aggregate with polling configuration
    // ========================================
    const deviceOrError =
      await this.networkDeviceRepository.findById(deviceId);

    if (deviceOrError.isFailure) {
      return this.fail(
        `Failed to load device: ${deviceOrError.error}`
      );
    }

    const device = deviceOrError.value;
    if (!device) {
      return this.fail(
        `Device with ID ${query.networkDeviceId} not found`
      );
    }

    const pollingConfig = device.pollingConfiguration;

    // ========================================
    // 3. Get latest polling result
    // ========================================
    const latestResultOrError =
      await this.pollingResultRepository.findLatestByDevice(deviceId);

    // Graceful degradation: Log warning but continue if query fails
    if (latestResultOrError.isFailure) {
      this.logger.warn('Failed to get latest polling result', {
        deviceId: deviceId.toString(),
        error: latestResultOrError.error
      });
    }

    const latestResult = latestResultOrError.isSuccess
      ? latestResultOrError.value
      : null;

    // ========================================
    // 4. Count consecutive failures (last 24 hours)
    // ========================================
    const consecutiveFailures =
      await this.countConsecutiveFailures(deviceId);

    // ========================================
    // 5. Build and return status DTO
    // ========================================
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

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Counts consecutive polling failures for a device.
   *
   * Strategy:
   * 1. Query last 24 hours of polling results (max 100 results)
   * 2. Sort by timestamp descending (most recent first)
   * 3. Count failures from most recent until first success
   * 4. Return count (0 if no recent results or first is success)
   *
   * Business Logic:
   * - Consecutive failures reset to 0 on any successful poll
   * - Only counts uninterrupted failures from most recent poll
   * - Used for alerting thresholds and SLA monitoring
   * - Limited to last 24 hours to avoid counting historical issues
   *
   * Performance:
   * - Limits query to 100 most recent results
   * - Repository should use index on (deviceId, timestamp DESC)
   * - Gracefully handles query failures by returning 0
   *
   * @param deviceId - Network device ID
   * @returns Number of consecutive failures (0 if none or query fails)
   */
  private async countConsecutiveFailures(
    deviceId: NetworkDeviceId
  ): Promise<number> {
    // ========================================
    // 1. Define time range (last 24 hours)
    // ========================================
    const now = new Date();
    const startTime = new Date(
      now.getTime() -
        GetDevicePollingStatusUseCase.FAILURE_COUNT_TIME_RANGE_HOURS *
          60 *
          60 *
          1000
    );

    // ========================================
    // 2. Query recent polling results
    // ========================================
    const recentResultsOrError =
      await this.pollingResultRepository.findByDeviceAndTimeRange(
        deviceId,
        startTime,
        now,
        GetDevicePollingStatusUseCase.FAILURE_COUNT_MAX_RESULTS
      );

    // Graceful degradation: Return 0 if query fails
    if (recentResultsOrError.isFailure) {
      this.logger.warn(
        'Failed to get recent polling results for failure count',
        {
          deviceId: deviceId.toString(),
          error: recentResultsOrError.error
        }
      );
      return 0;
    }

    const results = recentResultsOrError.value;
    if (results.length === 0) {
      return 0; // No recent results
    }

    // ========================================
    // 3. Sort by timestamp descending (most recent first)
    // ========================================
    const sortedResults = results.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // ========================================
    // 4. Count consecutive failures from most recent
    // ========================================
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

  /**
   * Sanitize data for logging.
   * No sensitive data in polling status queries.
   */
  protected sanitizeForLogging(data: any): any {
    // No sensitive data in polling status operations
    return data;
  }
}
