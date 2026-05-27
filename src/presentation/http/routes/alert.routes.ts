import { Router } from 'express';
import { AlertController } from '../controllers';
import { validateRequest } from '../middleware';
import { listAlertsSchema } from '../validation';

export function createAlertRoutes(
  controller: AlertController
): Router {
  const router = Router();

  // GET /api/alerts
  // GET /api/alerts?deviceId=uuid
  // GET /api/alerts?deviceId=uuid&limit=20&offset=0
  router.get(
    '/',
    validateRequest(listAlertsSchema),
    controller.listAlerts
  );

  return router;
}
