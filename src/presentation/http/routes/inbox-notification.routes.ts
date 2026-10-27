import { Router } from 'express';
import { InboxNotificationController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  listInboxNotificationsSchema,
  markInboxNotificationReadSchema
} from '../validation';

// The in-app inbox, mounted at /api/notifications. Every signed-in user has
// one and reaches only their own (NOT-260).
export function createInboxNotificationRoutes(
  controller: InboxNotificationController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listInboxNotificationsSchema),
    controller.list
  );

  router.get(
    '/unread-count',
    authorize('read'),
    createRateLimiter('read'),
    controller.unreadCount
  );

  router.post(
    '/read-all',
    authorize('read'),
    createRateLimiter('write'),
    controller.markAllRead
  );

  router.post(
    '/:id/read',
    authorize('read'),
    createRateLimiter('write'),
    validateRequest(markInboxNotificationReadSchema),
    controller.markRead
  );

  return router;
}
