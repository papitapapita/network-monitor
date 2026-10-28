import { Router } from 'express';
import { DiscoverySettingsController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import { updateDiscoverySettingsSchema } from '../validation';

// The install's scheduled network scan, mounted at
// /api/network/discovery-settings. Everyone reads it; the ISP's
// administrator changes it (DEV-213).
export function createDiscoverySettingsRoutes(
  controller: DiscoverySettingsController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    controller.get
  );

  router.put(
    '/',
    authorize('manage-settings'),
    createRateLimiter('write'),
    validateRequest(updateDiscoverySettingsSchema),
    controller.update
  );

  return router;
}
