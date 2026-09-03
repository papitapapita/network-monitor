import { Application, Router } from 'express';
import { DependencyContainer } from '../../../infrastructure/di/container';
import { createLocationRoutes } from './location.routes';
import { createDeviceRoutes } from './device.routes';
import { createDeviceModelRoutes } from './device-model.routes';
import { createVendorRoutes } from './vendor.routes';
import { createPollingRoutes } from './polling.routes';
import {
  createNotificationPolicyRoutes,
  createNotificationPolicyBulkRoutes
} from './notification-policy.routes';
import { createAlertRoutes } from './alert.routes';
import { createScanRoutes } from './scan.routes';
import { createWirelessRoutes } from './wireless.routes';
import { createWirelessStreamRoutes } from './wireless-stream.routes';
import { createCredentialsRoutes } from './credentials.routes';
import { createAuthRoutes } from './auth.routes';
import { createAdminRoutes } from './admin.routes';
import { createCustomerRoutes } from './customer.routes';
import { createServicePlanRoutes } from './service-plan.routes';
import { createContractedServiceRoutes } from './contracted-service.routes';
import { createEnforcementRoutes } from './enforcement.routes';
import { createBillRoutes } from './bill.routes';
import { createTicketRoutes } from './ticket.routes';
import { createTechnicianRoutes } from './technician.routes';
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
  // SSE STREAMS — authenticated, but not by the global middleware
  // =====================================

  // Mounted above the Bearer-only guard because EventSource cannot send
  // headers. The router attaches its own audit log and stream authentication
  // per route, so neither reaches the routes registered below it.
  apiRouter.use(
    '/',
    createWirelessStreamRoutes(
      container.wirelessStreamController,
      container.tokenService,
      container.getLogger()
    )
  );

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
  // CUSTOMERS BOUNDED CONTEXT
  // =====================================

  // Customers: /api/customers
  apiRouter.use(
    '/customers',
    createCustomerRoutes(container.customerController)
  );

  // Service plans: /api/service-plans
  apiRouter.use(
    '/service-plans',
    createServicePlanRoutes(container.servicePlanController)
  );

  // Contracted services: /api/contracted-services
  apiRouter.use(
    '/contracted-services',
    createContractedServiceRoutes(
      container.contractedServiceController
    )
  );

  // =====================================
  // SERVICE-ENFORCEMENT BOUNDED CONTEXT
  // =====================================

  // Enforcement status: /api/enforcement/suspensions,
  // /api/contracted-services/:id/enforcement
  apiRouter.use(
    '/',
    createEnforcementRoutes(container.enforcementController)
  );

  // =====================================
  // BILLING BOUNDED CONTEXT
  // =====================================

  // Bills: /api/bills
  apiRouter.use('/bills', createBillRoutes(container.billController));

  // =====================================
  // TICKETS BOUNDED CONTEXT
  // =====================================

  // Tickets: /api/tickets, /api/tickets/my-day
  apiRouter.use(
    '/tickets',
    createTicketRoutes(container.ticketController)
  );

  // Technicians: /api/technicians
  apiRouter.use(
    '/technicians',
    createTechnicianRoutes(container.technicianController)
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

  // Notification policy: /api/devices/:id/notification-policy,
  // /api/notification-policies/bulk
  apiRouter.use(
    '/devices',
    createNotificationPolicyRoutes(
      container.notificationPolicyController
    )
  );
  apiRouter.use(
    '/notification-policies',
    createNotificationPolicyBulkRoutes(
      container.notificationPolicyController
    )
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
