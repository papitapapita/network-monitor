/**
 * Query DTO for listing locations with optional pagination and type filter.
 *
 * Used By: ListLocationsUseCase
 * API Endpoint: GET /api/locations
 *
 * Pagination Rules:
 * - limit: Defaults to 20, capped at 100 by the use case.
 * - offset: Defaults to 0.
 *
 * Filter Rules:
 * - type: Optional. When provided, only locations of that type are returned.
 *         Must be one of: TOWER, NODE, DATACENTER, POP, WAREHOUSE, OFFICE
 *
 * @example No filter
 * ```json
 * { "limit": 10, "offset": 0 }
 * ```
 *
 * @example With type filter
 * ```json
 * { "type": "TOWER", "limit": 50, "offset": 0 }
 * ```
 */
export interface ListLocationsQueryDTO {
  /**
   * Maximum number of results to return.
   * Optional, default: 20, max: 100.
   */
  limit?: number;

  /**
   * Number of results to skip (zero-based).
   * Optional, default: 0.
   */
  offset?: number;

  /**
   * Filter by location type.
   * Optional. Valid values: TOWER, NODE, DATACENTER, POP, WAREHOUSE, OFFICE
   */
  type?: string;
}
