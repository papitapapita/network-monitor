import { PollingResultDTO } from './PollingResultDTO';

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
