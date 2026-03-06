/**
 * Request DTO for executing a polling cycle on a network device.
 *
 * Used By:
 * - ExecutePollingCycleUseCase
 *
 * API Endpoint:
 * - POST /api/polling/execute
 * - POST /api/devices/:id/poll (manual poll)
 *
 * Business Context:
 * - Core polling execution that checks device availability
 * - Performs multi-ping ICMP polling (configurable 1-10 pings)
 * - Handles automatic retries based on RetryPolicy
 * - Creates and persists PollingResult aggregate
 * - Emits domain events for cross-aggregate coordination
 * - Updates device status via event handlers (eventual consistency)
 *
 * Validation Rules:
 * - networkDeviceId: Required, valid UUID format
 * - forceExecution: Optional, boolean, default false
 *
 * Business Rules (enforced by Use Case):
 * - Device must exist and not be soft-deleted
 * - Device must have polling enabled (unless forceExecution=true)
 * - Device must be scheduled for polling (unless forceExecution=true)
 * - Poller must support the device's protocol/type
 * - Retry logic respects device's RetryPolicy configuration
 * - Success emits DevicePolledSuccessfullyEvent
 * - Failure emits DevicePollingFailedEvent
 * - NetworkDevice status updated via event handler (ONLINE/OFFLINE)
 *
 * Polling Modes:
 * - Scheduled (forceExecution=false, default):
 *   * Respects polling schedule (nextScheduledAt)
 *   * Requires polling enabled
 *   * Skips if not due yet
 * - Manual/Forced (forceExecution=true):
 *   * Ignores schedule
 *   * Ignores enabled status
 *   * Always executes (useful for testing, manual checks)
 *
 * @example Scheduled polling (automated)
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "forceExecution": false
 * }
 * ```
 *
 * @example Manual/forced polling (user-initiated)
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "forceExecution": true
 * }
 * ```
 */
export interface ExecutePollingCycleDTO {
  /**
   * Network device unique identifier
   * Required, valid UUID format
   * Device must exist and not be soft-deleted
   */
  networkDeviceId: string;

  /**
   * Whether to force execution (ignore schedule and enabled status)
   * Optional, default: false
   *
   * - false (default): Scheduled polling
   *   * Respects polling schedule
   *   * Requires polling enabled
   *   * Skips if not due yet
   *
   * - true: Manual/forced polling
   *   * Ignores schedule
   *   * Ignores enabled status
   *   * Always executes
   */
  forceExecution?: boolean;
}
