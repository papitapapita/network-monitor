import { Router } from 'express';
import { NotificationSettingsController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  updateNotificationSettingsSchema,
  sendTestNotificationSchema
} from '../validation';

// The install's notification settings, mounted at
// /api/notification-settings. Everyone reads them; the customer's
// administrator changes them (NOT-204).
export function createNotificationSettingsRoutes(
  controller: NotificationSettingsController
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
    validateRequest(updateNotificationSettingsSchema),
    controller.update
  );

  router.post(
    '/test',
    authorize('manage-settings'),
    createRateLimiter('write'),
    validateRequest(sendTestNotificationSchema),
    controller.sendTest
  );

  return router;
}
