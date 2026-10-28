import { Router } from 'express';
import { RouterSystemController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import {
  getRouterSystemSchema,
  updateRouterHealthThresholdsSchema
} from '../validation';

/**
 * MikroTik system details — mounted at /api/routers
 *
 * GET /api/routers/system      — every MikroTik and what it last said about
 *                                itself (identity, hardware, versions,
 *                                health)
 * GET /api/routers/:id/system  — one MikroTik read now
 * GET /api/routers/health-thresholds — the limits health is judged against
 * PUT /api/routers/health-thresholds — change them (administrator)
 * GET /api/routers/audit       — versions and what is worth fixing on each
 *                                MikroTik, oldest RouterOS first
 */
export function createRouterSystemRoutes(
  controller: RouterSystemController
): Router {
  const router = Router();

  router.get(
    '/system',
    authorize('read'),
    createRateLimiter('read'),
    controller.list
  );
  router.get(
    '/:id/system',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getRouterSystemSchema),
    controller.get
  );
  router.get(
    '/health-thresholds',
    authorize('read'),
    createRateLimiter('read'),
    controller.getHealthThresholds
  );
  router.put(
    '/health-thresholds',
    authorize('manage-settings'),
    createRateLimiter('write'),
    validateRequest(updateRouterHealthThresholdsSchema),
    controller.updateHealthThresholds
  );
  router.get(
    '/audit',
    authorize('read'),
    createRateLimiter('read'),
    controller.audit
  );

  return router;
}
