import { Router } from 'express';
import { CredentialsController } from '../controllers';

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

  // TODO: router.use(requireAuth); — add JWT/session auth middleware here

  router.put('/:id/credentials', controller.set);
  router.get('/:id/credentials', controller.get);
  router.delete('/:id/credentials', controller.delete);

  return router;
}
