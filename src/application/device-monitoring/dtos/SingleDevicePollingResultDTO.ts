import { PollingMetricsDTO } from './PollingMetricsDTO';

/**
 * SingleDevicePollingResultDTO
 *
 * Immediate result of executing one polling cycle for a single device.
 * Returned by ExecutePollingCycleUseCase.
 */
export interface SingleDevicePollingResultDTO {
  /**
   * ID of the device that was polled.
   */
  deviceId: string;

  /**
   * Outcome of the cycle:
   * - SUCCESS: device responded to the ping
   * - FAILED: device did not respond
   * - SKIPPED: polling is disabled for this device and forceExecution was false
   */
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';

  /**
   * Human-readable description of the result.
   */
  message: string;

  /**
   * Timestamp when the poll was executed.
   */
  timestamp: Date;

  /**
   * Latency metrics. Null when the device did not respond or the cycle was skipped.
   */
  metrics: PollingMetricsDTO | null;

  /**
   * Device reachability status after this cycle.
   */
  deviceStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}
