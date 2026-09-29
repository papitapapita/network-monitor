import { Router } from 'express';
import { SubscriptionController } from '../controllers';
import { authorize, createRateLimiter } from '../middleware';

// Every role reads it: the "expired subscription" notice is for whoever is
// looking at the dashboard (ADR 0002, R17).
export function createSubscriptionRoutes(
  controller: SubscriptionController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    controller.getStatus
  );

  return router;
}
