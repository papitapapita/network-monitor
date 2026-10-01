import { Router } from 'express';
import { AgentUpdateController } from '../controllers';
import { validateRequest } from '../middleware';
import { agentReleaseFileSchema } from '../validation';

// Outside /api: an agent downloads the release it was offered (AGT-083),
// authenticated by its own token.
export function createAgentUpdateRoutes(
  controller: AgentUpdateController
): Router {
  const router = Router();

  router.get(
    '/updates/:fileName',
    controller.requireAgent,
    validateRequest(agentReleaseFileSchema),
    controller.download
  );

  return router;
}
