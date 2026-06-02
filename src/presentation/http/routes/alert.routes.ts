import { Router } from 'express';
import { AlertController } from '../controllers';
import { validateRequest } from '../middleware';
import { listAlertsSchema } from '../validation';

export function createAlertRoutes(
  controller: AlertController
): Router {
  const router = Router();

  router.get(
    '/',
    validateRequest(listAlertsSchema),
    controller.listAlerts
  );

  return router;
}
