import { Router } from 'express';
import { WirelessController } from '../controllers';
import { validateRequest, authorize, createRateLimiter } from '../middleware';
import {
  getWirelessStatusSchema,
  getWirelessHistorySchema,
  getWirelessClientsSchema,
  getDeviceWirelessAlertsSchema,
  getDeviceWirelessAlertHistorySchema,
  triggerWirelessPollSchema,
  rebootWirelessDeviceSchema,
  getAllActiveAlertsSchema,
  getAllAlertHistorySchema,
  createWirelessConfigSchema,
  getWirelessConfigSchema,
  updateWirelessConfigSchema,
  deleteWirelessConfigSchema
} from '../validation';

/**
 * Creates Express routes for wireless monitoring endpoints.
 * Mounted under /api by the router index.
 *
 * Routes:
 * - POST   /api/devices/:id/wireless/config        - Create wireless polling config
 * - GET    /api/devices/:id/wireless/config        - Get wireless polling config
 * - PATCH  /api/devices/:id/wireless/config        - Update wireless polling config
 * - DELETE /api/devices/:id/wireless/config        - Delete wireless polling config
 * - GET    /api/devices/:id/wireless/status        - Latest wireless snapshot
 * - GET    /api/devices/:id/wireless/history       - Historical snapshots
 * - GET    /api/devices/:id/wireless/clients       - Connected client list (AP only)
 * - GET    /api/devices/:id/wireless/alerts/history - Alert history for device
 * - GET    /api/devices/:id/wireless/alerts        - Active alerts for device
 * - POST   /api/devices/:id/wireless/poll          - Trigger immediate poll
 * - POST   /api/devices/:id/wireless/reboot        - Reboot the device
 * - GET    /api/wireless/alerts/history            - All alert history
 * - GET    /api/wireless/alerts                    - All active alerts
 */
export function createWirelessRoutes(
  controller: WirelessController
): Router {
  const router = Router({ mergeParams: true });

  // Device-scoped wireless routes
  router.post(
    '/devices/:id/wireless/config',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(createWirelessConfigSchema),
    controller.createConfig
  );

  router.get(
    '/devices/:id/wireless/config',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getWirelessConfigSchema),
    controller.getConfig
  );

  router.patch(
    '/devices/:id/wireless/config',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(updateWirelessConfigSchema),
    controller.updateConfig
  );

  router.delete(
    '/devices/:id/wireless/config',
    authorize('delete'),
    createRateLimiter('delete'),
    validateRequest(deleteWirelessConfigSchema),
    controller.deleteConfig
  );

  router.get(
    '/devices/:id/wireless/status',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getWirelessStatusSchema),
    controller.getStatus
  );

  router.get(
    '/devices/:id/wireless/history',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getWirelessHistorySchema),
    controller.getHistory
  );

  router.get(
    '/devices/:id/wireless/clients',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getWirelessClientsSchema),
    controller.getClients
  );

  // Static path before parameterized segment — alerts/history before alerts
  router.get(
    '/devices/:id/wireless/alerts/history',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getDeviceWirelessAlertHistorySchema),
    controller.getDeviceAlertHistory
  );

  router.get(
    '/devices/:id/wireless/alerts',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getDeviceWirelessAlertsSchema),
    controller.getDeviceActiveAlerts
  );

  router.post(
    '/devices/:id/wireless/poll',
    authorize('create'),
    createRateLimiter('write'),
    validateRequest(triggerWirelessPollSchema),
    controller.triggerPoll
  );

  router.post(
    '/devices/:id/wireless/reboot',
    authorize('update'),
    createRateLimiter('write'),
    validateRequest(rebootWirelessDeviceSchema),
    controller.reboot
  );

  // Global wireless routes (not device-scoped)
  router.get(
    '/wireless/alerts/history',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getAllAlertHistorySchema),
    controller.getAllAlertHistory
  );

  router.get(
    '/wireless/alerts',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getAllActiveAlertsSchema),
    controller.getAllActiveAlerts
  );

  return router;
}
