import { Router } from 'express';
import { AlertController } from '../controllers';
import { validateRequest, authorize, createRateLimiter } from '../middleware';
import { listAlertsSchema } from '../validation';

export function createAlertRoutes(
  controller: AlertController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listAlertsSchema),
    controller.listAlerts
  );

  return router;
}
