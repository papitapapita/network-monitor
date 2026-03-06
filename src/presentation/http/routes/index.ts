import { Application, Router } from 'express';
import { DependencyContainer } from '../../../infrastructure/di/container';
//import { createNetworkDeviceRoutes } from './network-device.routes';
import { createLocationRoutes } from './location.routes';

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
  // DEVICE-INVENTORY BOUNDED CONTEXT
  // =====================================

  // Network Devices: /api/network-devices
  /* apiRouter.use(
    '/network-devices',
    createNetworkDeviceRoutes(container.networkDeviceController)
  );*/

  app.use((req, res, next) => {
    console.log(
      `Incoming Request before /api/locations setup: ${req.method} ${req.url}`
    );
    next();
  });

  // Locations: /api/locations
  apiRouter.use(
    '/locations',
    createLocationRoutes(container.locationController)
  );

  // Mount API router under /api prefix
  app.use('/api', apiRouter);
}
