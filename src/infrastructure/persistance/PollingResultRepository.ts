import { PrismaClient } from '@/generated/prisma';
import { Result } from '@/core/Result';
import { IPollingResultRepository } from '@/domain/repository/IPollingResultRepository';
import {
  PollingResult,
  PollingResultId,
  NetworkDeviceId,
} from '@/domain/entities';
import { PollingResultMapper } from '@/infrastructure/mappers/PollingResultMapper';

/**
 * Prisma implementation of IPollingResultRepository.
 *
 * Stores polling results in TimescaleDB hypertable for time-series data.
 * Optimized for:
 * - High-frequency writes (continuous polling)
 * - Time-range queries (historical data, dashboards)
 * - Aggregations (statistics, uptime calculations)
 *
 * TimescaleDB features used:
 * - Hypertable partitioning by timestamp
 * - Automatic compression for old data
 * - Continuous aggregates for performance
 *
 * @example
 * ```typescript
 * const repository = new PollingResultRepository(prisma);
 *
 * // Save poll result
 * await repository.save(pollingResult);
 *
 * // Get latest result
 * const latest = await repository.findLatestByDevice(deviceId);
 *
 * // Get time-series data
 * const history = await repository.findByDeviceAndTimeRange(
 *   deviceId,
 *   startTime,
 *   endTime,
 *   100
 * );
 *
 * // Calculate uptime
 * const uptime = await repository.getUptimePercentage(
 *   deviceId,
 *   startTime,
 *   endTime
 * );
 * ```
 */
