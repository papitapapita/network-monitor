import { Router } from 'express';
import { BankAccountController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createBankAccountSchema,
  updateBankAccountSchema,
  bankAccountIdParamSchema
} from '../validation';

export function createBankAccountRoutes(
  controller: BankAccountController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createBankAccountSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(bankAccountIdParamSchema),
    controller.getById
  );

  router.patch(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateBankAccountSchema),
    controller.update
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('write'),
    validateRequest(bankAccountIdParamSchema),
    controller.delete
  );

  return router;
}
