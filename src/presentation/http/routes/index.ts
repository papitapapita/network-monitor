import { Application, Router } from 'express';
import { DependencyContainer } from '../../../infrastructure/di/container';
import { createLocationRoutes } from './location.routes';
import { createDeviceRoutes } from './device.routes';
import { createDeviceModelRoutes } from './device-model.routes';

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

  // Device Models: /api/device-models
  apiRouter.use(
    '/device-models',
    createDeviceModelRoutes(container.deviceModelController)
  );

  // Mount API router under /api prefix
  app.use('/api', apiRouter);
}
