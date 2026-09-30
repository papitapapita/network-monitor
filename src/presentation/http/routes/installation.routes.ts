import { Router } from 'express';
import { InstallationController } from '../controllers';
import { authorize, createRateLimiter } from '../middleware';

// Every role reads it: which menus to show is everyone's question (INS-009).
export function createInstallationRoutes(
  controller: InstallationController
): Router {
  const router = Router();

  router.get(
    '/',
    authorize('read'),
    createRateLimiter('read'),
    controller.get
  );

  return router;
}
