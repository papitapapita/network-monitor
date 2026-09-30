import { Router } from 'express';
import { AgentController } from '../controllers';
import {
  validateRequest,
  authorize,
  createRateLimiter
} from '../middleware';
import {
  createAgentSchema,
  agentIdParamSchema,
  listAgentOutagesSchema
} from '../validation';

// Issuing a pairing key or revoking an agent grants or removes network
// access to a customer's site. That is the vendor's job, not the customer's:
// the customer reads its agents and nothing more.
export function createAgentRoutes(
  controller: AgentController
): Router {
  const router = Router();

  router.post(
    '/',
    authorize('manage-installation'),
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

  router.get(
    '/:id/outages',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listAgentOutagesSchema),
    controller.listOutages
  );

  router.post(
    '/:id/pairing-key',
    authorize('manage-installation'),
    createRateLimiter('write'),
    validateRequest(agentIdParamSchema),
    controller.reissuePairingKey
  );

  router.post(
    '/:id/revoke',
    authorize('manage-installation'),
    createRateLimiter('write'),
    validateRequest(agentIdParamSchema),
    controller.revoke
  );

  return router;
}
