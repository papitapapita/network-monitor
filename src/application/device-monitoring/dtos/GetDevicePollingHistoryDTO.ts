/**
 * Request DTO for querying historical polling results for a device.
 *
 * Used By: GetDevicePollingHistoryUseCase
 * API: GET /api/devices/:id/polling/history
 */
export interface GetDevicePollingHistoryDTO {
  /**
   * ID of the device. Required, valid UUID.
   */
  deviceId: string;

  /**
   * Include only results on or after this timestamp. Optional.
   * Must be before toDate when both are provided.
   */
  fromDate?: Date;

  /**
   * Include only results on or before this timestamp. Optional.
   * Must be after fromDate when both are provided.
   */
  toDate?: Date;

  /**
   * Filter by poll outcome. Optional.
   * When omitted or empty, all results are returned.
   */
  status?: ('SUCCESS' | 'FAILED' | 'UNKNOWN')[];

  /**
   * Maximum number of results to return. Between 1 and 1000. Default: 100.
   */
  limit?: number;

  /**
   * Number of results to skip for pagination. Non-negative. Default: 0.
   */
  offset?: number;
}
