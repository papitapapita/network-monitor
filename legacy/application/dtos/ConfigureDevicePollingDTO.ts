/**
 * Request DTO for configuring device polling settings.
 *
 * Used By:
 * - ConfigureDevicePollingUseCase
 *
 * API Endpoint:
 * - PUT /api/devices/:id/polling
 * - PATCH /api/devices/:id/polling
 *
 * Business Context:
 * - Controls how frequently the device is polled for status
 * - Determines ping count for reliability statistics
 * - Enables/disables polling without changing configuration
 * - Affects system load and monitoring accuracy
 *
 * Validation Rules:
 * - networkDeviceId: Required, valid UUID format
 * - intervalSeconds: Required, 1-86400 (24 hours max)
 * - enabled: Required, boolean
 * - pingCount: Optional, 1-10, default uses existing value
 *
 * Business Rules (enforced by Use Case):
 * - Device must exist and not be soft-deleted
 * - Interval must be within acceptable range for system performance
 * - Ping count affects network traffic and response time
 * - Changing interval emits PollingIntervalChangedEvent
 * - Changing ping count emits PingCountChangedEvent
 * - Enabling/disabling emits PollingConfigurationChangedEvent
 *
 * Recommended Intervals by Device Type:
 * - ACCESS_POINT: 30 seconds (frequent monitoring)
 * - STATION: 300 seconds (5 minutes, less critical)
 * - ROUTER/SWITCH/FIREWALL: 60 seconds (standard monitoring)
 * - Others: 60 seconds (default)
 *
 * @example Enable polling with 60-second interval
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "intervalSeconds": 60,
 *   "enabled": true,
 *   "pingCount": 3
 * }
 * ```
 *
 * @example Disable polling (keeps interval configuration)
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "intervalSeconds": 60,
 *   "enabled": false
 * }
 * ```
 */
export interface ConfigureDevicePollingDTO {
  /**
   * Network device unique identifier
   * Required, valid UUID format
   * Device must exist and not be soft-deleted
   */
  networkDeviceId: string;

  /**
   * Polling interval in seconds
   * Required, range: 1-86400 (1 second to 24 hours)
   * Determines how frequently the device is polled
   *
   * Recommended values:
   * - 30: Frequent monitoring (ACCESS_POINT)
   * - 60: Standard monitoring (ROUTER, SWITCH, FIREWALL)
   * - 300: Less frequent (STATION, 5 minutes)
   */
  intervalSeconds: number;

  /**
   * Whether polling should be enabled
   * Required, boolean
   * - true: Enable polling with the specified interval
   * - false: Disable polling (keeps interval configuration)
   */
  enabled: boolean;

  /**
   * Number of ICMP pings per poll
   * Optional, range: 1-10, default: existing value
   * Used for packet loss statistics and reliability metrics
   *
   * Higher values:
   * - More accurate statistics
   * - More network traffic
   * - Longer poll duration
   *
   * Recommended: 3-5 for most devices
   */
  pingCount?: number;
}
