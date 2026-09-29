import { Router } from 'express';
import { AgentController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import { createAgentSchema, agentIdParamSchema } from '../validation';

// Issuing a pairing key or revoking an agent grants or removes network
// access to a customer's site, so writes sit on the credential tier.
export function createAgentRoutes(
  controller: AgentController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('manage-credentials'),
    createRateLimiter('write'),
    validateRequest(createAgentSchema),
    controller.create
  );

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    controller.list
  );

  router.get(
    '/:id',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(agentIdParamSchema),
    controller.getById
  );

  router.post(
    '/:id/pairing-key',
    authorize('manage-credentials'),
    createRateLimiter('write'),
    validateRequest(agentIdParamSchema),
    controller.reissuePairingKey
  );

  router.post(
    '/:id/revoke',
    authorize('manage-credentials'),
    createRateLimiter('write'),
    validateRequest(agentIdParamSchema),
    controller.revoke
  );

  return router;
}
