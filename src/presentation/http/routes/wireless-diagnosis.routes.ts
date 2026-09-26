import { Router } from 'express';
import { LinkDiagnosisController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  startLinkDiagnosisSchema,
  getLinkDiagnosisSchema,
  stopLinkDiagnosisSchema
} from '../validation';

/**
 * Live link diagnosis of a wireless device. Mounted under /api.
 * The frames themselves stream from wireless-stream.routes.ts.
 *
 * Routes:
 * - POST   /api/devices/:id/wireless/diagnosis - Start (or join) a diagnosis
 * - GET    /api/devices/:id/wireless/diagnosis - Running or recently finished diagnosis
 * - DELETE /api/devices/:id/wireless/diagnosis - Stop a running diagnosis
 */
export function createWirelessDiagnosisRoutes(
  controller: LinkDiagnosisController
): Router {
  const router = Router({ mergeParams: true });

  // same permission as a manual poll — both make the server reach the radio
  router.post(
    '/devices/:id/wireless/diagnosis',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(startLinkDiagnosisSchema),
    controller.start
  );

  router.get(
    '/devices/:id/wireless/diagnosis',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getLinkDiagnosisSchema),
    controller.get
  );

  router.delete(
    '/devices/:id/wireless/diagnosis',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(stopLinkDiagnosisSchema),
    controller.stop
  );

  return router;
}
