import { Router } from 'express';
import { CollectionAccountController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createCollectionAccountSchema,
  collectionAccountIdParamSchema,
  listCollectionAccountsSchema
} from '../validation';

export function createCollectionAccountRoutes(
  controller: CollectionAccountController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createCollectionAccountSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listCollectionAccountsSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(collectionAccountIdParamSchema),
    controller.getById
  );

  router.get(
    '/:id/pdf',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(collectionAccountIdParamSchema),
    controller.getPdf
  );

  router.post(
    '/:id/pay',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(collectionAccountIdParamSchema),
    controller.markPaid
  );

  router.post(
    '/:id/cancel',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(collectionAccountIdParamSchema),
    controller.cancel
  );

  return router;
}
