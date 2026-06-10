import { Application, Router } from 'express';
import { DependencyContainer } from '../../../infrastructure/di/container';
import { createLocationRoutes } from './location.routes';
import { createDeviceRoutes } from './device.routes';
import { createDeviceModelRoutes } from './device-model.routes';
import { createVendorRoutes } from './vendor.routes';
import { createPollingRoutes } from './polling.routes';
import { createAlertRoutes } from './alert.routes';
import { createScanRoutes } from './scan.routes';
import { createWirelessRoutes } from './wireless.routes';
import { createCredentialsRoutes } from './credentials.routes';
import { createAuthRoutes } from './auth.routes';
import { createAdminRoutes } from './admin.routes';
import {
  createAuditLogMiddleware,
  createAuthenticateMiddleware
} from '../middleware';

/**
 * setupRoutes
 *
 * Configures all HTTP routes for the application.
 * Routes are organized by Bounded Context and mounted under /api prefix.
 *
 * Bounded Contexts:
 * - device-inventory: /api/network-devices, /api/locations
 */
export function setupRoutes(
  app: Application,
  container: DependencyContainer
): void {
  const apiRouter = Router();

  // =====================================
  // IDENTITY — public (no auth required)
  // =====================================

  apiRouter.use('/auth', createAuthRoutes(container.authController));

  // =====================================
  // GLOBAL MIDDLEWARE — all routes below require a valid JWT
  // =====================================

  apiRouter.use(
    createAuditLogMiddleware(container.getLogger()),
    createAuthenticateMiddleware(container.tokenService)
  );

  // =====================================
  // DEVICE-INVENTORY BOUNDED CONTEXT
  // =====================================

  // Locations: /api/locations
  apiRouter.use(
    '/locations',
    createLocationRoutes(container.locationController)
  );

  // Devices: /api/devices
  apiRouter.use(
    '/devices',
    createDeviceRoutes(container.deviceController)
  );

  // Device credentials: /api/devices/:id/credentials
  apiRouter.use(
    '/devices',
    createCredentialsRoutes(container.credentialsController)
  );

  // Device Models: /api/device-models
  apiRouter.use(
    '/device-models',
    createDeviceModelRoutes(container.deviceModelController)
  );

  // Vendors: /api/vendors
  apiRouter.use(
    '/vendors',
    createVendorRoutes(container.vendorController)
  );

  // =====================================
  // DEVICE-MONITORING BOUNDED CONTEXT
  // =====================================

  // Polling: /api/devices/:id/poll, /api/devices/:id/polling/*
  apiRouter.use(
    '/devices',
    createPollingRoutes(container.pollingController)
  );

  // =====================================
  // NOTIFICATIONS BOUNDED CONTEXT
  // =====================================

  // Alerts: /api/alerts
  apiRouter.use(
    '/alerts',
    createAlertRoutes(container.alertController)
  );

  // =====================================
  // WIRELESS-MONITORING BOUNDED CONTEXT
  // =====================================

  // Wireless: /api/devices/:id/wireless/*, /api/wireless/*
  apiRouter.use(
    '/',
    createWirelessRoutes(container.wirelessController)
  );

  // =====================================
  // NETWORK DISCOVERY
  // =====================================

  // Network scan: /api/network/scan
  apiRouter.use(
    '/network/scan',
    createScanRoutes(container.scanController)
  );

  // =====================================
  // ADMIN
  // =====================================

  // Admin: /api/admin/*
  apiRouter.use(
    '/admin',
    createAdminRoutes(container.adminController)
  );

  app.use('/api', apiRouter);
}
