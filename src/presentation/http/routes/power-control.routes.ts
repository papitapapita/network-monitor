import { Router } from 'express';
import { PowerControlController } from '../controllers';
import {
  authorize,
  createRateLimiter,
  validateRequest
} from '../middleware';
import {
  getDevicePowerSourceSchema,
  listSitePoePortsSchema
} from '../validation';

/**
 * PoE power control — mounted under /api
 *
 * GET /api/locations/:id/poe-ports   — every PoE switch at the site, its ports
 *                                      and the antenna each one powers
 * GET /api/devices/:id/power-source  — the switch port that powers the device
 *
 * Both read the switches live and change nothing on them (PWR-014).
 */
export function createPowerControlRoutes(
  controller: PowerControlController
): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/locations/:id/poe-ports',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(listSitePoePortsSchema),
    controller.listSitePorts
  );
  router.get(
    '/devices/:id/power-source',
    authorize('read'),
    createRateLimiter('read'),
    validateRequest(getDevicePowerSourceSchema),
    controller.getPowerSource
  );

  return router;
}
