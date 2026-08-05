import { Router } from 'express';
import { TicketController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createTicketSchema,
  listTicketsSchema,
  technicianDaySchema,
  getTicketByIdSchema,
  updateTicketSchema,
  deleteTicketSchema,
  assignTicketSchema,
  scheduleTicketSchema,
  startTicketSchema,
  resolveTicketSchema,
  cancelTicketSchema
} from '../validation';

/**
 * Creates Express router for Ticket endpoints.
 *
 * @param controller - TicketController instance (injected by DI container)
 * @returns Express router with all ticket routes
 */
export function createTicketRoutes(
  controller: TicketController
): Router {
  const router = Router();

  // Custom query routes must precede /:id or "my-day" is read as a ticket id.
  router.get(
    '/my-day',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(technicianDaySchema),
    controller.myDay
  );

  router.post(
    '/',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createTicketSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listTicketsSchema),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getTicketByIdSchema),
    controller.getById
  );

  router.put(
    '/:id',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateTicketSchema),
    controller.update
  );

  router.delete(
    '/:id',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteTicketSchema),
    controller.delete
  );

  // Action routes follow the standard CRUD set.
  router.post(
    '/:id/assign',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(assignTicketSchema),
    controller.assign
  );

  router.post(
    '/:id/schedule',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(scheduleTicketSchema),
    controller.schedule
  );

  router.post(
    '/:id/start',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(startTicketSchema),
    controller.start
  );

  router.post(
    '/:id/resolve',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(resolveTicketSchema),
    controller.resolve
  );

  router.post(
    '/:id/cancel',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(cancelTicketSchema),
    controller.cancel
  );

  return router;
}
