import { Result } from '../../../domain/device-inventory';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { IPollingResultRepository } from '../../../domain/device-monitoring/repository';
import { NetworkDeviceId } from '../../domain/device-inventory/value-objects/NetworkDeviceId';
import {
  GetDevicePollingHistoryDTO,
  PollingHistoryDTO
} from '../dtos';
import { PollingMapper } from '../mappers/PollingMapper';

/**
 * GetDevicePollingHistoryUseCase
 *
 * Business Intent: Query historical polling results for a network device with aggregate statistics
 *
 * Flow:
 * 1. beforeExecute: Validate query parameters (device ID, date range, pagination)
 * 2. executeImpl: Retrieve and aggregate polling history
 * 3. afterExecute: No post-processing (read-only query)
 *
 * Business Rules:
 * - Device must exist (implicitly through data presence)
 * - Default time range: Last 24 hours if not specified
 * - Maximum limit: 1000 results per query
 * - Pagination: offset + limit pattern
 * - Statistics calculated across ALL results in time range (not just paginated subset)
 * - Status filtering: Optional, filters results by polling status
 * - Date range validation: fromDate must be before toDate
 * - Read-only operation: No data modification
 *
 * Query Patterns:
 * - Time Range Query (default):
 *   * fromDate defaults to 24 hours ago
 *   * toDate defaults to now
 *   * Returns all results within range
 *
 * - Status Filtered Query:
 *   * Filter by SUCCESS, FAILED, TIMEOUT, etc.
 *   * Useful for incident investigation
 *   * Combines with time range
 *
 * - Paginated Query:
 *   * Default: limit=100, offset=0
 *   * Maximum: limit=1000
 *   * Statistics cover all results, not just current page
 *
 * Use Cases:
 * - Display polling history charts on device dashboard
 * - SLA reporting and uptime calculations
 * - Performance trending analysis
 * - Incident investigation and troubleshooting
 * - Capacity planning based on historical response times
 *
 * Requirements:
 * - Support large datasets with pagination
 * - Calculate aggregate statistics efficiently
 * - Flexible time range and status filtering
 * - Fast query response for real-time dashboards
 *
 * Dependencies:
 * - IPollingResultRepository: Query historical polling results
 * - PollingMapper: Convert aggregates to DTOs
 * - ILogger: Log query operations
 *
 * Performance Notes:
 * - Repository should use database indexes on (networkDeviceId, timestamp)
 * - Consider caching statistics for frequently queried ranges
 * - Large time ranges may require background jobs for statistics
 *
 * @example Query last 24 hours (default)
 * ```typescript
 * const useCase = new GetDevicePollingHistoryUseCase(
 *   pollingResultRepository,
 *   logger
 * );
 *
 * const result = await useCase.execute({
 *   networkDeviceId: '550e8400-e29b-41d4-a716-446655440000'
 * });
 *
 * if (result.isSuccess) {
 *   const history = result.value;
 *   console.log(`Total results: ${history.totalCount}`);
 *   console.log(`Success rate: ${history.statistics.successRate}%`);
 *   console.log(`Avg response: ${history.statistics.averageResponseTime}ms`);
 * }
 * ```
 *
 * @example Query specific time range with pagination
 * ```typescript
 * const result = await useCase.execute({
 *   networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
 *   fromDate: new Date('2026-01-01T00:00:00Z'),
 *   toDate: new Date('2026-01-09T23:59:59Z'),
 *   limit: 50,
 *   offset: 100
 * });
 * ```
 *
 * @example Query only failed polls for troubleshooting
 * ```typescript
 * const result = await useCase.execute({
 *   networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
 *   status: ['FAILED', 'TIMEOUT'],
 *   limit: 20
 * });
 * ```
 */
export class GetDevicePollingHistoryUseCase extends UseCase<
  GetDevicePollingHistoryDTO,
  PollingHistoryDTO
