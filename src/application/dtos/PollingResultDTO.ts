import { PollingMetricsDTO } from './PollingMetricsDTO';

/**
 * PollingResultDTO
 *
 * Data Transfer Object for a single polling result.
 * Represents the outcome of one polling operation at a specific point in time.
 */
export interface PollingResultDTO {
  /**
   * Unique identifier for this polling result.
   */
  id: string;

  /**
   * ID of the network device that was polled.
   */
  networkDeviceId: string;

  /**
   * Timestamp when the poll was executed.
   */
  timestamp: Date;

  /**
   * Status of the poll: SUCCESS, FAILED, TIMEOUT, or PARTIAL_SUCCESS.
   */
  status: string;

  /**
   * Average response time in milliseconds.
   * Null if the poll failed completely.
   *
   * For backwards compatibility - same value as metrics.averageResponseTime.
   */
  responseTimeMs: number | null;

  /**
   * Detailed metrics from the poll including multi-ping statistics.
   * Null if the poll failed completely.
   */
  metrics: PollingMetricsDTO | null;

  /**
   * Retry attempt number (1-10).
   * 1 = first attempt, 2 = first retry, etc.
   */
  attemptNumber: number;

  /**
   * Error message if the poll failed.
   * Null if poll was successful.
   */
  errorMessage: string | null;

  /**
   * Device status determined by this poll: ONLINE, OFFLINE, or MAINTENANCE.
   */
  deviceStatus: string;
}
