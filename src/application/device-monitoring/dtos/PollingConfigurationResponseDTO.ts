/**
 * Response DTO representing polling configuration for a network device.
 *
 * Used By:
 * - ConfigureDevicePollingUseCase (response)
 * - GetDevicePollingStatusUseCase (embedded in DevicePollingStatusDTO)
 * - CreateNetworkDeviceUseCase (part of device response)
 * - UpdateNetworkDeviceUseCase (when polling config changes)
 *
 * API Endpoints:
 * - POST /api/devices/:id/polling/configure (returns this)
 * - GET /api/devices/:id/polling/status (includes this)
 * - GET /api/devices/:id (includes this in device response)
 *
 * Business Context:
 * - Represents the complete polling configuration state for a device
 * - Includes scheduling information (when last polled, when next poll)
 * - Contains retry policy for handling transient failures
 * - Multi-ping configuration (1-10 pings per poll cycle)
 * - Used to display and validate polling settings in UI
 * - Essential for monitoring operations and SLA tracking
 *
 * Data Structure:
 * - All temporal data in ISO 8601 format for API compatibility
 * - Interval in seconds for human readability
 * - Retry policy as nested object with attempts and delay
 * - Nullable schedule fields for disabled or new configurations
 *
 * Business Rules:
 * - Interval: 10 seconds (minimum) to 3600 seconds (1 hour maximum)
 * - Ping Count: 1 to 10 pings per polling cycle
 * - Retry Attempts: 1 to 5 attempts for transient failures
 * - Base Delay: 100ms to 5000ms between retry attempts
 * - lastScheduledAt is null if device has never been polled
 * - nextScheduledAt is null if polling is disabled
 * - nextScheduledAt calculated as: lastScheduledAt + interval (when enabled)
 *
 * @example Enabled configuration with default settings
 * ```json
 * {
 *   "id": "polling-config-uuid-123",
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "enabled": true,
 *   "intervalSeconds": 60,
 *   "pingCount": 4,
 *   "retryPolicy": {
 *     "maxAttempts": 3,
 *     "baseDelayMs": 1000
 *   },
 *   "lastScheduledAt": "2026-01-10T12:30:00Z",
 *   "nextScheduledAt": "2026-01-10T12:31:00Z"
 * }
 * ```
 *
 * @example Disabled configuration (new device)
 * ```json
 * {
 *   "id": "polling-config-uuid-456",
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "enabled": false,
 *   "intervalSeconds": 60,
 *   "pingCount": 4,
 *   "retryPolicy": {
 *     "maxAttempts": 3,
 *     "baseDelayMs": 1000
 *   },
 *   "lastScheduledAt": null,
 *   "nextScheduledAt": null
 * }
 * ```
 *
 * @example High-frequency monitoring (access point)
 * ```json
 * {
 *   "id": "polling-config-uuid-789",
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "enabled": true,
 *   "intervalSeconds": 30,
 *   "pingCount": 10,
 *   "retryPolicy": {
 *     "maxAttempts": 5,
 *     "baseDelayMs": 500
 *   },
 *   "lastScheduledAt": "2026-01-10T12:30:00Z",
 *   "nextScheduledAt": "2026-01-10T12:30:30Z"
 * }
 * ```
 *
 * @example Low-frequency monitoring (station/workstation)
 * ```json
 * {
 *   "id": "polling-config-uuid-abc",
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "enabled": true,
 *   "intervalSeconds": 300,
 *   "pingCount": 3,
 *   "retryPolicy": {
 *     "maxAttempts": 2,
 *     "baseDelayMs": 2000
 *   },
 *   "lastScheduledAt": "2026-01-10T12:25:00Z",
 *   "nextScheduledAt": "2026-01-10T12:30:00Z"
 * }
 * ```
 */
export interface PollingConfigurationResponseDTO {
  /**
   * Polling configuration unique identifier
   * UUID format
   * This is the entity's own ID (PollingConfigurationId)
   *
   * Usage:
   * - Direct reference to this specific polling configuration entity
   * - Useful for audit logs and change tracking
   * - Can be used in URLs like /polling-configurations/:id
   */
  id: string;

