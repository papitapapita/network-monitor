import { Router } from 'express';
import { VendorSettingsController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import { updateVendorSettingsSchema } from '../validation';

// The vendor's settings for this install, mounted at
// /api/installation/settings. VENDOR only, reads included (INS-030).
export function createVendorSettingsRoutes(
  controller: VendorSettingsController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('manage-installation'),
    createRateLimiter('read'),
    controller.get
  );

  router.put(
    '/',
    authorize('manage-installation'),
    createRateLimiter('write'),
    validateRequest(updateVendorSettingsSchema),
    controller.update
  );

  return router;
}
