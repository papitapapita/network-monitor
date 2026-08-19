import { Router } from 'express';
import { DeviceModelController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  listDeviceModelsSchema,
  getDeviceModelByIdSchema,
  createDeviceModelSchema,
  updateDeviceModelSchema,
  deleteDeviceModelSchema
} from '../validation';

/**
 * Creates Express router for DeviceModel endpoints.
 *
 * @param controller - DeviceModelController instance (injected by DI container)
 * @returns Express router with all device-model routes
 */
export function createDeviceModelRoutes(
  controller: DeviceModelController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createDeviceModelSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listDeviceModelsSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getDeviceModelByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateDeviceModelSchema),
    controller.update
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteDeviceModelSchema),
    controller.delete
  );

  return router;
}
