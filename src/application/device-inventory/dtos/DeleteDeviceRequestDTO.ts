/**
 * Request DTO for deleting a single device by ID.
 *
 * Used By: DeleteDeviceUseCase
 * API Endpoint: DELETE /api/devices/:id
 */
export interface DeleteDeviceRequestDTO {
  id: string;
}
