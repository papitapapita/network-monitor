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
 * Writes carry device passwords and SNMP keys, so they sit behind their own
 * `manage-credentials` permission rather than the generic `update` that renames
 * a device. Reads stay on `read` — the response is masked.
 */
export function createCredentialsRoutes(
  controller: CredentialsController
): Router {
  const router = Router({ mergeParams: true });

  router.put(
    '/:id/credentials',
    authorize('manage-credentials'),
    createRateLimiter('write'),
    controller.set
  );
  router.get(
    '/:id/credentials',
    authorize('read'),
    createRateLimiter('read'),
    controller.get
  );
  router.delete(
    '/:id/credentials',
    authorize('manage-credentials'),
    createRateLimiter('delete'),
    controller.delete
  );

  return router;
}
