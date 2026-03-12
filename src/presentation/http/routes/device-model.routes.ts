import { Router } from 'express';
import { DeviceModelController } from '../controllers';
import { validateRequest } from '../middleware';
import {
  listDeviceModelsSchema,
  getDeviceModelByIdSchema
} from '../validation';

export function createDeviceModelRoutes(
  controller: DeviceModelController
): Router {
  const router = Router();

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

  return router;
}
