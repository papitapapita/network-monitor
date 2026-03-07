/**
 * Request DTO for retrieving a single device by ID.
 *
 * Used By: GetDeviceUseCase
 * API Endpoint: GET /api/devices/:id
 */
export interface GetDeviceRequestDTO {
  id: string;
}
