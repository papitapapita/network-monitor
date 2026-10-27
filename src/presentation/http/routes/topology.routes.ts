import { Router } from 'express';
import { TopologyController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import { getDeviceDescendantsSchema } from '../validation';

/**
 * Network topology — mounted under /api/topology
 *
 * GET /api/topology                        — every device on the network and its upstream link
 * GET /api/topology/:deviceId/descendants  — one device and everything below it
 */
export function createTopologyRoutes(
  controller: TopologyController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    controller.getTopology
  );
  router.get(
    '/:deviceId/descendants',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getDeviceDescendantsSchema),
    controller.getDescendants
  );

  return router;
}
