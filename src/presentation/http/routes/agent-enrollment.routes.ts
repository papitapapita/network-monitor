import { Router } from 'express';
import { AgentEnrollmentController } from '../controllers';
import { validateRequest, createRateLimiter } from '../middleware';
import { enrollAgentSchema } from '../validation';

// Outside /api: the installer has no JWT, the one-time pairing code is the
// credential. The tight per-IP limit is what keeps codes unguessable in
// practice on top of their 256 bits.
export function createAgentEnrollmentRoutes(
  controller: AgentEnrollmentController
): Router {
  const router = Router();

  router.post(
    '/enroll',
    createRateLimiter('enroll'),
    validateRequest(enrollAgentSchema),
    controller.enroll
  );

  return router;
}
