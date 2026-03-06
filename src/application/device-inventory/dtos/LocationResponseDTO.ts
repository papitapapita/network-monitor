/**
 * Response DTO for a single location.
 *
 * Returned By:
 * - CreateLocationUseCase
 * - ListLocationsUseCase (as array element inside LocationListResponseDTO)
 *
 * API Endpoints:
 * - POST /api/locations
 * - GET /api/locations
 *
 * All domain value objects are flattened to primitives.
 * Dates are represented as ISO 8601 strings.
 * Nullable optional fields use `string | null` or `number | null`.
 *
 * @example
 * ```json
 * {
 *   "id": "01HZ1234ABCD",
 *   "name": "Tower Norte",
 *   "type": "TOWER",
 *   "municipality": "São Paulo",
 *   "neighborhood": "Centro",
 *   "address": "Av. Paulista, 1000",
 *   "latitude": -23.561684,
 *   "longitude": -46.655981,
 *   "altitude": 760,
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "updatedAt": "2024-01-15T10:30:00.000Z"
 * }
 * ```
 */
export interface LocationResponseDTO {
  // ===================================
  // CORE IDENTIFICATION
  // ===================================

  /**
   * Unique identifier (ULID string).
   */
  id: string;

  /**
   * Human-readable location name.
   */
  name: string;

  /**
   * Location type classification.
   * Values: TOWER, NODE, DATACENTER, POP, WAREHOUSE, OFFICE
   */
  type: string;

  // ===================================
  // ADDRESS FIELDS
  // ===================================

  /**
   * Municipality (city/town) where the location resides.
   * Null when not set.
   */
  municipality: string | null;

  /**
   * Neighbourhood within the municipality.
   * Null when not set.
   */
  neighborhood: string | null;

  /**
   * Street address.
   * Null when not set.
   */
  address: string | null;

  // ===================================
  // GEOGRAPHIC COORDINATES
  // ===================================

  /**
   * Latitude in WGS-84 decimal degrees.
   * Null when coordinates were not provided.
   */
  latitude: number | null;

  /**
   * Longitude in WGS-84 decimal degrees.
   * Null when coordinates were not provided.
   */
  longitude: number | null;

  /**
   * Altitude in metres above sea level (WGS-84).
   * Null when altitude was not provided or coordinates are absent.
   */
  altitude: number | null;

  // ===================================
  // TIMESTAMPS
  // ===================================

  /**
   * When the location was created (ISO 8601).
   */
  createdAt: string;

  /**
   * When the location was last updated (ISO 8601).
   */
  updatedAt: string;
}
