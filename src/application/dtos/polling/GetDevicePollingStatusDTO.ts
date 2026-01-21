/**
 * Request DTO for querying current polling status and configuration for a device.
 *
 * Used By:
 * - GetDevicePollingStatusUseCase
 *
 * API Endpoint:
 * - GET /api/devices/:id/polling/status
 * - GET /api/polling/status/:deviceId
 *
 * Business Context:
 * - Retrieve current polling configuration and operational status
 * - Display real-time polling state on device dashboard
 * - Monitor polling health and consecutive failures
 * - View next scheduled poll time
 * - Check multi-ping statistics from last poll
 * - Useful for: Real-time monitoring, troubleshooting polling issues,
 *   validating configuration changes, SLA monitoring
 *
 * Validation Rules:
 * - networkDeviceId: Required, valid UUID format
 * - Device must exist in the system
 *
 * Business Rules (enforced by Use Case):
 * - Returns current polling configuration from device aggregate
 * - Includes most recent polling result with statistics
 * - Calculates consecutive failures from last 24 hours
 * - Next scheduled time is null if polling is disabled
 * - Read-only operation, no data modification
 * - Multi-ping statistics available if last poll succeeded
 *
 * @example Query polling status for a device
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 *
 * @example Response structure (returned as DevicePollingStatusDTO)
 * ```json
 * {
 *   "deviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "deviceName": "Core-Router-01",
 *   "pollingEnabled": true,
 *   "intervalSeconds": 60,
 *   "pingCount": 4,
 *   "lastPolled": "2026-01-10T12:30:00Z",
 *   "nextScheduled": "2026-01-10T12:31:00Z",
 *   "currentStatus": "ONLINE",
 *   "consecutiveFailures": 0,
 *   "lastPollStatistics": {
 *     "responseTimes": [10.5, 11.2, 10.8, 11.0],
 *     "average": 10.875,
 *     "min": 10.5,
 *     "max": 11.2,
 *     "jitter": 0.7,
 *     "packetLoss": 0
 *   }
 * }
 * ```
 */
export interface GetDevicePollingStatusDTO {
  /**
   * Network device unique identifier
   * Required, valid UUID format
   * Device must exist in the system
   */
  networkDeviceId: string;
}
