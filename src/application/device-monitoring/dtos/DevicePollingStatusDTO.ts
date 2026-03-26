import { PollingResultDTO } from './PollingResultDTO';

/**
 * DevicePollingStatusDTO
 *
 * Current polling configuration and operational status for a device.
 * Returned by GetDevicePollingStatusUseCase.
 */
export interface DevicePollingStatusDTO {
  /**
   * ID of the device.
   */
  deviceId: string;

  /**
   * Whether polling is currently enabled for this device.
   */
  pollingEnabled: boolean;

  /**
   * How often the device is pinged, in seconds.
   */
  intervalSeconds: number;

  /**
   * Number of consecutive ping failures required to mark the device OFFLINE.
   */
  failuresBeforeDown: number;

  /**
   * Timestamp of the most recent poll execution. Null if never polled.
   */
  lastPolled: Date | null;

  /**
   * Estimated timestamp for the next scheduled poll.
   * Computed as lastPolled + intervalSeconds.
   * Null if polling is disabled or the device has never been polled.
   */
  nextScheduled: Date | null;

  /**
   * Current reachability status derived from the latest device state.
   */
  currentStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

  /**
   * Most recent polling result. Null if the device has never been polled.
   */
  lastResult: PollingResultDTO | null;

  /**
   * Number of consecutive poll failures since the last successful ping.
   */
  consecutiveFailures: number;
}
