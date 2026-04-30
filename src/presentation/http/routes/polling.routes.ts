import { Router } from 'express';
import { PollingController } from '../controllers/PollingController';
import { validateRequest } from '../middleware/validateRequest';
import {
  pollDeviceSchema,
  getPollingStatusSchema,
  getPollingHistorySchema,
  configurePollingSchema,
  createDevicePollingSchema
} from '../validation/polling.schemas';

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
    validateRequest(pollDeviceSchema),
    controller.poll
  );

  router.get(
    '/:id/polling/status',
    validateRequest(getPollingStatusSchema),
    controller.getStatus
  );

  router.get(
    '/:id/polling/history',
    validateRequest(getPollingHistorySchema),
    controller.getHistory
  );

  router.post(
    '/:id/polling/config',
    validateRequest(createDevicePollingSchema),
    controller.create
  );

  router.patch(
    '/:id/polling/config',
    validateRequest(configurePollingSchema),
    controller.configure
  );

  return router;
}
