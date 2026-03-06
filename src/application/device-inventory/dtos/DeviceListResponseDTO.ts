import { DeviceResponseDTO } from './DeviceResponseDTO';

/**
 * Paginated list response for devices.
 *
 * Returned By: ListDevicesUseCase
 * API Endpoint: GET /api/devices
 *
 * The hasMore flag allows presentation-layer clients to implement
 * cursor-style pagination without exposing raw SQL offset semantics.
 *
 * @example
 * ```json
 * {
 *   "devices": [
 *     {
 *       "id": "550e8400-e29b-41d4-a716-446655440000",
 *       "name": "Core-Router-01",
 *       "status": "ACTIVE",
 *       "ownerType": "COMPANY",
 *       ...
 *     }
 *   ],
 *   "total": 42,
 *   "hasMore": true,
 *   "limit": 20,
 *   "offset": 0
 * }
 * ```
 */
export interface DeviceListResponseDTO {
  /** Array of device response DTOs for the current page. */
  devices: DeviceResponseDTO[];

  /** Total count of devices matching the query (before pagination). */
  total: number;

  /** Whether there are more results available beyond the current page. */
  hasMore: boolean;

  /** Number of items requested per page. */
  limit: number;

  /** Number of items skipped before the current page. */
  offset: number;
}
