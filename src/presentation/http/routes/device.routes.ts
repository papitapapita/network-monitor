import { Router } from 'express';
import { DeviceController } from '../controllers/DeviceController';
import { validateRequest } from '../middleware/validateRequest';
import {
  createDeviceSchema,
  listDevicesSchema,
  getDeviceByIdSchema,
  updateDeviceSchema
} from '../validation/device.schemas';

/**
 * Creates Express router for Device endpoints.
 *
 * All routes belong to the device-inventory Bounded Context.
 * No route prefix is defined here — the caller mounts this router
 * under the appropriate path (e.g., /api/devices).
 *
 * Routes:
 * - POST /                - Register a new device
 * - GET  /                - List devices (paginated, optional filters)
 * - GET  /:id             - Get a device by ID
 *
 * @param controller - DeviceController instance (injected by DI container)
 * @returns Express router with all device routes
 */
export function createDeviceRoutes(controller: DeviceController): Router {
  const router = Router();

  // =====================================
  // COLLECTION ENDPOINTS
  // =====================================

  /**
   * POST /api/devices
   * Register a new physical device in the device-inventory context.
   *
   * Body: CreateDeviceInput
   *   - deviceModelId  (required) UUID of the device model
   *   - name           (required) 1-150 chars
   *   - ownerType      (required) COMPANY | CLIENT
   *   - status         (optional) INVENTORY | ACTIVE | MAINTENANCE | DAMAGED | DECOMMISSIONED
   *   - category       (optional) CORE | DISTRIBUTION | POE | ACCESS_POINT | CLIENT_CPE
   *   - locationId     (optional) UUID of assigned location
   *   - serialNumber   (optional) max 100 chars
   *   - macAddress     (optional) AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF; must be unique
   *   - ipAddress      (optional) valid IPv4 or IPv6; must be unique
   *   - description    (optional) free-text
   *   - installedDate  (optional) ISO 8601 date string
   *   - monitoringEnabled (optional) boolean, defaults to false
   *
   * Response: 201 Created with DeviceResponseDTO
   * Errors:
   *   400 - Validation failure or business constraint violation
   *   500 - Unexpected infrastructure error
   */
  router.post('/', validateRequest(createDeviceSchema), controller.create);

  /**
   * GET /api/devices
   * List devices with pagination and optional filter/sort criteria.
   *
   * Query params:
   *   - limit            (optional) 1-100, default 20
   *   - offset           (optional) ≥0, default 0
   *   - status           (optional) Filter by DeviceStatus
   *   - category         (optional) Filter by DeviceCategory
   *   - owner            (optional) Filter by DeviceOwnerType
   *   - locationId       (optional) Filter by location UUID
   *   - deviceModelId    (optional) Filter by device model UUID
   *   - monitoringEnabled (optional) true | false
   *   - search           (optional) Free-text search (name, serial, MAC, IP)
   *   - sortBy           (optional) createdAt | updatedAt | name | status
   *   - sortOrder        (optional) ASC | DESC
   *
   * Response: 200 OK with DeviceListResponseDTO
   * Errors:
   *   400 - Invalid query parameters
   *   500 - Unexpected infrastructure error
   */
  router.get('/', validateRequest(listDevicesSchema), controller.list);

  // =====================================
  // ITEM ENDPOINTS (parameterised — must come after static paths)
  // =====================================

  /**
   * GET /api/devices/:id
   * Retrieve a single device by its UUID.
   *
   * Params:
   *   - id (required) Device UUID v4
   *
   * Response: 200 OK with DeviceResponseDTO
   * Errors:
   *   400 - id is not a valid UUID v4
   *   404 - No device found with the given ID
   *   500 - Unexpected infrastructure error
   */
  router.get(
    '/:id',
    validateRequest(getDeviceByIdSchema),
    controller.getById
  );

  /**
   * PATCH /api/devices/:id
   * Partially update an existing device.
   *
   * Params:
   *   - id (required) Device UUID v4
   *
   * Body: Any subset of updatable device fields (all optional):
   *   - name, status, category, ownerType, locationId, serialNumber,
   *     macAddress, ipAddress, description, installedDate, monitoringEnabled
   *
   * Response: 200 OK with DeviceResponseDTO
   * Errors:
   *   400 - Validation failure or business constraint violation (duplicate MAC/IP)
   *   404 - No device found with the given ID
   *   500 - Unexpected infrastructure error
   */
  router.patch(
    '/:id',
    validateRequest(updateDeviceSchema),
    controller.update
  );

  return router;
}
