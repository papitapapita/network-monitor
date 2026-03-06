/**
 * Response DTO for single device polling cycle execution.
 *
 * Used By:
 * - ExecutePollingCycleUseCase
 *
 * Business Context:
 * - Provides immediate feedback on single device polling execution
 * - Includes metrics for successful polls
 * - Reports failure details for troubleshooting
 * - Shows retry attempts for visibility
 * - Indicates device status after poll
 *
 * Note: This differs from PollingCycleSummaryDTO which is for batch polling operations
 *
 * @example Successful polling result
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "SUCCESS",
 *   "message": "Device polled successfully with 3 pings",
 *   "attemptNumber": 1,
 *   "timestamp": "2026-01-09T10:30:00.000Z",
 *   "metrics": {
 *     "responseTimes": [12.5, 13.2, 11.8],
 *     "averageResponseTime": 12.5,
 *     "minResponseTime": 11.8,
 *     "maxResponseTime": 13.2,
 *     "packetLoss": 0.0,
 *     "jitter": 0.7
 *   },
 *   "deviceStatus": "ONLINE"
 * }
 * ```
 *
 * @example Failed polling result
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "FAILED",
 *   "message": "Polling failed after 3 attempts: Request timeout",
 *   "attemptNumber": 3,
 *   "timestamp": "2026-01-09T10:30:15.000Z",
 *   "metrics": null,
 *   "deviceStatus": "OFFLINE"
 * }
 * ```
 *
 * @example Skipped polling result
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": "SKIPPED",
 *   "message": "Device polling is not scheduled or not enabled",
 *   "attemptNumber": 0,
 *   "timestamp": "2026-01-09T10:30:00.000Z",
 *   "metrics": null,
 *   "deviceStatus": "OFFLINE"
 * }
 * ```
 */
export interface SingleDevicePollingResultDTO {
  /**
   * Network device unique identifier
   * The device that was polled
   */
  networkDeviceId: string;

  /**
   * Polling cycle status
   * - SUCCESS: Polling completed successfully
   * - FAILED: Polling failed after all retry attempts
   * - SKIPPED: Polling was skipped (not scheduled or not enabled)
   */
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';

  /**
   * Human-readable message describing the result
   * Examples:
   * - "Device polled successfully with 3 pings"
   * - "Polling failed after 3 attempts: Request timeout"
   * - "Device polling is not scheduled or not enabled"
   */
  message: string;

  /**
   * Number of attempts made during this polling cycle
   * - 0: Skipped (no attempts)
   * - 1: Success on first attempt
   * - 2+: Required retries before success/failure
   */
  attemptNumber: number;

  /**
   * Timestamp when polling was executed
   * ISO 8601 format
   */
  timestamp: Date;

  /**
   * Polling metrics (only present for successful polls)
   * null if polling failed or was skipped
   */
  metrics: {
    responseTimes: number[];
    averageResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    packetLoss: number;
    jitter: number;
  } | null;

  /**
   * Device status after polling
   * - ONLINE: Device responded successfully
   * - OFFLINE: Device did not respond
   * - Other statuses preserved from before poll
   */
  deviceStatus: string;
}
