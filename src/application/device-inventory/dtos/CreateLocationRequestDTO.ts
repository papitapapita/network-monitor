/**
 * Request DTO for creating a new location.
 *
 * Used By: CreateLocationUseCase
 * API Endpoint: POST /api/locations
 *
 * Validation Rules:
 * - name: Required, 1–150 characters
 * - type: Required, one of: TOWER, NODE, DATACENTER, POP, WAREHOUSE, OFFICE
 * - municipality: Optional, max 100 characters
 * - neighborhood: Optional, max 150 characters
 * - address: Optional, max 255 characters
 * - latitude: Optional, range -90 to 90. Must be provided together with longitude.
 * - longitude: Optional, range -180 to 180. Must be provided together with latitude.
 * - altitude: Optional, elevation above sea level in metres (any finite number).
 *
 * @example Minimal
 * ```json
 * {
 *   "name": "Tower Norte",
 *   "type": "TOWER"
 * }
 * ```
 *
 * @example Full
 * ```json
 * {
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
 */
export interface CreateLocationRequestDTO {
  // ===================================
  // REQUIRED FIELDS
  // ===================================

  /**
   * Human-readable location name.
   * Required, 1–150 characters.
   * Example: "Tower Norte"
   */
  name: string;

  /**
   * Location type classification.
   * Required, must be one of the LocationType enum values.
   * Valid values: TOWER, NODE, DATACENTER, POP, WAREHOUSE, OFFICE
   */
  type: string;

  // ===================================
  // OPTIONAL ADDRESS FIELDS
  // ===================================

  /**
   * Municipality (city/town) where the location resides.
   * Optional, max 100 characters.
   */
  municipality?: string | null;

  /**
   * Neighbourhood within the municipality.
   * Optional, max 150 characters.
   */
  neighborhood?: string | null;

  /**
   * Street address.
   * Optional, max 255 characters.
   */
  address?: string | null;

  // ===================================
  // OPTIONAL GEOGRAPHIC COORDINATES
  // ===================================

  /**
   * Latitude in WGS-84 decimal degrees.
   * Optional, range -90 to 90.
   * Must be provided together with longitude.
   */
  latitude?: number | null;

  /**
   * Longitude in WGS-84 decimal degrees.
   * Optional, range -180 to 180.
   * Must be provided together with latitude.
   */
  longitude?: number | null;

  /**
   * Altitude in metres above sea level (WGS-84).
   * Optional, any finite number (negative values are valid, e.g. below sea level).
   * Only meaningful when latitude and longitude are also provided.
   */
  altitude?: number;
}
