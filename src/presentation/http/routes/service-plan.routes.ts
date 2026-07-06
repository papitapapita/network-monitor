import { Router } from 'express';
import { ServicePlanController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createServicePlanSchema,
  updateServicePlanSchema,
  getServicePlanByIdSchema,
  deleteServicePlanSchema,
  listServicePlansSchema
} from '../validation';

export function createServicePlanRoutes(
  controller: ServicePlanController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createServicePlanSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listServicePlansSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getServicePlanByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateServicePlanSchema),
    controller.update
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteServicePlanSchema),
    controller.delete
  );

  return router;
}
