import { Router } from 'express';
import { AlertThresholdsController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  updateAlertThresholdsSchema,
  getDeviceAlertThresholdsSchema,
  updateDeviceAlertThresholdsSchema
} from '../validation';

// Wireless alert thresholds, mounted under /api. The install's set is
// changed by its administrator; a device's overrides by anyone who can
// edit the device's wireless config (WLS-202).
export function createAlertThresholdRoutes(
  controller: AlertThresholdsController
): Router {
  const router = Router();

  router.get(
    '/wireless/alert-thresholds',
    authorize('read'),
    createRateLimiter('read'),
    controller.get
  );

  router.put(
    '/wireless/alert-thresholds',
    authorize('manage-settings'),
    createRateLimiter('write'),
    validateRequest(updateAlertThresholdsSchema),
    controller.update
  );

  router.get(
    '/devices/:id/wireless/alert-thresholds',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getDeviceAlertThresholdsSchema),
    controller.getForDevice
  );

  router.put(
    '/devices/:id/wireless/alert-thresholds',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateDeviceAlertThresholdsSchema),
    controller.updateForDevice
  );

  return router;
}
