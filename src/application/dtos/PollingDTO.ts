import { PollingResultDTO } from './PollingResultDTO';

/**
 * PollingCycleSummaryDTO
 *
 * Summary statistics from executing a polling cycle.
 * Returned by ExecutePollingCycleUseCase.
 */
export interface PollingCycleSummaryDTO {
  /**
   * Total number of devices in the polling batch.
   */
  totalDevices: number;

  /**
   * Number of successful polls.
   */
  successful: number;

  /**
   * Number of failed polls (after all retries).
   */
  failed: number;

  /**
   * Number of skipped polls.
   */
  skipped: number;

  /**
   * Average response time across all successful polls in milliseconds.
   */
  averageResponseTime: number;

  /**
   * Minimum response time from all successful polls in milliseconds.
   */
  minResponseTime: number;

  /**
   * Maximum response time from all successful polls in milliseconds.
   */
  maxResponseTime: number;

  /**
   * Average packet loss percentage across all polls.
   */
  averagePacketLoss: number;

  /**
   * Total execution duration of the polling cycle in milliseconds.
   */
  executionDurationMs: number;
}

/**
 * DevicePollingStatusDTO
 *
 * Current polling status and configuration for a device.
 * Returned by GetDevicePollingStatusUseCase.
 */
export interface DevicePollingStatusDTO {
  /**
   * Network device ID.
   */
  deviceId: string;

  /**
   * Device name.
   */
  deviceName: string;

  /**
   * Whether polling is enabled for this device.
   */
  pollingEnabled: boolean;

  /**
   * Polling interval in seconds.
   */
  intervalSeconds: number;

  /**
   * Number of pings per poll (1-10).
   */
  pingCount: number;

  /**
   * Timestamp of last poll execution.
   * Null if never polled.
   */
  lastPolled: Date | null;

  /**
   * Timestamp when next poll is scheduled.
   * Null if polling is disabled.
   */
  nextScheduled: Date | null;

  /**
   * Current device status: ONLINE, OFFLINE, or MAINTENANCE.
   */
  currentStatus: string;

  /**
   * Most recent polling result.
   * Null if never polled.
   */
  lastResult: PollingResultDTO | null;

  /**
   * Number of consecutive poll failures.
   * Reset to 0 on successful poll.
   */
  consecutiveFailures: number;

  /**
   * Multi-ping statistics from the last poll.
   * Null if never polled or last poll failed.
   */
  lastPollStatistics: {
    responseTimes: number[];
    average: number;
    min: number;
    max: number;
    jitter: number;
    packetLoss: number;
  } | null;
}

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
