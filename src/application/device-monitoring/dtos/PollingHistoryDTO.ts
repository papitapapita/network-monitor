import { PollingResultDTO } from './PollingResultDTO';

/**
 * PollingHistoryDTO
 *
 * Historical polling results for a device with aggregate statistics.
 * Returned by GetDevicePollingHistoryUseCase.
 */
export interface PollingHistoryDTO {
  /**
   * Array of polling results within the requested time range.
   */
  results: PollingResultDTO[];

  /**
   * Total count of results matching the query (before pagination).
   */
  totalCount: number;

  /**
   * Aggregate statistics across all results in the time range.
   */
  statistics: {
    /**
     * Success rate percentage (0-100).
     */
    successRate: number;

    /**
     * Average response time in milliseconds.
     */
    averageResponseTime: number;

    /**
     * Minimum response time in milliseconds.
     */
    minResponseTime: number;

    /**
     * Maximum response time in milliseconds.
     */
    maxResponseTime: number;

    /**
     * Average packet loss percentage.
     */
    averagePacketLoss: number;

    /**
     * Uptime percentage (0-100).
     * Based on ratio of successful to total polls.
     */
    uptimePercentage: number;
  };
}
