/**
 * Request DTO for updating an existing location.
 *
 * Used By: UpdateLocationUseCase
 * API Endpoint: PATCH /api/locations/:id
 *
 * Validation Rules:
 * - id: Required, valid UUID — the location to update.
 * - name: Optional, 1–150 characters.
 * - type: Optional, one of: TOWER, NODE, DATACENTER, POP, WAREHOUSE, OFFICE.
 * - municipality: Optional, max 100 characters. Pass null to clear.
 * - neighborhood: Optional, max 150 characters. Pass null to clear.
 * - address: Optional, max 255 characters. Pass null to clear.
 * - latitude: Optional, range -90 to 90. Must be provided together with longitude.
 * - longitude: Optional, range -180 to 180. Must be provided together with latitude.
 * - altitude: Optional, elevation above sea level in metres (any finite number).
 *
 * Only the fields present in the request are applied; omitted fields are left unchanged
 * (PATCH semantics). To clear coordinates, pass both latitude and longitude as null.
 *
 * @example Minimal (only required field)
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000"
 * }
 * ```
 *
 * @example Partial update — rename a location
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Tower Norte Revised"
 * }
 * ```
 *
 * @example Full update
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Tower Norte",
 *   "type": "TOWER",
 *   "municipality": "São Paulo",
 *   "neighborhood": "Centro",
 *   "address": "Av. Paulista, 1000",
 *   "latitude": -23.561684,
 *   "longitude": -46.655981,
 *   "altitude": 760
 * }
 * ```
 *
 * @example Clear coordinates
 * ```json
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "latitude": null,
 *   "longitude": null
 * }
 * ```
 */
export interface UpdateLocationRequestDTO {
  // ===================================
  // REQUIRED FIELDS
  // ===================================

  /**
   * UUID of the location to update.
   * Required, must be a valid UUID.
   */
  id: string;

  // ===================================
  // OPTIONAL CORE FIELDS
  // ===================================

  /**
   * Human-readable location name.
   * Optional, 1–150 characters.
   * Example: "Tower Norte"
   */
  name?: string;

  /**
   * Location type classification.
   * Optional, must be one of the LocationType enum values when provided.
   * Valid values: TOWER, NODE, DATACENTER, POP, WAREHOUSE, OFFICE.
   */
  type?: string;

  // ===================================
  // OPTIONAL ADDRESS FIELDS
  // ===================================

  /**
   * Municipality (city/town) where the location resides.
   * Optional, max 100 characters.
   * Pass null to clear the current value.
   */
  municipality?: string | null;

  /**
   * Neighbourhood within the municipality.
   * Optional, max 150 characters.
   * Pass null to clear the current value.
   */
  neighborhood?: string | null;

  /**
   * Street address.
   * Optional, max 255 characters.
   * Pass null to clear the current value.
   */
  address?: string | null;

  // ===================================
  // OPTIONAL GEOGRAPHIC COORDINATES
  // ===================================

  /**
   * Latitude in WGS-84 decimal degrees.
   * Optional, range -90 to 90.
   * Must be provided together with longitude.
   * Pass null (together with longitude: null) to clear coordinates.
   */
  latitude?: number | null;

  /**
   * Longitude in WGS-84 decimal degrees.
   * Optional, range -180 to 180.
   * Must be provided together with latitude.
   * Pass null (together with latitude: null) to clear coordinates.
   */
  longitude?: number | null;

  /**
   * Altitude in metres above sea level (WGS-84).
   * Optional, any finite number (negative values are valid, e.g. below sea level).
   * Only meaningful when latitude and longitude are also provided.
   */
  altitude?: number;
}
