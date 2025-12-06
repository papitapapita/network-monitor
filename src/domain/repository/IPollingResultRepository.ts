import { PollingResult } from '../entities/PollingResult';
import { PollingResultId } from '../entities/PollingResultId';
import { NetworkDeviceId } from '../entities/NetworkDeviceId';
import { PollingStatus, NetworkDeviceStatus } from '../value-objects';
import { Result } from '../shared/kernel/Result';

/**
 * IPollingResultRepository
 *
 * Repository interface for PollingResult aggregate.
 * Defines the contract for persistence operations on polling results.
 *
 * This interface is designed for TimescaleDB (hypertable) time-series storage,
 * allowing efficient querying of historical polling data.
 *
 * Key capabilities:
 * - Store polling results immutably
 * - Query by time range for analytics
 * - Retrieve recent results for device status
 * - Aggregate metrics for dashboards
 */
export interface IPollingResultRepository {
  /**
   * Finds a polling result by its unique identifier.
   *
   * @param id - The polling result ID
   * @returns Result containing the PollingResult or null if not found
   */
  findById(id: PollingResultId): Promise<Result<PollingResult | null>>;

  /**
   * Finds the most recent polling result for a device.
   *
   * @param networkDeviceId - The network device ID
   * @returns Result containing the latest PollingResult or null if none exist
   */
  findLatestByDevice(
    networkDeviceId: NetworkDeviceId
  ): Promise<Result<PollingResult | null>>;

  /**
   * Finds polling results for a device within a time range.
   *
   * @param networkDeviceId - The network device ID
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @param limit - Optional limit on number of results
   * @returns Result containing array of PollingResults
   */
  findByDeviceAndTimeRange(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date,
    limit?: number
  ): Promise<Result<PollingResult[]>>;

  /**
   * Finds polling results by status within a time range.
   *
   * @param status - The polling status to filter by
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @param limit - Optional limit on number of results
   * @returns Result containing array of PollingResults
   */
  findByStatusAndTimeRange(
    status: PollingStatus,
    startTime: Date,
    endTime: Date,
    limit?: number
  ): Promise<Result<PollingResult[]>>;

  /**
   * Finds recent failed polling results for alerting.
   *
   * @param minutes - Number of minutes to look back
   * @param limit - Optional limit on number of results
   * @returns Result containing array of failed PollingResults
   */
  findRecentFailures(
    minutes: number,
    limit?: number
  ): Promise<Result<PollingResult[]>>;

  /**
   * Saves a polling result (creates only - polling results are immutable).
   *
   * @param pollingResult - The polling result to save
   * @returns Result containing the saved PollingResult
   */
  save(pollingResult: PollingResult): Promise<Result<PollingResult>>;

  /**
   * Deletes polling results older than a specified date.
   * Used for data retention policies.
   *
   * @param olderThan - Delete results older than this date
   * @returns Result containing the number of deleted records
   */
  deleteOlderThan(olderThan: Date): Promise<Result<number>>;

  /**
   * Gets aggregate statistics for a device over a time range.
   *
   * @param networkDeviceId - The network device ID
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Result containing aggregate statistics
   */
  getDeviceStatistics(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date
  ): Promise<
    Result<{
      totalPolls: number;
      successfulPolls: number;
      failedPolls: number;
      averageResponseTime: number | null;
      uptimePercentage: number;
      packetLossPercentage: number;
    }>
  >;

  /**
   * Gets uptime percentage for a device over a time range.
   *
   * @param networkDeviceId - The network device ID
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Result containing uptime percentage (0-100)
   */
  getUptimePercentage(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date
  ): Promise<Result<number>>;

  /**
   * Gets average response time for a device over a time range.
   *
   * @param networkDeviceId - The network device ID
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Result containing average response time in milliseconds
   */
  getAverageResponseTime(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date
  ): Promise<Result<number | null>>;

  /**
   * Counts polling results for a device within a time range.
   *
   * @param networkDeviceId - The network device ID
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Result containing the count
   */
  countByDeviceAndTimeRange(
    networkDeviceId: NetworkDeviceId,
    startTime: Date,
    endTime: Date
  ): Promise<Result<number>>;

  /**
   * Counts polling results by status for a device.
   *
   * @param networkDeviceId - The network device ID
   * @param status - The polling status
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @returns Result containing the count
   */
  countByDeviceStatusAndTimeRange(
    networkDeviceId: NetworkDeviceId,
    status: PollingStatus,
    startTime: Date,
    endTime: Date
  ): Promise<Result<number>>;
}
