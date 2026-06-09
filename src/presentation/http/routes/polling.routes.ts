import { Router } from 'express';
import { PollingController } from '../controllers';
import { validateRequest, authorize, createRateLimiter } from '../middleware';
import {
  pollDeviceSchema,
  getPollingStatusSchema,
  getPollingHistorySchema,
  configurePollingSchema,
  createDevicePollingSchema
} from '../validation';

/**
 * Creates Express routes for polling endpoints.
 * Mounted under /api/devices/:id/polling by the router index.
 *
 * Routes:
 * - POST   /api/devices/:id/poll              - Manual poll
 * - GET    /api/devices/:id/polling/status    - Current status
 * - GET    /api/devices/:id/polling/history   - Ping history
 * - PATCH  /api/devices/:id/polling/config    - Configure polling
 */
export function createPollingRoutes(
  controller: PollingController
): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/:id/poll',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(pollDeviceSchema),
    controller.poll
  );

  router.get(
    '/:id/polling/status',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getPollingStatusSchema),
    controller.getStatus
  );

  router.get(
    '/:id/polling/history',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getPollingHistorySchema),
    controller.getHistory
  );

  router.post(
    '/:id/polling/config',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createDevicePollingSchema),
    controller.create
  );

  router.patch(
    '/:id/polling/config',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(configurePollingSchema),
    controller.configure
  );

  return router;
}
