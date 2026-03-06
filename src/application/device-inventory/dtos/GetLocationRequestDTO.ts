/**
 * Request DTO for retrieving a single location by its unique identifier.
 *
 * Used By: GetLocationUseCase
 * API Endpoint: GET /api/locations/:id
 *
 * Validation Rules:
 * - id: Required, non-empty string (ULID format enforced at the presentation layer).
 *
 * @example
 * ```json
 * { "id": "01HZ1234ABCD" }
 * ```
 */
export interface GetLocationRequestDTO {
  /**
   * Unique identifier of the location (ULID string).
   * Required.
   */
  id: string;
}
