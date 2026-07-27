import { Router } from 'express';
import { EnforcementController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import { getServiceEnforcementSchema } from '../validation';

/**
 * Creates Express routes for suspension enforcement status.
 * Mounted under /api by the router index.
 *
 * Routes:
 * - GET /api/enforcement/suspensions              - All enforced suspensions (live router query)
 * - GET /api/contracted-services/:id/enforcement  - Enforcement status for one service
 */
export function createEnforcementRoutes(
  controller: EnforcementController
): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/enforcement/suspensions',
    authorize('read'),
    createRateLimiter('read'),
    controller.listSuspensions
  );

  router.get(
    '/contracted-services/:id/enforcement',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getServiceEnforcementSchema),
    controller.getServiceEnforcement
  );

  return router;
}
