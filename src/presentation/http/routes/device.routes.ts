import { Router } from 'express';
import { DeviceController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createDeviceSchema,
  listDevicesSchema,
  getDeviceByIdSchema,
  updateDeviceSchema,
  deleteDeviceSchema,
  restoreDeviceSchema,
  replaceDeviceSchema,
  permanentlyDeleteDeviceSchema
} from '../validation/device.schemas';

/**
 * Creates Express router for Device endpoints.
 *
 * All routes belong to the device-inventory Bounded Context.
 * No route prefix is defined here — the caller mounts this router
 * under the appropriate path (e.g., /api/devices).
 *
 * Routes:
 * - POST   /              - Register a new device
 * - GET    /              - List devices (paginated, optional filters)
 * - GET    /:id           - Get a device by ID
 * - PATCH  /:id           - Partially update a device
 * - DELETE /:id           - Soft-delete a device (7-day grace period)
 * - POST   /:id/restore   - Undo a soft-delete inside the grace period
 * - POST   /:id/replace   - Swap in different hardware, retiring this unit
 * - DELETE /:id/purge     - Permanently remove a device already in the bin
 *
 * @param controller - DeviceController instance (injected by DI container)
 * @returns Express router with all device routes
 */
export function createDeviceRoutes(
  controller: DeviceController
): Router {
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
   *   - status         (optional) INVENTORY | COMMISSIONING | ACTIVE | DAMAGED
   *   - category       (optional) CPE | WIRELESS_CPE | ACCESS_POINT | GATEWAY | AGGREGATION_SWITCH | OTHER
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
  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createDeviceSchema),
    controller.create
  );

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
  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listDevicesSchema),
    controller.list
  );

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
    authorize('read'),
    createRateLimiter('read'),
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
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateDeviceSchema),
    controller.update
  );

  /**
   * DELETE /api/devices/:id
   * Soft-delete a device: it disappears from every read path but the row and
   * its collected history survive for a 7-day grace period, after which the
   * retention job removes it permanently.
   *
   * Refused while the device still has a live (non-CANCELLED) contracted
   * service or any open ticket — both would be silently detached by the
   * eventual hard delete.
   *
   * Params:
   *   - id (required) Device UUID v4
   *
   * Response: 204 No Content
   * Errors:
   *   400 - id is not a valid UUID v4, or the device has a live service / open tickets
   *   404 - No device found with the given ID
   *   500 - Unexpected infrastructure error
   */
  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteDeviceSchema),
    controller.delete
  );

  /**
   * POST /api/devices/:id/restore
   * Undo a soft-delete. Monitoring stays off — coming back from a deletion is
   * not the same as being put back in service.
   *
   * Requires the `delete` permission (ADMIN only): restoring is the inverse of
   * deleting, so the same authority governs both.
   *
   * Params:
   *   - id (required) Device UUID v4
   *
   * Response: 200 OK with DeviceResponseDTO
   * Errors:
   *   400 - id is not a valid UUID v4, the device is not deleted, or the grace period expired
   *   404 - No device found with the given ID
   *   500 - Unexpected infrastructure error
   */
  router.post(
    '/:id/restore',
    authorize('delete'),
    createRateLimiter('write'),
    validateRequest(restoreDeviceSchema),
    controller.restore
  );

  /**
   * POST /api/devices/:id/replace
   * Swap this unit for physically different hardware, usually of a different
   * model. Creates a new Device linked to this one, retires this one into the
   * caller-chosen status, and carries the IP, credentials and contracted
   * service across.
   *
   * Params:
   *   - id (required) Device UUID v4 — the unit being replaced
   *
   * Body:
   *   - deviceModelId  (required) UUID of the replacement's model
   *   - retiredStatus  (required) INVENTORY | DAMAGED | DECOMMISSIONED
   *   - name           (optional) defaults to the retired unit's name
   *   - serialNumber   (optional) at least one of serialNumber / macAddress
   *   - macAddress     (optional) is required
   *   - description    (optional)
   *   - installedDate  (optional) ISO 8601; defaults to now
   *
   * Response: 201 Created with ReplaceDeviceResponseDTO
   * Errors:
   *   400 - Validation failure, or the device is deleted / already replaced
   *   404 - No device or device model found with the given ID
   *   500 - Unexpected infrastructure error
   */
  router.post(
    '/:id/replace',
    authorize('activate'),
    createRateLimiter('write'),
    validateRequest(replaceDeviceSchema),
    controller.replace
  );

  /**
   * DELETE /api/devices/:id/purge
   * Permanently remove a device that is already in the recycle bin, without
   * waiting out the grace period — the "empty the bin" action.
   *
   * Cascades: every ping result, alert, wireless snapshot, credential and
   * polling configuration belonging to the device goes with it. There is no
   * undo.
   *
   * Only reachable for a device that has already been soft-deleted, so it
   * cannot be used to skip the contracted-service and open-ticket guards on
   * DELETE /api/devices/:id.
   *
   * Params:
   *   - id (required) Device UUID v4
   *
   * Response: 204 No Content
   * Errors:
   *   400 - id is not a valid UUID v4, or the device is not in the bin
   *   404 - No device found with the given ID
   *   500 - Unexpected infrastructure error
   */
  router.delete(
    '/:id/purge',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(permanentlyDeleteDeviceSchema),
    controller.permanentlyDelete
  );

  return router;
}
