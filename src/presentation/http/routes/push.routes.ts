import { Router } from 'express';
import { PushController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  subscribePushSchema,
  unsubscribePushSchema
} from '../validation';

// Phone notifications, mounted at /api/push. Any signed-in user may turn
// them on for their own phones (NOT-225).
export function createPushRoutes(controller: PushController): Router {
  const router = Router();

  router.get(
    '/public-key',
    authorize('read'),
    createRateLimiter('read'),
    controller.getPublicKey
  );

  router.post(
    '/subscriptions',
    authorize('read'),
    createRateLimiter('write'),
    validateRequest(subscribePushSchema),
    controller.subscribe
  );

  router.delete(
    '/subscriptions',
    authorize('read'),
    createRateLimiter('write'),
    validateRequest(unsubscribePushSchema),
    controller.unsubscribe
  );

  router.post(
    '/test',
    authorize('read'),
    createRateLimiter('write'),
    controller.sendTest
  );

  return router;
}
