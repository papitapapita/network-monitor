/**
 * Request DTO for executing a polling cycle on a device.
 *
 * Used By: ExecutePollingCycleUseCase
 * API: POST /api/devices/:id/poll
 */
export interface ExecutePollingCycleDTO {
  /**
   * ID of the device to poll. Required, valid UUID.
   */
  deviceId: string;

  /**
   * When true, polls the device even if polling is disabled for it.
   * Intended for manual/on-demand checks. Default: false.
   */
  forceExecution?: boolean;
}
