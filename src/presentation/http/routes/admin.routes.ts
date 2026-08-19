import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { authorize, createRateLimiter } from '../middleware';

export function createAdminRoutes(
  controller: AdminController
): Router {
  const router = Router();

  router.post(
    '/data-retention/purge',
    authorize('delete'),
    createRateLimiter('delete'),
    controller.purgeStaleData
  );

  return router;
}