> {
  private static readonly DEFAULT_LIMIT = 100;
  private static readonly DEFAULT_OFFSET = 0;
  private static readonly MAX_LIMIT = 1000;
  private static readonly DEFAULT_TIME_RANGE_HOURS = 24;

  constructor(
    private readonly pollingResultRepository: IPollingResultRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDevicePollingHistoryUseCase');
  }

  /**
   * Pre-execution validation.
   * Validates query parameters before retrieving data.
   */
  protected async beforeExecute(
    query: GetDevicePollingHistoryDTO
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

    // ========================================
    // 2. Validate limit range
    // ========================================
    if (query.limit !== undefined) {
      if (
        query.limit < 1 ||
        query.limit > GetDevicePollingHistoryUseCase.MAX_LIMIT
      ) {
        return Result.fail(
          `Limit must be between 1 and ${GetDevicePollingHistoryUseCase.MAX_LIMIT}`
        );
      }
    }

    // ========================================
    // 3. Validate offset
    // ========================================
    if (query.offset !== undefined && query.offset < 0) {
      return Result.fail('Offset must be >= 0');
    }

    // ========================================
    // 4. Validate date range
    // ========================================
    if (
      query.fromDate &&
      query.toDate &&
      query.fromDate > query.toDate
    ) {
      return Result.fail('fromDate must be before toDate');
    }

    return null; // Validation passed
  }

  /**
   * Main execution: Query historical polling results with statistics.
   *
   * Steps:
   * 1. Create device ID value object
   * 2. Set default time range (last 24 hours if not specified)
   * 3. Set default pagination parameters
   * 4. Retrieve polling results from repository
   * 5. Filter by status if specified
   * 6. Apply pagination (offset + limit)
   * 7. Calculate aggregate statistics
   * 8. Build and return history DTO
   */
  protected async executeImpl(
    query: GetDevicePollingHistoryDTO
  ): Promise<Result<PollingHistoryDTO>> {
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
    // 2. Set default time range (last 24 hours if not specified)
    // ========================================
    const toDate = query.toDate || new Date();
    const fromDate =
      query.fromDate ||
      new Date(
        toDate.getTime() -
          GetDevicePollingHistoryUseCase.DEFAULT_TIME_RANGE_HOURS *
            60 *
            60 *
            1000
      );

    // ========================================
    // 3. Set default pagination parameters
    // ========================================
    const limit =
      query.limit || GetDevicePollingHistoryUseCase.DEFAULT_LIMIT;
    const offset =
      query.offset || GetDevicePollingHistoryUseCase.DEFAULT_OFFSET;

    // ========================================
    // 4. Retrieve polling results from repository
    // ========================================
    const resultsOrError =
      await this.pollingResultRepository.findByDeviceAndTimeRange(
        deviceId,
        fromDate,
        toDate,
        limit + offset // Fetch extra for offset
      );

    if (resultsOrError.isFailure) {
      return this.fail(
        `Failed to retrieve polling history: ${resultsOrError.error}`
      );
    }

    let results = resultsOrError.value;

    // ========================================
    // 5. Filter by status if specified
    // ========================================
    if (query.status && query.status.length > 0) {
      results = results.filter((result) =>
        query.status!.includes(result.status)
      );
    }

    // ========================================
    // 6. Apply pagination (offset + limit)
    // ========================================
    const totalCount = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    // ========================================
    // 7. Calculate aggregate statistics
    // ========================================
    const statistics = await this.calculateStatistics(
      deviceId,
      fromDate,
      toDate,
      results
    );

    // ========================================
    // 8. Build and return history DTO
    // ========================================
    const historyDTO: PollingHistoryDTO = {
      results: PollingMapper.toPollingResultDTOList(paginatedResults),
      totalCount,
      statistics
    };

    return this.ok(historyDTO);
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Calculates aggregate statistics from polling results.
   *
   * Strategy:
   * 1. Try to get statistics from repository (efficient database aggregation)
   * 2. If repository query fails, calculate from results array (fallback)
   *
   * Statistics:
   * - Success rate: Percentage of successful polls
   * - Average response time: Mean response time of successful polls
   * - Min/Max response time: Range of response times
   * - Average packet loss: Mean packet loss across all polls
   * - Uptime percentage: Ratio of successful to total polls
   *
   * @param deviceId - Network device ID
   * @param fromDate - Start of time range
   * @param toDate - End of time range
   * @param results - Polling results to analyze (fallback data source)
   * @returns Statistics object with performance metrics
   */
  private async calculateStatistics(
    deviceId: NetworkDeviceId,
    fromDate: Date,
    toDate: Date,
    results: any[]
  ): Promise<{
    successRate: number;
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    averagePacketLoss: number;
    uptimePercentage: number;
  }> {
    // ========================================
    // Strategy 1: Repository aggregation (efficient)
    // ========================================
    const statsOrError =
      await this.pollingResultRepository.getDeviceStatistics(
        deviceId,
        fromDate,
        toDate
      );

    if (statsOrError.isSuccess) {
      const stats = statsOrError.value;
      return {
        successRate:
          stats.totalPolls > 0
            ? (stats.successfulPolls / stats.totalPolls) * 100
            : 0,
        averageResponseTime: stats.averageResponseTime || 0,
        minResponseTime: 0, // TODO: Add to repository query
        maxResponseTime: 0, // TODO: Add to repository query
        averagePacketLoss: stats.packetLossPercentage,
        uptimePercentage: stats.uptimePercentage
      };
    }

    // ========================================
    // Strategy 2: Calculate from results array (fallback)
    // ========================================
    this.logger.warn(
      'Failed to get statistics from repository, calculating from results',
      {
        error: statsOrError.error
      }
    );

    // Handle empty results
    if (results.length === 0) {
      return {
        successRate: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        averagePacketLoss: 0,
        uptimePercentage: 0
      };
    }

    // Calculate success rate
    const successfulResults = results.filter((r) => r.isSuccessful());
    const successRate =
      (successfulResults.length / results.length) * 100;

    // Calculate response time statistics
    const responseTimes = successfulResults
      .map((r) => r.responseTimeMs)
      .filter((t): t is number => t !== null);

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) /
          responseTimes.length
        : 0;

    const minResponseTime =
      responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime =
      responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    // Calculate packet loss statistics
    const packetLosses = successfulResults
      .map((r) => r.metrics?.packetLoss)
      .filter((p): p is number => p !== undefined && p !== null);

    const averagePacketLoss =
      packetLosses.length > 0
        ? packetLosses.reduce((sum, p) => sum + p, 0) /
          packetLosses.length
        : 0;

    return {
      successRate,
      averageResponseTime,
      minResponseTime,
      maxResponseTime,
      averagePacketLoss,
      uptimePercentage: successRate // Simple approximation
    };
  }

  /**
   * Sanitize data for logging.
   * No sensitive data in polling history queries.
   */
  protected sanitizeForLogging(data: any): any {
    // No sensitive data in polling history operations
    return data;
  }
}
