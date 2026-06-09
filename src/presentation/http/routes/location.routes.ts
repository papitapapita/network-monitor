import { Router } from 'express';
import { LocationController } from '../controllers';
import { validateRequest, authorize, createRateLimiter } from '../middleware';
import {
  createLocationSchema,
  listLocationsSchema,
  getLocationByIdSchema,
  updateLocationSchema
} from '../validation';

/**
 * Creates Express router for Location endpoints.
 *
 * All routes belong to the device-inventory Bounded Context.
 * No route prefix is defined here — the caller mounts this router
 * under the appropriate path (e.g., /api/locations).
 *
 * @param controller - LocationController instance (injected by DI container)
 * @returns Express router with all location routes
 *
 * Routes:
 * - POST /                - Register a new location
 * - GET  /                - List locations (paginated, optional type filter)
 * - GET  /:id             - Get a location by ID
 *
 * @example
 * ```typescript
 * const controller = new LocationController(...);
 * const router = createLocationRoutes(controller);
 * app.use('/api/locations', router);
 * ```
 */
export function createLocationRoutes(
  controller: LocationController
): Router {
  const router = Router();

  // =====================================
  // COLLECTION ENDPOINTS
  // =====================================

  /**
   * POST /api/locations
   * Register a new location in the device-inventory context.
   *
   * Body: CreateLocationInput
   *   - name         (required) Location name, 1-150 chars
   *   - type         (required) One of: TOWER, NODE, DATACENTER, POP, WAREHOUSE, OFFICE
   *   - municipality (optional) Max 100 chars
   *   - neighborhood (optional) Max 150 chars
   *   - address      (optional) Max 255 chars
   *   - latitude     (optional) -90 to 90; must be paired with longitude
   *   - longitude    (optional) -180 to 180; must be paired with latitude
   *   - altitude     (optional) Metres above sea level; finite number
   *
   * Response: 201 Created with LocationResponseDTO
   * Errors:
   *   400 - Validation failure (empty name, invalid type, unpaired coordinates)
   *   500 - Unexpected infrastructure error
   */
  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createLocationSchema),
    controller.create
  );

  /**
   * GET /api/locations
   * List locations with pagination and optional type filter.
   *
   * Query params:
   *   - limit  (optional) Max results per page; 1-100, default 20
   *   - offset (optional) Items to skip; ≥0, default 0
   *   - type   (optional) Filter by LocationType enum value
   *
   * Response: 200 OK with LocationListResponseDTO
   *   { locations: [...], total: number, hasMore: boolean, limit: number, offset: number }
   * Errors:
   *   400 - Invalid query parameters (limit/offset out of range, unknown type)
   *   500 - Unexpected infrastructure error
   */
  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listLocationsSchema),
    controller.list
  );

  // =====================================
  // ITEM ENDPOINTS (parameterised — must come after static paths)
  // =====================================

  /**
   * GET /api/locations/:id
   * Retrieve a single location by its UUID.
   *
   * Params:
   *   - id (required) Location UUID v4
   *
   * Response: 200 OK with LocationResponseDTO
   * Errors:
   *   400 - id is not a valid UUID v4
   *   404 - No location found with the given ID
   *   500 - Unexpected infrastructure error
   */
  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getLocationByIdSchema),
    controller.getById
  );

  /**
   * PATCH /api/locations/:id
   * Partially update an existing location.
   *
   * Params:
   *   - id (required) Location UUID v4
   *
   * Body: Any subset of updatable location fields (all optional):
   *   - name, type, municipality, neighborhood, address,
   *     latitude, longitude, altitude
   *
   * Response: 200 OK with LocationResponseDTO
   * Errors:
   *   400 - Validation failure (invalid type, unpaired coordinates)
   *   404 - No location found with the given ID
   *   500 - Unexpected infrastructure error
   */
  router.patch(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateLocationSchema),
    controller.update
  );

  return router;
}
