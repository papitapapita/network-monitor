import { Router } from 'express';
import { BillingSettingsController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import { updateBillingSettingsSchema } from '../validation';

// The install's billing cycle, mounted at /api/billing-settings. Everyone
// reads it; the ISP's administrator changes it (BIL-285).
export function createBillingSettingsRoutes(
  controller: BillingSettingsController
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
    validateRequest(updateBillingSettingsSchema),
    controller.update
  );

  return router;
}
