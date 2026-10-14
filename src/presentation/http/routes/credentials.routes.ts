import { RequestHandler, Router } from 'express';
import { CredentialsController } from '../controllers';
import { authorize, createRateLimiter } from '../middleware';

/**
 * Device credentials routes — mounted under /api/devices
 *
 * PUT    /api/devices/:id/credentials   — create or replace credentials
 * GET    /api/devices/:id/credentials   — retrieve credentials (masked)
 * POST   /api/devices/:id/credentials/reveal — retrieve them in plaintext
 * DELETE /api/devices/:id/credentials   — remove credentials
 *
 * Writes carry device passwords and SNMP keys, so they sit behind their own
 * `manage-credentials` permission rather than the generic `update` that renames
 * a device. Reads stay on `read` — the response is masked. The plaintext
 * reveal needs `reveal-credentials` and the password typed again within five
 * minutes (DEV-134, IDN-086).
 */
export function createCredentialsRoutes(
  controller: CredentialsController,
  requireCredentialReveal: RequestHandler
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
  router.post(
    '/:id/credentials/reveal',
    authorize('reveal-credentials'),
    createRateLimiter('write'),
    requireCredentialReveal,
    controller.reveal
  );
  router.delete(
    '/:id/credentials',
    authorize('manage-credentials'),
    createRateLimiter('delete'),
    controller.delete
  );

  return router;
}
