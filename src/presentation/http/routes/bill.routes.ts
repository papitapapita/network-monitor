import { Router } from 'express';
import { BillController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  generateBillSchema,
  generateBillsForPeriodSchema,
  listBillsSchema,
  getBillByIdSchema,
  billIdParamSchema
} from '../validation';

export function createBillRoutes(controller: BillController): Router {
  const router = Router();

  router.post(
    '/generate',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(generateBillSchema),
    controller.generate
  );

  router.post(
    '/generate-bulk',
    authorize('create'),
    createRateLimiter('bulk-import'),
    validateRequest(generateBillsForPeriodSchema),
    controller.generateBulk
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listBillsSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getBillByIdSchema),
    controller.getById
  );

  router.post(
    '/:id/pay',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(billIdParamSchema),
    controller.markPaid
  );

  router.post(
    '/:id/overdue',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(billIdParamSchema),
    controller.markOverdue
  );

  router.post(
    '/:id/cancel',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(billIdParamSchema),
    controller.cancel
  );

  return router;
}
