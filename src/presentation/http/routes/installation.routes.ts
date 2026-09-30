import { Router } from 'express';
import { InstallationController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import { installerFileNameSchema } from '../validation';

// Every role reads it: which menus to show is everyone's question (INS-009).
// Installers are GETs, so a read-only install still hands them out and only a
// locked one refuses (INS-042).
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

  router.get(
    '/installers',
    authorize('read'),
    createRateLimiter('read'),
    controller.listInstallers
  );

  router.get(
    '/installers/:fileName',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(installerFileNameSchema),
    controller.downloadInstaller
  );

  return router;
}
