import { Router } from 'express';
import { VendorController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createVendorSchema,
  updateVendorSchema,
  getVendorByIdSchema,
  deleteVendorSchema,
  listVendorsSchema
} from '../validation';

/**
 * Creates Express router for Vendor endpoints.
 *
 * @param controller - VendorController instance (injected by DI container)
 * @returns Express router with all vendor routes
 */
export function createVendorRoutes(
  controller: VendorController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createVendorSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listVendorsSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getVendorByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateVendorSchema),
    controller.update
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteVendorSchema),
    controller.delete
  );

  return router;
}
