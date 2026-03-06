/**
 * Query DTO for listing devices with optional pagination and filter criteria.
 *
 * Used By: ListDevicesUseCase
 * API Endpoint: GET /api/devices
 *
 * Pagination Rules:
 * - limit: Defaults to 20, capped at 100 by the use case.
 * - offset: Defaults to 0.
 *
 * Filter Rules:
 * - All filter parameters are optional and combined with AND logic.
 * - Enum-typed filters (status, category, owner) are case-insensitive.
 *
 * @example No filter
 * ```json
 * { "limit": 10, "offset": 0 }
 * ```
 *
 * @example With filters
 * ```json
 * {
 *   "status": "ACTIVE",
 *   "category": "CORE",
 *   "owner": "COMPANY",
 *   "monitoringEnabled": true,
 *   "sortBy": "name",
 *   "sortOrder": "ASC",
 *   "limit": 20,
 *   "offset": 0
 * }
 * ```
 */
export interface ListDevicesQueryDTO {
  // ===================================
  // PAGINATION
  // ===================================

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

  // ===================================
  // FILTER CRITERIA
  // ===================================

  /**
   * Filter by operational status.
   * Optional. Valid values: INVENTORY, ACTIVE, MAINTENANCE, DAMAGED, DECOMMISSIONED.
   */
  status?: string;

  /**
   * Filter by device category.
   * Optional. Valid values: CORE, DISTRIBUTION, POE, ACCESS_POINT, CLIENT_CPE.
   */
  category?: string;

  /**
   * Filter by owner type.
   * Optional. Valid values: COMPANY, CLIENT.
   */
  owner?: string;

  /**
   * Filter by assigned location UUID.
   * Optional.
   */
  locationId?: string;

  /**
   * Filter by device model UUID.
   * Optional.
   */
  deviceModelId?: string;

  /**
   * Filter by monitoring state.
   * Optional.
   */
  monitoringEnabled?: boolean;

  /**
   * Full-text search across name, serial number, MAC, and IP fields.
   * Optional.
   */
  search?: string;

  // ===================================
  // SORTING
  // ===================================

  /**
   * Field to sort results by.
   * Optional. Valid values: createdAt, updatedAt, name, status.
   * Defaults to createdAt when omitted.
   */
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status';

  /**
   * Sort direction.
   * Optional. Valid values: ASC, DESC.
   * Defaults to DESC when omitted.
   */
  sortOrder?: 'ASC' | 'DESC';
}
