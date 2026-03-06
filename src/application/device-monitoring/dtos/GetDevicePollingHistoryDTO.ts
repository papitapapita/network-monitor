/**
 * Request DTO for querying historical polling results for a device.
 *
 * Used By:
 * - GetDevicePollingHistoryUseCase
 *
 * API Endpoint:
 * - GET /api/devices/:id/polling/history
 * - GET /api/polling/history/:deviceId
 *
 * Business Context:
 * - Query historical polling data for a specific device
 * - Support time range filtering for trend analysis
 * - Paginated results for large datasets
 * - Status filtering for specific result types (SUCCESS, FAILED, etc.)
 * - Returns aggregate statistics for SLA reporting and performance trending
 * - Useful for: Displaying polling history charts, SLA reporting,
 *   performance trending, incident investigation
 *
 * Validation Rules:
 * - networkDeviceId: Required, valid UUID format
 * - fromDate: Optional, must be before toDate if both provided
 * - toDate: Optional, must be after fromDate if both provided
 * - status: Optional, array of valid polling statuses
 * - limit: Optional, between 1 and 1000, default 100
 * - offset: Optional, non-negative integer, default 0
 *
 * Business Rules (enforced by Use Case):
 * - Default time range: Last 24 hours if not specified
 * - Maximum limit: 1000 results per query
 * - Pagination: Use offset and limit for large datasets
 * - Statistics calculated across all results in time range (not just paginated subset)
 * - Read-only operation, no data modification
 *
 * @example Query last 24 hours with default pagination
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 *
 * @example Query specific time range with pagination
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "fromDate": "2026-01-01T00:00:00Z",
 *   "toDate": "2026-01-09T23:59:59Z",
 *   "limit": 50,
 *   "offset": 100
 * }
 * ```
 *
 * @example Query only failed polls
 * ```json
 * {
 *   "networkDeviceId": "550e8400-e29b-41d4-a716-446655440000",
 *   "status": ["FAILED", "TIMEOUT"],
 *   "limit": 20
 * }
 * ```
 */
export interface GetDevicePollingHistoryDTO {
  /**
   * Network device unique identifier
   * Required, valid UUID format
   * Device must exist to retrieve history
   */
  networkDeviceId: string;

  /**
   * Start of time range for query
   * Optional, ISO 8601 format
   * Default: 24 hours ago from current time
   * Must be before toDate if both are provided
   */
  fromDate?: Date;

  /**
   * End of time range for query
   * Optional, ISO 8601 format
   * Default: Current time
   * Must be after fromDate if both are provided
   */
  toDate?: Date;

  /**
   * Filter by polling status
   * Optional, array of valid status values
   * Common values: 'SUCCESS', 'FAILED', 'TIMEOUT', 'PARTIAL_SUCCESS'
   *
   * If not provided, all statuses are returned
   * If empty array, all statuses are returned
   * If provided, only results with these statuses are included
   *
   * @example ['SUCCESS', 'PARTIAL_SUCCESS'] - Only successful polls
   * @example ['FAILED', 'TIMEOUT'] - Only failed polls
   */
  status?: string[];

  /**
   * Maximum number of results to return (pagination)
   * Optional, between 1 and 1000
   * Default: 100
   *
   * Used with offset for pagination through large result sets
   * Note: Statistics are calculated across ALL results, not just paginated subset
   */
  limit?: number;

  /**
   * Number of results to skip (pagination)
   * Optional, non-negative integer
   * Default: 0
   *
   * Used with limit for pagination
   *
   * @example offset=0, limit=100 - First page (results 0-99)
   * @example offset=100, limit=100 - Second page (results 100-199)
   * @example offset=200, limit=100 - Third page (results 200-299)
   */
  offset?: number;
}
