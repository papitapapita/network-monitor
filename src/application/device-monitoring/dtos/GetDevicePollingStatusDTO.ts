/**
 * Request DTO for querying current polling status and configuration for a device.
 *
 * Used By: GetDevicePollingStatusUseCase
 * API: GET /api/devices/:id/polling/status
 */
export interface GetDevicePollingStatusDTO {
  /**
   * ID of the device. Required, valid UUID.
   */
  deviceId: string;
}