  /**
   * Network device unique identifier
   * UUID format
   * The device (aggregate root) this polling configuration belongs to
   *
   * Relationship:
   * - 1:1 relationship: Each device has exactly one polling configuration
   * - This is a reference to the parent aggregate
   * - Used to navigate from polling config back to device
   */
  networkDeviceId: string;

  /**
   * Whether polling is enabled for this device
   * When false:
   * - No automatic polling occurs
   * - nextScheduledAt should be null
   * - Manual/forced polling still allowed via ExecutePollingCycleUseCase
   */
  enabled: boolean;

  /**
   * Polling interval in seconds
   * Minimum: 10 seconds (high-frequency critical devices)
   * Maximum: 3600 seconds (1 hour for low-priority devices)
   *
   * Common intervals by device type:
   * - Access Points: 30 seconds
   * - Routers: 60 seconds
   * - Switches: 60 seconds
   * - Firewalls: 60 seconds
   * - Stations: 300 seconds (5 minutes)
   *
   * Used to calculate nextScheduledAt: lastScheduledAt + intervalSeconds
   */
  intervalSeconds: number;

  /**
   * Number of ICMP pings to send per polling cycle
   * Minimum: 1 (single ping, fastest but less reliable)
   * Maximum: 10 (comprehensive statistics but slower)
   * Default: 4 (good balance for most devices)
   *
   * Multi-ping benefits:
   * - More accurate response time averaging
   * - Jitter calculation (variance between pings)
   * - Better packet loss detection
   * - Reduces false positives from transient network issues
   *
   * Trade-offs:
   * - More pings = more accurate statistics
   * - More pings = longer polling time
   * - More pings = more network traffic
   */
  pingCount: number;

  /**
   * Retry policy for handling transient polling failures
   *
   * Applied when:
   * - Network timeout occurs
   * - Temporary connectivity issues
   * - Transient packet loss
   *
   * NOT applied when:
   * - Device is in MAINTENANCE status
   * - Polling is disabled
   * - Device is soft-deleted
   *
   * Strategy:
   * - Exponential backoff: delay doubles with each retry
   * - Example: baseDelayMs=1000, attempts: 1000ms, 2000ms, 4000ms
   */
  retryPolicy: {
    /**
     * Maximum number of retry attempts
     * Minimum: 1 (no retries, fail immediately)
     * Maximum: 5 (extensive retry for critical devices)
     * Default: 3 (good balance for most devices)
     *
     * Total attempts = maxAttempts (includes initial attempt)
     * Example: maxAttempts=3 means 1 initial + 2 retries
     */
    maxAttempts: number;

    /**
     * Base delay in milliseconds between retry attempts
     * Minimum: 100ms (very aggressive retries)
     * Maximum: 5000ms (5 seconds, conservative retries)
     * Default: 1000ms (1 second, balanced approach)
     *
     * Actual delays use exponential backoff:
     * - Attempt 1: baseDelayMs * 1 = 1000ms
     * - Attempt 2: baseDelayMs * 2 = 2000ms
     * - Attempt 3: baseDelayMs * 4 = 4000ms
     */
    baseDelayMs: number;
  };

  /**
   * Timestamp of when this device was last polled
   * ISO 8601 format
   * Null if device has never been polled
   *
   * Updated after each polling cycle (success or failure)
   * Used to calculate nextScheduledAt
   * Used to track polling health and compliance
   */
  lastScheduledAt: string | null;

  /**
   * Timestamp of when this device is scheduled for next poll
   * ISO 8601 format
   * Null if polling is disabled or not yet scheduled
   *
   * Calculation:
   * - Enabled: lastScheduledAt + intervalSeconds
   * - Disabled: null
   * - Never polled: calculated from device creation time
   *
   * Used by:
   * - Polling scheduler to determine when to poll
   * - Monitoring dashboard to show next poll time
   * - SLA tracking to detect missed polls
   */
  nextScheduledAt: string | null;
}
