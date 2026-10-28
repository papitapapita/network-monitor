import { Router } from 'express';
import { PortSpeedController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import {
  acceptCurrentPortSpeedsSchema,
  getRouterPortSpeedsSchema,
  setPortExpectedSpeedSchema
} from '../validation';

/**
 * MikroTik port speeds — mounted at /api/routers
 *
 * GET  /api/routers/port-speeds                       — every MikroTik, its
 *                                                       ports read live
 * GET  /api/routers/:id/port-speeds                   — one MikroTik's ports
 *                                                       read now
 * PUT  /api/routers/:id/port-speeds/expected          — set or clear the speed
 *                                                       one port should link
 *                                                       at, and whether no
 *                                                       link alerts
 * POST /api/routers/:id/port-speeds/accept-current    — the linked ports' rates
 *                                                       become their expected
 *                                                       speeds
 */
export function createPortSpeedRoutes(
  controller: PortSpeedController
): Router {
  const router = Router();

  router.get(
    '/port-speeds',
    authorize('read'),
    createRateLimiter('read'),
    controller.list
  );
  router.get(
    '/:id/port-speeds',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getRouterPortSpeedsSchema),
    controller.get
  );
  router.put(
    '/:id/port-speeds/expected',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(setPortExpectedSpeedSchema),
    controller.setExpected
  );
  router.post(
    '/:id/port-speeds/accept-current',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(acceptCurrentPortSpeedsSchema),
    controller.acceptCurrent
  );

  return router;
}
