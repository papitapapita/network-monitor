import { LocationResponseDTO } from './LocationResponseDTO';

/**
 * Paginated list response for locations.
 *
 * Returned By: ListLocationsUseCase
 * API Endpoint: GET /api/locations
 *
 * The hasMore flag allows presentation-layer clients to implement
 * cursor-style pagination without exposing raw SQL offset semantics.
 *
 * @example
 * ```json
 * {
 *   "locations": [
 *     {
 *       "id": "01HZ1234ABCD",
 *       "name": "Tower Norte",
 *       "type": "TOWER",
 *       "municipality": "São Paulo",
 *       "neighborhood": "Centro",
 *       "address": "Av. Paulista, 1000",
 *       "latitude": -23.561684,
 *       "longitude": -46.655981,
 *       "altitude": 760,
 *       "createdAt": "2024-01-15T10:30:00.000Z",
 *       "updatedAt": "2024-01-15T10:30:00.000Z"
 *     }
 *   ],
 *   "total": 42,
 *   "hasMore": true,
 *   "limit": 20,
 *   "offset": 0
 * }
 * ```
 */
export interface LocationListResponseDTO {
  /** Array of location response DTOs for the current page. */
  locations: LocationResponseDTO[];

  /** Total count of locations matching the query (before pagination). */
  total: number;

  /** Whether there are more results available beyond the current page. */
  hasMore: boolean;

  /** Number of items requested per page. */
  limit: number;

  /** Number of items skipped before the current page. */
  offset: number;
}
