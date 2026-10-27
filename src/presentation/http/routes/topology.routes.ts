import { Router } from 'express';
import { TopologyController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import {
  acceptUpstreamSuggestionsSchema,
  getDeviceDescendantsSchema,
  listUpstreamSuggestionsSchema
} from '../validation';

/**
 * Network topology — mounted under /api/topology
 *
 * GET /api/topology                        — every device on the network and its upstream link
 * GET /api/topology/:deviceId/descendants  — one device and everything below it
 * GET /api/topology/suggestions            — upstream links the network suggests
 * POST /api/topology/suggestions/accept    — make the chosen links
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
    '/suggestions',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listUpstreamSuggestionsSchema),
    controller.listSuggestions
  );
  router.post(
    '/suggestions/accept',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(acceptUpstreamSuggestionsSchema),
    controller.acceptSuggestions
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
