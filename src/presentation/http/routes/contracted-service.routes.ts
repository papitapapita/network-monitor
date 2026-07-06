import { Router } from 'express';
import { ContractedServiceController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createContractedServiceSchema,
  updateContractedServiceSchema,
  getContractedServiceByIdSchema,
  deleteContractedServiceSchema,
  listContractedServicesSchema
} from '../validation';

export function createContractedServiceRoutes(
  controller: ContractedServiceController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createContractedServiceSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listContractedServicesSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getContractedServiceByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateContractedServiceSchema),
    controller.update
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteContractedServiceSchema),
    controller.delete
  );

  return router;
}
