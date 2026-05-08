import { Router } from 'express';
import { VendorController } from '../controllers';
import { validateRequest } from '../middleware';
import {
  createVendorSchema,
  updateVendorSchema,
  getVendorByIdSchema,
  deleteVendorSchema,
  listVendorsSchema
} from '../validation';

export function createVendorRoutes(controller: VendorController): Router {
  const router = Router();

  router.post('/', validateRequest(createVendorSchema), controller.create);

  router.get('/', validateRequest(listVendorsSchema), controller.list);

  router.get(
    '/:id',
    validateRequest(getVendorByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    validateRequest(updateVendorSchema),
    controller.update
  );

  router.delete(
    '/:id',
    validateRequest(deleteVendorSchema),
    controller.delete
  );

  return router;
}
