import { Router } from 'express';
import { AlertController } from '../controllers';
import { validateRequest, authorize, createRateLimiter } from '../middleware';
import {
  listAlertsSchema,
  getAlertByIdSchema,
  deleteAlertSchema
} from '../validation';

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

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getAlertByIdSchema),
    controller.getAlertById
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('write'),
    validateRequest(deleteAlertSchema),
    controller.deleteAlert
  );

  return router;
}
