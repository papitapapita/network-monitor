import { Router } from 'express';
import { NotificationMuteController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import { replaceMutedAlertTypesSchema } from '../validation';

/**
 * Creates Express routes for the global muted-alert-type list. Mounted at
 * /api/notification-mutes by the router index.
 *
 * Routes:
 * - GET /api/notification-mutes - List muted alert types
 * - PUT /api/notification-mutes - Replace the muted alert type list
 */
export function createNotificationMuteRoutes(
  controller: NotificationMuteController
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
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(replaceMutedAlertTypesSchema),
    controller.replace
  );

  return router;
}
