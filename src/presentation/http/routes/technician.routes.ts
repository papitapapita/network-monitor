import { Router } from 'express';
import { TechnicianController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createTechnicianSchema,
  listTechniciansSchema,
  getTechnicianByIdSchema,
  updateTechnicianSchema,
  deleteTechnicianSchema
} from '../validation';

/**
 * Creates Express router for Technician endpoints.
 *
 * @param controller - TechnicianController instance (injected by DI container)
 * @returns Express router with all technician routes
 */
export function createTechnicianRoutes(
  controller: TechnicianController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createTechnicianSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listTechniciansSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getTechnicianByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateTechnicianSchema),
    controller.update
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteTechnicianSchema),
    controller.delete
  );

  return router;
}
