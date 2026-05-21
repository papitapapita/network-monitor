import { Router } from 'express';
import { WirelessController } from '../controllers/WirelessController';
import { validateRequest } from '../middleware/validateRequest';
import {
  getWirelessStatusSchema,
  getWirelessHistorySchema,
  getWirelessClientsSchema,
  getDeviceWirelessAlertsSchema,
  getDeviceWirelessAlertHistorySchema,
  triggerWirelessPollSchema,
  getAllActiveAlertsSchema,
  getAllAlertHistorySchema,
  createWirelessConfigSchema,
  getWirelessConfigSchema,
  updateWirelessConfigSchema,
  deleteWirelessConfigSchema
} from '../validation/wireless.schemas';

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
    validateRequest(createWirelessConfigSchema),
    controller.createConfig
  );

  router.get(
    '/devices/:id/wireless/config',
    validateRequest(getWirelessConfigSchema),
    controller.getConfig
  );

  router.patch(
    '/devices/:id/wireless/config',
    validateRequest(updateWirelessConfigSchema),
    controller.updateConfig
  );

  router.delete(
    '/devices/:id/wireless/config',
    validateRequest(deleteWirelessConfigSchema),
    controller.deleteConfig
  );

  router.get(
    '/devices/:id/wireless/status',
    validateRequest(getWirelessStatusSchema),
    controller.getStatus
  );

  router.get(
    '/devices/:id/wireless/history',
    validateRequest(getWirelessHistorySchema),
    controller.getHistory
  );

  router.get(
    '/devices/:id/wireless/clients',
    validateRequest(getWirelessClientsSchema),
    controller.getClients
  );

  // Static path before parameterized segment — alerts/history before alerts
  router.get(
    '/devices/:id/wireless/alerts/history',
    validateRequest(getDeviceWirelessAlertHistorySchema),
    controller.getDeviceAlertHistory
  );

  router.get(
    '/devices/:id/wireless/alerts',
    validateRequest(getDeviceWirelessAlertsSchema),
    controller.getDeviceActiveAlerts
  );

  router.post(
    '/devices/:id/wireless/poll',
    validateRequest(triggerWirelessPollSchema),
    controller.triggerPoll
  );

  // Global wireless routes (not device-scoped)
  router.get(
    '/wireless/alerts/history',
    validateRequest(getAllAlertHistorySchema),
    controller.getAllAlertHistory
  );

  router.get(
    '/wireless/alerts',
    validateRequest(getAllActiveAlertsSchema),
    controller.getAllActiveAlerts
  );

  return router;
}
