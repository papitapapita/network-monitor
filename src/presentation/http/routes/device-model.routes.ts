import { Router } from 'express';
import { DeviceModelController } from '../controllers';
import { validateRequest } from '../middleware';
import {
  listDeviceModelsSchema,
  getDeviceModelByIdSchema,
  createDeviceModelSchema,
  updateDeviceModelSchema,
  deleteDeviceModelSchema
} from '../validation';

export function createDeviceModelRoutes(
  controller: DeviceModelController
): Router {
  const router = Router();

  router.post(
    '/',
    validateRequest(createDeviceModelSchema),
    controller.create
  );

  router.get(
    '/',
    validateRequest(listDeviceModelsSchema),
    controller.list
  );

  router.get(
    '/:id',
    validateRequest(getDeviceModelByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    validateRequest(updateDeviceModelSchema),
    controller.update
  );

  router.delete(
    '/:id',
    validateRequest(deleteDeviceModelSchema),
    controller.delete
  );

  return router;
}
