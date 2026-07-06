import { Router } from 'express';
import { CredentialsController } from '../controllers';
import { authorize, createRateLimiter } from '../middleware';

/**
 * Device credentials routes — mounted under /api/devices
 *
 * PUT    /api/devices/:id/credentials   — create or replace credentials
 * GET    /api/devices/:id/credentials   — retrieve credentials (masked)
 * DELETE /api/devices/:id/credentials   — remove credentials
 *
 * Security note: These endpoints manage device network passwords and SNMP keys.
 * Add authentication middleware here (e.g. router.use(requireAuth)) before
 * deploying to a shared environment.
 */
export function createCredentialsRoutes(
  controller: CredentialsController
): Router {
  const router = Router({ mergeParams: true });

  router.put('/:id/credentials', authorize('update'), createRateLimiter('write'), controller.set);
  router.get('/:id/credentials', authorize('read'), createRateLimiter('read'), controller.get);
  router.delete('/:id/credentials', authorize('delete'), createRateLimiter('delete'), controller.delete);

  return router;
}
