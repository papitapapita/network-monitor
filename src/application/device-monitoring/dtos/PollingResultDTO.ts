import { PollingMetricsDTO } from './PollingMetricsDTO';

/**
 * PollingResultDTO
 *
 * Outcome of a single ping check for a device at a point in time.
 * Used in PollingHistoryDTO and DevicePollingStatusDTO.
 */
export interface PollingResultDTO {
  /**
   * Unique identifier of the ping result record.
   */
  id: string;

  /**
   * ID of the device that was polled.
   */
  deviceId: string;

  /**
   * Timestamp when the ping was executed.
   */
  timestamp: Date;

  /**
   * Outcome of the ping: SUCCESS (device responded) or FAILED (no response).
   */
  status: 'SUCCESS' | 'FAILED';

  /**
   * Latency metrics. Null when the device did not respond.
   */
  metrics: PollingMetricsDTO | null;

  /**
   * Device reachability status derived from this result and consecutive-failure tracking.
   */
  deviceStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}
