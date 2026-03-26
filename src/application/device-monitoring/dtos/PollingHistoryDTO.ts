import { PollingResultDTO } from './PollingResultDTO';

/**
 * PollingHistoryDTO
 *
 * Paginated polling history for a device with aggregate statistics.
 * Returned by GetDevicePollingHistoryUseCase.
 */
export interface PollingHistoryDTO {
  deviceId: string;
  /**
   * Page of polling results matching the query filters.
   */
  results: PollingResultDTO[];

  /**
   * Total number of results matching the filters (before pagination).
   */
  totalCount: number;

  /**
   * Aggregate statistics computed across all matching results (not just the page).
   */
  statistics: {
    /**
     * Percentage of polls where the device responded (0–100).
     */
    successRate: number;

    /**
     * Mean latency across all successful pings, in milliseconds. 0 if none succeeded.
     */
    averageResponseTime: number;

    /**
     * Fastest successful ping, in milliseconds. 0 if none succeeded.
     */
    minResponseTime: number;

    /**
     * Slowest successful ping, in milliseconds. 0 if none succeeded.
     */
    maxResponseTime: number;

    /**
     * Uptime percentage — identical to successRate for V1 single-ping polling.
     */
    uptimePercentage: number;
  };
}
