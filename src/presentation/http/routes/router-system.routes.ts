import { Router } from 'express';
import { RouterSystemController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import { getRouterSystemSchema } from '../validation';

/**
 * MikroTik system details — mounted at /api/routers
 *
 * GET /api/routers/system      — every MikroTik and what it last said about
 *                                itself (identity, hardware, versions,
 *                                health)
 * GET /api/routers/:id/system  — one MikroTik read now
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

  return router;
}
