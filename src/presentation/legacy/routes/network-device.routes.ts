import { Router } from 'express';
import { NetworkDeviceController } from '../controllers/NetworkDeviceController';
import { validateRequest } from '../middleware/validateRequest';
import { createNetworkDeviceSchema } from '../validation/network-device.schemas';
// TODO: Uncomment as use cases are implemented
// import {
//   updateNetworkDeviceSchema,
//   listNetworkDevicesSchema,
//   getNetworkDeviceByIdSchema,
//   getNetworkDeviceByIpSchema,
//   deleteNetworkDeviceSchema,
//   activateNetworkDeviceSchema,
//   softDeleteNetworkDeviceSchema,
//   restoreNetworkDeviceSchema
// } from '../validation/network-device.schemas';

/**
 * Creates Express router for NetworkDevice endpoints.
 *
 * @param controller - NetworkDeviceController instance
 * @returns Express router with all network device routes
 *
 * Routes:
 * - POST   /                     - Create device (DRAFT or ACTIVE)
 * - GET    /                     - List devices (with pagination/filters)
 * - GET    /by-ip                - Get device by IP
 * - GET    /:id                  - Get device by ID
 * - PUT    /:id                  - Update device
 * - DELETE /:id                  - Hard delete device
 *
 * REQ-002 Lifecycle Routes:
 * - POST   /:id/activate         - Activate DRAFT device
 * - DELETE /:id/soft             - Soft delete device
 * - POST   /:id/restore          - Restore soft-deleted device
 *
 * @example
 * ```typescript
 * const controller = new NetworkDeviceController(...);
 * const router = createNetworkDeviceRoutes(controller);
 * app.use('/api/network-devices', router);
 * ```
 */
export function createNetworkDeviceRoutes(
  controller: NetworkDeviceController
): Router {
  const router = Router();

  // =====================================
  // STANDARD CRUD ENDPOINTS
  // =====================================

  /**
   * POST /api/network-devices
   * Create a new network device
   *
   * Body: CreateNetworkDeviceDTO
   * Response: 201 Created with NetworkDeviceResponseDTO
   * Errors: 400 (validation), 409 (duplicate IP/MAC)
   */
  router.post(
    '/',
    validateRequest(createNetworkDeviceSchema),
    controller.create
  );

  // TODO: Uncomment as use cases are implemented
  // /**
  //  * GET /api/network-devices
  //  * List network devices with pagination and filters
  //  *
  //  * Query params:
  //  * - limit (optional): Max results (default: 20, max: 100)
  //  * - offset (optional): Pagination offset (default: 0)
  //  * - status (optional): Filter by status
  //  * - deviceType (optional): Filter by device type
  //  * - activationStatus (optional): Filter by activation status
  //  *
  //  * Response: 200 OK with NetworkDeviceListResponseDTO
  //  * Errors: 400 (invalid query params)
  //  */
  // router.get('/', validateRequest(listNetworkDevicesSchema), controller.list);

  // =====================================
  // CUSTOM QUERY ENDPOINTS (before :id)
  // =====================================

  // /**
  //  * GET /api/network-devices/by-ip?ip=192.168.1.1
  //  * Get a network device by IP address
  //  *
  //  * Query params:
  //  * - ip (required): IP address to search for
  //  *
  //  * Response: 200 OK with NetworkDeviceResponseDTO
  //  * Errors: 400 (invalid IP), 404 (not found)
  //  */
  // router.get('/by-ip', validateRequest(getNetworkDeviceByIpSchema), controller.getByIp);

  // =====================================
  // STANDARD CRUD WITH :id
  // =====================================

  // /**
  //  * GET /api/network-devices/:id
  //  * Get a network device by ID
  //  *
  //  * Params:
  //  * - id (required): Device UUID
  //  *
  //  * Response: 200 OK with NetworkDeviceResponseDTO
  //  * Errors: 400 (invalid UUID), 404 (not found)
  //  */
  // router.get('/:id', validateRequest(getNetworkDeviceByIdSchema), controller.getById);

  // /**
  //  * PUT /api/network-devices/:id
  //  * Update a network device
  //  *
  //  * Params:
  //  * - id (required): Device UUID
  //  *
  //  * Body: UpdateNetworkDeviceDTO (at least one field required)
  //  *
  //  * Response: 200 OK with NetworkDeviceResponseDTO
  //  * Errors: 400 (validation), 404 (not found), 409 (conflict)
  //  */
  // router.put('/:id', validateRequest(updateNetworkDeviceSchema), controller.update);

  // /**
  //  * DELETE /api/network-devices/:id
  //  * Hard delete a network device permanently
  //  *
  //  * Params:
  //  * - id (required): Device UUID
  //  *
  //  * Response: 204 No Content
  //  * Errors: 404 (not found)
  //  */
  // router.delete('/:id', validateRequest(deleteNetworkDeviceSchema), controller.delete);

  // =====================================
  // CUSTOM ACTION ENDPOINTS (REQ-002)
  // =====================================

  // /**
  //  * POST /api/network-devices/:id/activate
  //  * Activate a DRAFT device to ACTIVE status
  //  *
  //  * Params:
  //  * - id (required): Device UUID to activate
  //  *
  //  * Body: ActivateNetworkDeviceRequestDTO
  //  *
  //  * Response: 200 OK with NetworkDeviceResponseDTO
  //  * Errors: 404 (not found), 422 (already active or soft-deleted)
  //  */
  // router.post('/:id/activate', validateRequest(activateNetworkDeviceSchema), controller.activate);

  // /**
  //  * DELETE /api/network-devices/:id/soft
  //  * Soft-delete a network device with 7-day grace period
  //  *
  //  * Params:
  //  * - id (required): Device UUID to soft-delete
  //  *
  //  * Body: SoftDeleteNetworkDeviceRequestDTO (optional)
  //  *
  //  * Response: 200 OK with NetworkDeviceResponseDTO
  //  * Errors: 404 (not found), 422 (already soft-deleted)
  //  */
  // router.delete('/:id/soft', validateRequest(softDeleteNetworkDeviceSchema), controller.softDelete);

  // /**
  //  * POST /api/network-devices/:id/restore
  //  * Restore a soft-deleted device within the 7-day grace period
  //  *
  //  * Params:
  //  * - id (required): Device UUID to restore
  //  *
  //  * Response: 200 OK with NetworkDeviceResponseDTO
  //  * Errors: 404 (not found), 409 (conflict), 410 (expired), 422 (not soft-deleted)
  //  */
  // router.post('/:id/restore', validateRequest(restoreNetworkDeviceSchema), controller.restore);

  return router;
}
