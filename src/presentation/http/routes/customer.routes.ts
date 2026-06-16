import { Router } from 'express';
import { CustomerController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createCustomerSchema,
  updateCustomerSchema,
  getCustomerByIdSchema,
  deleteCustomerSchema,
  listCustomersSchema
} from '../validation';

export function createCustomerRoutes(
  controller: CustomerController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createCustomerSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listCustomersSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getCustomerByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateCustomerSchema),
    controller.update
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteCustomerSchema),
    controller.delete
  );

  return router;
}
