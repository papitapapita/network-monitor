import { Router } from 'express';
import { DiscoveredDeviceController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  listDiscoveredDevicesSchema,
  discoveredDeviceIdSchema
} from '../validation';

// Hosts the network shows that inventory lacks, mounted at
// /api/network/discovered (DEV-200..209). Deciding on one is the same
// permission as creating the device it suggests.
export function createDiscoveredDeviceRoutes(
  controller: DiscoveredDeviceController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listDiscoveredDevicesSchema),
    controller.list
  );

  router.get(
    '/:id/prefill',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(discoveredDeviceIdSchema),
    controller.prefill
  );

  router.post(
    '/:id/ignore',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(discoveredDeviceIdSchema),
    controller.ignore
  );

  router.delete(
    '/:id/ignore',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(discoveredDeviceIdSchema),
    controller.unignore
  );

  return router;
}
