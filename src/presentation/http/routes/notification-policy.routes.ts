import { Router } from 'express';
import { NotificationPolicyController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  getDeviceNotificationPolicySchema,
  upsertDeviceNotificationPolicySchema,
  deleteDeviceNotificationPolicySchema,
  bulkUpsertDeviceNotificationPoliciesSchema
} from '../validation';

/**
 * Creates Express routes for per-device notification policy endpoints.
 * Mounted under /api/devices by the router index.
 *
 * Routes:
 * - GET    /api/devices/:id/notification-policy - Get effective policy
 * - PUT    /api/devices/:id/notification-policy - Replace policy
 * - DELETE /api/devices/:id/notification-policy - Reset to defaults
 */
export function createNotificationPolicyRoutes(
  controller: NotificationPolicyController
): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/:id/notification-policy',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getDeviceNotificationPolicySchema),
    controller.get
  );

  router.put(
    '/:id/notification-policy',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(upsertDeviceNotificationPolicySchema),
    controller.upsert
  );

  router.delete(
    '/:id/notification-policy',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(deleteDeviceNotificationPolicySchema),
    controller.delete
  );

  return router;
}

/**
 * Creates the standalone bulk-configuration route for notification
 * policies, mirroring how bulk alert actions live under their own
 * resource path rather than nested per-device.
 *
 * Routes:
 * - PUT /api/notification-policies/bulk - Replace policy for many devices
 */
export function createNotificationPolicyBulkRoutes(
  controller: NotificationPolicyController
): Router {
  const router = Router();

  router.put(
    '/bulk',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(bulkUpsertDeviceNotificationPoliciesSchema),
    controller.bulkUpsert
  );

  return router;
}
