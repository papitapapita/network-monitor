import { RequestHandler, Router } from 'express';
import { RadioSettingsController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import {
  renameRadioSchema,
  revealWirelessKeySchema
} from '../validation';

/**
 * A radio's own settings, read from and written to the radio itself —
 * mounted under /api/devices
 *
 * POST /api/devices/:id/wireless/key/reveal — its Wi-Fi key in plaintext
 * PUT  /api/devices/:id/wireless/hostname   — the name it gives itself
 *
 * The key is a secret like the device's passwords, so it needs
 * `reveal-credentials` and the password typed again within five minutes
 * (WLS-220, IDN-086). Renaming is an `update`, like a reboot (WLS-224).
 */
export function createRadioSettingsRoutes(
  controller: RadioSettingsController,
  requireCredentialReveal: RequestHandler
): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/:id/wireless/key/reveal',
    authorize('reveal-credentials'),
    createRateLimiter('write'),
    validateRequest(revealWirelessKeySchema),
    requireCredentialReveal,
    controller.revealKey
  );
  router.put(
    '/:id/wireless/hostname',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(renameRadioSchema),
    controller.rename
  );

  return router;
}