export class PollingResultRepository implements IPollingResultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Finds a polling result by its ID.
   */
  public async findById(
    id: PollingResultId
  ): Promise<Result<PollingResult | null>> {
    try {
      const rawResult = await this.prisma.pollingResult.findUnique({
        where: { id: id.toString() },
      });

      if (!rawResult) {
        return Result.ok<PollingResult | null>(null);
      }

      const domainResult = PollingResultMapper.toDomain(rawResult);
      if (domainResult.isFailure) {
        return Result.fail<PollingResult | null>(
          `Failed to map polling result: ${domainResult.getErrorValue()}`
        );
      }

      return Result.ok<PollingResult | null>(domainResult.getValue());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail<PollingResult | null>(
        `Database error finding polling result: ${errorMessage}`
      );
    }
  }

  /**
   * Finds the most recent polling result for a device.
   */
  public async findLatestByDevice(
    networkDeviceId: NetworkDeviceId
  ): Promise<Result<PollingResult | null>> {
    try {
      const rawResult = await this.prisma.pollingResult.findFirst({
        where: { networkDeviceId: networkDeviceId.toString() },
        orderBy: { timestamp: 'desc' },
      });

      if (!rawResult) {
        return Result.ok<PollingResult | null>(null);
      }

      const domainResult = PollingResultMapper.toDomain(rawResult);
      if (domainResult.isFailure) {
        return Result.fail<PollingResult | null>(
          `Failed to map polling result: ${domainResult.getErrorValue()}`
        );
      }

      return Result.ok<PollingResult | null>(domainResult.getValue());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail<PollingResult | null>(
        `Database error finding latest polling result: ${errorMessage}`
      );
    }
  }

  /**
   * Finds polling results for a device within a time range.
   */
  public async findByDeviceAndTimeRange(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date,
    limit?: number
  ): Promise<Result<PollingResult[]>> {
    try {
      const rawResults = await this.prisma.pollingResult.findMany({
        where: {
          networkDeviceId: networkDeviceId.toString(),
          timestamp: {
            gte: startTime,
            lte: endTime,
          },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      const domainResults: PollingResult[] = [];
      for (const rawResult of rawResults) {
        const domainResult = PollingResultMapper.toDomain(rawResult);
        if (domainResult.isFailure) {
          // Log error but continue with other results
          console.error(
            `Failed to map polling result ${rawResult.id}: ${domainResult.getErrorValue()}`
          );
          continue;
        }
        domainResults.push(domainResult.getValue());
      }

      return Result.ok<PollingResult[]>(domainResults);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail<PollingResult[]>(
        `Database error finding polling results: ${errorMessage}`
      );
    }
  }

  /**
   * Saves a polling result.
   */
  public async save(pollingResult: PollingResult): Promise<Result<PollingResult>> {
    try {
      const persistenceData = PollingResultMapper.toPersistence(pollingResult);

      const rawResult = await this.prisma.pollingResult.upsert({
        where: { id: persistenceData.id },
        create: persistenceData,
        update: persistenceData,
      });

      const domainResult = PollingResultMapper.toDomain(rawResult);
      if (domainResult.isFailure) {
        return Result.fail<PollingResult>(
          `Failed to map saved polling result: ${domainResult.getErrorValue()}`
        );
      }

      return Result.ok<PollingResult>(domainResult.getValue());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail<PollingResult>(
        `Database error saving polling result: ${errorMessage}`
      );
    }
  }

  /**
   * Gets statistical aggregates for a device over a time range.
   */
  public async getDeviceStatistics(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date
  ): Promise<
    Result<{
      totalPolls: number;
      successfulPolls: number;
      failedPolls: number;
      averageResponseTime: number;
      minResponseTime: number;
      maxResponseTime: number;
      averageJitter: number;
      averagePacketLoss: number;
    }>
  > {
    try {
      const results = await this.prisma.pollingResult.findMany({
        where: {
          networkDeviceId: networkDeviceId.toString(),
          timestamp: {
            gte: startTime,
            lte: endTime,
          },
        },
      });

      const totalPolls = results.length;
      const successfulPolls = results.filter((r) => r.status === 'SUCCESS').length;
      const failedPolls = totalPolls - successfulPolls;

      const successfulResults = results.filter(
        (r) => r.status === 'SUCCESS' && r.averageResponseTime !== null
      );

      const averageResponseTime =
        successfulResults.length > 0
          ? successfulResults.reduce((sum, r) => sum + (r.averageResponseTime || 0), 0) /
            successfulResults.length
          : 0;

      const responseTimes = successfulResults
        .map((r) => r.averageResponseTime)
        .filter((t): t is number => t !== null);

      const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
      const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

      const jitterValues = successfulResults
        .map((r) => r.jitter)
        .filter((j): j is number => j !== null);

      const averageJitter =
        jitterValues.length > 0
          ? jitterValues.reduce((sum, j) => sum + j, 0) / jitterValues.length
          : 0;

      const packetLossValues = successfulResults
        .map((r) => r.packetLoss)
        .filter((p): p is number => p !== null);

      const averagePacketLoss =
        packetLossValues.length > 0
          ? packetLossValues.reduce((sum, p) => sum + p, 0) / packetLossValues.length
          : 0;

      return Result.ok({
        totalPolls,
        successfulPolls,
        failedPolls,
        averageResponseTime: Number(averageResponseTime.toFixed(2)),
        minResponseTime: Number(minResponseTime.toFixed(2)),
        maxResponseTime: Number(maxResponseTime.toFixed(2)),
        averageJitter: Number(averageJitter.toFixed(2)),
        averagePacketLoss: Number(averagePacketLoss.toFixed(2)),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail(
        `Database error calculating device statistics: ${errorMessage}`
      );
    }
  }

  /**
   * Calculates uptime percentage for a device over a time range.
   */
  public async getUptimePercentage(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date
  ): Promise<Result<number>> {
    try {
      const results = await this.prisma.pollingResult.findMany({
        where: {
          networkDeviceId: networkDeviceId.toString(),
          timestamp: {
            gte: startTime,
            lte: endTime,
          },
        },
      });

      if (results.length === 0) {
        return Result.ok<number>(0);
      }

      const successfulPolls = results.filter((r) => r.status === 'SUCCESS').length;
      const uptimePercentage = (successfulPolls / results.length) * 100;

      return Result.ok<number>(Number(uptimePercentage.toFixed(2)));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error calculating uptime: ${errorMessage}`
      );
    }
  }

  /**
   * Gets the count of consecutive failures for a device.
   */
  public async getConsecutiveFailureCount(
    networkDeviceId: NetworkDeviceId
  ): Promise<Result<number>> {
    try {
      const recentResults = await this.prisma.pollingResult.findMany({
        where: { networkDeviceId: networkDeviceId.toString() },
        orderBy: { timestamp: 'desc' },
        take: 100, // Look at last 100 results
      });

      let consecutiveFailures = 0;
      for (const result of recentResults) {
        if (result.status === 'FAILED') {
          consecutiveFailures++;
        } else {
          break; // Stop at first success
        }
      }

      return Result.ok<number>(consecutiveFailures);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error counting consecutive failures: ${errorMessage}`
      );
    }
  }

  /**
   * Deletes polling results older than the specified date.
   *
   * Used for data retention policies.
   */
  public async deleteOlderThan(cutoffDate: Date): Promise<Result<number>> {
    try {
      const deleteResult = await this.prisma.pollingResult.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      return Result.ok<number>(deleteResult.count);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail<number>(
        `Database error deleting old polling results: ${errorMessage}`
      );
    }
  }

  /**
   * Gets polling results grouped by status for a time range.
   *
   * Useful for dashboards and summary views.
   */
  public async getResultsByStatus(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date
  ): Promise<
    Result<{
      success: number;
      partialSuccess: number;
      failed: number;
    }>
  > {
    try {
      const results = await this.prisma.pollingResult.groupBy({
        by: ['status'],
        where: {
          networkDeviceId: networkDeviceId.toString(),
          timestamp: {
            gte: startTime,
            lte: endTime,
          },
        },
        _count: true,
      });

      const statusCounts = {
        success: 0,
        partialSuccess: 0,
        failed: 0,
      };

      for (const result of results) {
        switch (result.status) {
          case 'SUCCESS':
            statusCounts.success = result._count;
            break;
          case 'PARTIAL_SUCCESS':
            statusCounts.partialSuccess = result._count;
            break;
          case 'FAILED':
            statusCounts.failed = result._count;
            break;
        }
      }

      return Result.ok(statusCounts);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail(
        `Database error grouping results by status: ${errorMessage}`
      );
    }
  }
}
