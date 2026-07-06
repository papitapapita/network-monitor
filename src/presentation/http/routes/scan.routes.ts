import { Router } from 'express';
import { ScanController } from '../controllers';
import { validateRequest, authorize, createRateLimiter } from '../middleware';
import { scanNetworkSegmentSchema } from '../validation';

/**
 * Creates Express router for network scan endpoints.
 *
 * All routes belong to the device-inventory Bounded Context.
 * No route prefix is defined here — the caller mounts this router
 * under the appropriate path (e.g., /api/network).
 *
 * Routes:
 * - POST /  - Probe a CIDR segment and auto-register discovered hosts
 *
 * @param controller - ScanController instance (injected by DI container)
 * @returns Express router with all scan routes
 */
export function createScanRoutes(controller: ScanController): Router {
  const router = Router();

  /**
   * POST /api/network/scan
   * Probe a CIDR network segment and auto-register new hosts as inventory devices.
   *
   * Body: ScanNetworkSegmentInput
   *   - segment              (required) CIDR block, e.g. "192.168.1.0/24"
   *   - defaultDeviceModelId (required) UUID v4 of DeviceModel for new hosts
   *   - defaultOwnerType     (required) COMPANY | CLIENT
   *
   * Response: 200 OK with ScanNetworkSegmentResponseDTO
   * Errors:
   *   400 - Validation failure or invalid segment/model
   *   404 - Referenced DeviceModel does not exist
   *   500 - Unexpected infrastructure error
   */
  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(scanNetworkSegmentSchema),
    controller.scan
  );

  return router;
}
