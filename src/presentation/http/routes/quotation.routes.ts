import { Router } from 'express';
import { QuotationController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createQuotationSchema,
  quotationIdParamSchema,
  updateQuotationLineItemsSchema,
  updateQuotationDetailsSchema,
  rejectQuotationSchema,
  listQuotationsSchema
} from '../validation';

export function createQuotationRoutes(
  controller: QuotationController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createQuotationSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listQuotationsSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(quotationIdParamSchema),
    controller.getById
  );

  router.get(
    '/:id/pdf',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(quotationIdParamSchema),
    controller.getPdf
  );

  router.patch(
    '/:id/line-items',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateQuotationLineItemsSchema),
    controller.updateLineItems
  );

  router.patch(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateQuotationDetailsSchema),
    controller.updateDetails
  );

  router.post(
    '/:id/send',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(quotationIdParamSchema),
    controller.send
  );

  router.post(
    '/:id/accept',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(quotationIdParamSchema),
    controller.accept
  );

  router.post(
    '/:id/reject',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(rejectQuotationSchema),
    controller.reject
  );

  router.post(
    '/:id/expire',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(quotationIdParamSchema),
    controller.markExpired
  );

  return router;
}
