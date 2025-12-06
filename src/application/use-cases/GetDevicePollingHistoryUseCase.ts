import { UseCase } from '../core/UseCase';
import { Result } from '../../domain/shared/kernel/Result';
import { ILogger } from '../interfaces/ILogger';
import { IPollingResultRepository } from '../../domain/repository';
import { NetworkDeviceId } from '../../domain/entities/NetworkDeviceId';
import { PollingHistoryDTO } from '../dtos';
import { PollingMapper } from '../mappers/PollingMapper';
import { PollingStatus } from '../../domain/value-objects';

/**
 * GetDevicePollingHistoryQuery
 *
 * Query to get historical polling results for a device.
 */
export interface GetDevicePollingHistoryQuery {
  /**
   * ID of the network device.
   */
  networkDeviceId: string;

  /**
   * Start of time range.
   * Optional - defaults to 24 hours ago.
   */
  fromDate?: Date;

  /**
   * End of time range.
   * Optional - defaults to now.
   */
  toDate?: Date;

  /**
   * Filter by polling status.
   * Optional - if provided, only results with these statuses are returned.
   * Example: ['SUCCESS', 'PARTIAL_SUCCESS']
   */
  status?: string[];

  /**
   * Maximum number of results to return.
   * Optional - defaults to 100.
   */
  limit?: number;

  /**
   * Number of results to skip (for pagination).
   * Optional - defaults to 0.
   */
  offset?: number;
}

/**
 * GetDevicePollingHistoryUseCase
 *
 * Query use case to retrieve historical polling results for a device.
 * Returns:
 * - Paginated list of polling results
 * - Aggregate statistics (success rate, average response time, uptime, etc.)
 *
 * Useful for:
 * - Displaying polling history charts
 * - SLA reporting
 * - Performance trending
 * - Incident investigation
 */
export class GetDevicePollingHistoryUseCase extends UseCase<
  GetDevicePollingHistoryQuery,
  PollingHistoryDTO
> {
  private static readonly DEFAULT_LIMIT = 100;
  private static readonly DEFAULT_OFFSET = 0;
  private static readonly MAX_LIMIT = 1000;

  constructor(
    private readonly pollingResultRepository: IPollingResultRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDevicePollingHistoryUseCase');
  }

  /**
   * Validates the query before execution.
   */
  protected async beforeExecute(
    query: GetDevicePollingHistoryQuery
  ): Promise<Result<void> | null> {
    // Validate device ID
    if (!query.networkDeviceId || query.networkDeviceId.trim() === '') {
      return Result.fail<void>('Network device ID is required');
    }

    // Validate limit
    if (query.limit !== undefined) {
      if (query.limit < 1 || query.limit > GetDevicePollingHistoryUseCase.MAX_LIMIT) {
        return Result.fail<void>(
          `Limit must be between 1 and ${GetDevicePollingHistoryUseCase.MAX_LIMIT}`
        );
      }
    }

    // Validate offset
    if (query.offset !== undefined && query.offset < 0) {
      return Result.fail<void>('Offset must be >= 0');
    }

    // Validate date range
    if (query.fromDate && query.toDate && query.fromDate > query.toDate) {
      return Result.fail<void>('fromDate must be before toDate');
    }

    return null;
  }

  /**
   * Main use case execution logic.
   */
  protected async executeImpl(
    query: GetDevicePollingHistoryQuery
  ): Promise<Result<PollingHistoryDTO>> {
    const deviceId = new NetworkDeviceId(query.networkDeviceId);

    // Set default time range if not provided (last 24 hours)
    const toDate = query.toDate || new Date();
    const fromDate =
      query.fromDate || new Date(toDate.getTime() - 24 * 60 * 60 * 1000);

    const limit = query.limit || GetDevicePollingHistoryUseCase.DEFAULT_LIMIT;
    const offset = query.offset || GetDevicePollingHistoryUseCase.DEFAULT_OFFSET;

    // 1. Get polling results within time range
    const resultsOrError = await this.pollingResultRepository.findByDeviceAndTimeRange(
      deviceId,
      fromDate,
      toDate,
      limit + offset // Get extra for offset
    );

    if (resultsOrError.isFailure) {
      return this.fail(
        `Failed to retrieve polling history: ${resultsOrError.error}`
      );
    }

    let results = resultsOrError.getValue();

    // 2. Filter by status if provided
    if (query.status && query.status.length > 0) {
      results = results.filter((result) =>
        query.status!.includes(result.status)
      );
    }

    // 3. Apply pagination
    const totalCount = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    // 4. Calculate aggregate statistics
    const statistics = await this.calculateStatistics(
      deviceId,
      fromDate,
      toDate,
      results
    );

    // 5. Map to DTO
    const historyDTO: PollingHistoryDTO = {
      results: PollingMapper.toPollingResultDTOList(paginatedResults),
      totalCount,
      statistics
    };

    return this.ok(historyDTO);
  }

  /**
   * Calculates aggregate statistics from polling results.
   *
   * @param deviceId - Network device ID
   * @param fromDate - Start of time range
   * @param toDate - End of time range
   * @param results - Polling results to analyze
   * @returns Statistics object
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
    // Use repository aggregation methods for accurate statistics
    const statsOrError = await this.pollingResultRepository.getDeviceStatistics(
      deviceId,
      fromDate,
      toDate
    );

    if (statsOrError.isSuccess) {
      const stats = statsOrError.getValue();
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

    // Fallback: Calculate from results array if repository query fails
    this.logger.warn('Failed to get statistics from repository, calculating from results', {
      error: statsOrError.error
    });

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

    const successfulResults = results.filter((r) => r.isSuccessful());
    const successRate = (successfulResults.length / results.length) * 100;

    const responseTimes = successfulResults
      .map((r) => r.responseTimeMs)
      .filter((t): t is number => t !== null);

    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
        : 0;

    const minResponseTime =
      responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime =
      responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    const packetLosses = successfulResults
      .map((r) => r.metrics?.packetLoss)
      .filter((p): p is number => p !== undefined && p !== null);

    const averagePacketLoss =
      packetLosses.length > 0
        ? packetLosses.reduce((sum, p) => sum + p, 0) / packetLosses.length
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
}
