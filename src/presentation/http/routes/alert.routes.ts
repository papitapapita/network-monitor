import { Router } from 'express';
import { AlertController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  listAlertsSchema,
  getAlertByIdSchema,
  deleteAlertSchema,
  clearAlertSchema,
  bulkClearAlertsSchema,
  bulkDeleteAlertsSchema
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

  // Static /clear before the dynamic /:id/clear segment
  router.post(
    '/clear',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(bulkClearAlertsSchema),
    controller.bulkClearAlerts
  );

  router.delete(
    '/',
    authorize('delete'),
    createRateLimiter('write'),
    validateRequest(bulkDeleteAlertsSchema),
    controller.bulkDeleteAlerts
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getAlertByIdSchema),
    controller.getAlertById
  );

  router.post(
    '/:id/clear',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(clearAlertSchema),
    controller.clearAlert
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
