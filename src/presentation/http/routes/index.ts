import { Application, Router } from 'express';
import { DependencyContainer } from '../../../infrastructure/di/container';
import { loadAllowedOrigins } from '../../../infrastructure/di/allowedOrigins';
import { createLocationRoutes } from './location.routes';
import { createTopologyRoutes } from './topology.routes';
import { createDeviceRoutes } from './device.routes';
import { createDeviceModelRoutes } from './device-model.routes';
import { createVendorRoutes } from './vendor.routes';
import { createPollingRoutes } from './polling.routes';
import {
  createNotificationPolicyRoutes,
  createNotificationPolicyBulkRoutes
} from './notification-policy.routes';
import { createNotificationMuteRoutes } from './notification-mute.routes';
import { createPushRoutes } from './push.routes';
import { createInboxNotificationRoutes } from './inbox-notification.routes';
import { createInboxStreamRoutes } from './inbox-stream.routes';
import { createNotificationSettingsRoutes } from './notification-settings.routes';
import { createAlertRoutes } from './alert.routes';
import { createScanRoutes } from './scan.routes';
import { createDiscoveredDeviceRoutes } from './discovered-device.routes';
import { createDiscoverySettingsRoutes } from './discovery-settings.routes';
import { createWirelessRoutes } from './wireless.routes';
import { createAlertThresholdRoutes } from './alert-threshold.routes';
import { createWirelessStreamRoutes } from './wireless-stream.routes';
import { createWirelessDiagnosisRoutes } from './wireless-diagnosis.routes';
import { createNetworkSweepRoutes } from './network-sweep.routes';
import { createPingToolRoutes } from './ping-tool.routes';
import {
  createSpeedTestRoutes,
  createSpeedTestStreamRoutes
} from './speed-test.routes';
import { createCredentialsRoutes } from './credentials.routes';
import { createRadioSettingsRoutes } from './radio-settings.routes';
import { createDeviceBackupRoutes } from './device-backup.routes';
import { createPowerControlRoutes } from './power-control.routes';
import { createPortSpeedRoutes } from './port-speed.routes';
import { createAuthRoutes } from './auth.routes';
import { createAdminRoutes } from './admin.routes';
import { createUserRoutes } from './user.routes';
import { createCustomerRoutes } from './customer.routes';
import { createServicePlanRoutes } from './service-plan.routes';
import { createContractedServiceRoutes } from './contracted-service.routes';
import { createEnforcementRoutes } from './enforcement.routes';
import { createBillRoutes } from './bill.routes';
import { createBillingSettingsRoutes } from './billing-settings.routes';
import { createCollectionAccountRoutes } from './collection-account.routes';
import { createBankAccountRoutes } from './bank-account.routes';
import { createTicketRoutes } from './ticket.routes';
import { createTechnicianRoutes } from './technician.routes';
import { createQuotationRoutes } from './quotation.routes';
import { createAgentRoutes } from './agent.routes';
import { createAgentEnrollmentRoutes } from './agent-enrollment.routes';
import { createAgentUpdateRoutes } from './agent-update.routes';
import { createSubscriptionRoutes } from './subscription.routes';
import { createInstallationRoutes } from './installation.routes';
import { createVendorSettingsRoutes } from './vendor-settings.routes';
import {
  createAuditLogMiddleware,
  createAuthenticateMiddleware,
  createRateLimiter,
  createRequireCredentialRevealMiddleware,
  createSubscriptionGuard
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
  // One budget for both doors, so an address cannot double it by splitting
  // its requests between them (IDN-104).
  const perAddress = createRateLimiter('address');

  // =====================================
  // SUBSCRIPTION GUARD — ahead of everything (ADR 0002, R17)
  // =====================================

  // Read-only refuses writes, locked refuses everything. Signing in and
  // reading the status stay open so the dashboard can show why.
  apiRouter.use(
    createSubscriptionGuard(
      container.getSubscriptionStatusUseCase,
      container.getLogger(),
      // The vendor records a payment here, so a read-only or locked install
      // must still let it through (INS-030); the route itself is VENDOR-only.
      (req) =>
        req.path.startsWith('/auth/') ||
        (req.method === 'GET' && req.path === '/subscription') ||
        /^\/installation\/settings\/?$/.test(req.path)
    )
  );

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
      container.sessionValidator,
      container.getLogger()
    )
  );
  apiRouter.use(
    '/',
    createInboxStreamRoutes(
      container.inboxStreamController,
      container.tokenService,
      container.sessionValidator,
      container.getLogger()
    )
  );
  apiRouter.use(
    '/',
    createNetworkSweepRoutes(
      container.networkSweepController,
      container.tokenService,
      container.sessionValidator,
      container.getLogger()
    )
  );
  apiRouter.use(
    '/',
    createPingToolRoutes(
      container.pingToolController,
      container.tokenService,
      container.sessionValidator,
      container.getLogger()
    )
  );
  apiRouter.use(
    '/',
    createSpeedTestStreamRoutes(
      container.speedTestController,
      container.tokenService,
      container.sessionValidator,
      container.getLogger()
    )
  );

  // =====================================
  // GLOBAL MIDDLEWARE — all routes below require a valid JWT
  // =====================================

  apiRouter.use(
    createAuditLogMiddleware(container.getLogger()),
    createAuthenticateMiddleware(
      container.tokenService,
      container.sessionValidator,
      loadAllowedOrigins(process.env)
    )
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

  // Topology: /api/topology
  apiRouter.use(
    '/topology',
    createTopologyRoutes(container.topologyController)
  );

  // Device credentials: /api/devices/:id/credentials
  apiRouter.use(
    '/devices',
    createCredentialsRoutes(
      container.credentialsController,
      createRequireCredentialRevealMiddleware(
        container.credentialRevealGate
      )
    )
  );

  // =====================================
  // DEVICE-BACKUPS BOUNDED CONTEXT
  // =====================================

  // Configuration backups: /api/devices/:id/backups
  apiRouter.use(
    '/devices',
    createDeviceBackupRoutes(container.deviceBackupController)
  );

  // =====================================
  // POWER-CONTROL BOUNDED CONTEXT
  // =====================================

  // PoE ports: /api/locations/:id/poe-ports, /api/devices/:id/power-source
  apiRouter.use(
    '/',
    createPowerControlRoutes(container.powerControlController)
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
  // OPTIONAL MODULES — a disabled module's controller is null, so its routes
  // are never mounted and fall through to the 404 handler (ENABLED_MODULES)
  // =====================================

  const {
    customerController,
    servicePlanController,
    contractedServiceController,
    enforcementController,
    billController,
    billingSettingsController,
    collectionAccountController,
    bankAccountController,
    quotationController,
    ticketController,
    technicianController
  } = container;

  // Customers: /api/customers, /api/service-plans, /api/contracted-services
  if (customerController) {
    apiRouter.use(
      '/customers',
      createCustomerRoutes(customerController)
    );
  }
  if (servicePlanController) {
    apiRouter.use(
      '/service-plans',
      createServicePlanRoutes(servicePlanController)
    );
  }
  if (contractedServiceController) {
    apiRouter.use(
      '/contracted-services',
      createContractedServiceRoutes(contractedServiceController)
    );
  }

  // Enforcement status: /api/enforcement/suspensions,
  // /api/contracted-services/:id/enforcement
  if (enforcementController) {
    apiRouter.use(
      '/',
      createEnforcementRoutes(enforcementController)
    );
  }

  // Billing: /api/bills, /api/billing-settings, /api/collection-accounts,
  // /api/bank-accounts
  if (billController) {
    apiRouter.use('/bills', createBillRoutes(billController));
  }
  if (billingSettingsController) {
    apiRouter.use(
      '/billing-settings',
      createBillingSettingsRoutes(billingSettingsController)
    );
  }
  if (collectionAccountController) {
    apiRouter.use(
      '/collection-accounts',
      createCollectionAccountRoutes(collectionAccountController)
    );
  }
  if (bankAccountController) {
    apiRouter.use(
      '/bank-accounts',
      createBankAccountRoutes(bankAccountController)
    );
  }

  // Quotations: /api/quotations
  if (quotationController) {
    apiRouter.use(
      '/quotations',
      createQuotationRoutes(quotationController)
    );
  }

  // Tickets: /api/tickets, /api/tickets/my-day, /api/technicians
  if (ticketController) {
    apiRouter.use('/tickets', createTicketRoutes(ticketController));
  }
  if (technicianController) {
    apiRouter.use(
      '/technicians',
      createTechnicianRoutes(technicianController)
    );
  }

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

  // Muted alert types: /api/notification-mutes
  apiRouter.use(
    '/notification-mutes',
    createNotificationMuteRoutes(container.notificationMuteController)
  );

  // Phone notifications: /api/push
  apiRouter.use('/push', createPushRoutes(container.pushController));

  // In-app inbox: /api/notifications
  apiRouter.use(
    '/notifications',
    createInboxNotificationRoutes(
      container.inboxNotificationController
    )
  );

  // Install notification settings: /api/notification-settings
  apiRouter.use(
    '/notification-settings',
    createNotificationSettingsRoutes(
      container.notificationSettingsController
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

  // A radio's own settings: /api/devices/:id/wireless/key/reveal,
  // /api/devices/:id/wireless/hostname
  apiRouter.use(
    '/devices',
    createRadioSettingsRoutes(
      container.radioSettingsController,
      createRequireCredentialRevealMiddleware(
        container.credentialRevealGate
      )
    )
  );

  // Alert thresholds: /api/wireless/alert-thresholds,
  // /api/devices/:id/wireless/alert-thresholds
  apiRouter.use(
    '/',
    createAlertThresholdRoutes(container.alertThresholdsController)
  );

  // Live diagnosis: /api/devices/:id/wireless/diagnosis
  apiRouter.use(
    '/',
    createWirelessDiagnosisRoutes(container.linkDiagnosisController)
  );

  // =====================================
  // NETWORK DISCOVERY
  // =====================================

  // Network scan: /api/network/scan
  apiRouter.use(
    '/network/scan',
    createScanRoutes(container.scanController)
  );

  // Devices the network shows that inventory lacks: /api/network/discovered
  apiRouter.use(
    '/network/discovered',
    createDiscoveredDeviceRoutes(container.discoveredDeviceController)
  );

  // The scheduled network scan: /api/network/discovery-settings
  apiRouter.use(
    '/network/discovery-settings',
    createDiscoverySettingsRoutes(
      container.discoverySettingsController
    )
  );

  // Internet speed test history: /api/network/speed-tests
  apiRouter.use(
    '/network/speed-tests',
    createSpeedTestRoutes(container.speedTestController)
  );

  // MikroTik port speeds: /api/routers/port-speeds
  apiRouter.use(
    '/routers',
    createPortSpeedRoutes(container.portSpeedController)
  );

  // =====================================
  // PROBE-AGENTS BOUNDED CONTEXT
  // =====================================

  // Agents: /api/agents
  apiRouter.use(
    '/agents',
    createAgentRoutes(container.agentController)
  );

  // =====================================
  // INSTALLATION
  // =====================================

  // Subscription status: /api/subscription
  apiRouter.use(
    '/subscription',
    createSubscriptionRoutes(container.subscriptionController)
  );

  // The vendor's settings: /api/installation/settings
  apiRouter.use(
    '/installation/settings',
    createVendorSettingsRoutes(container.vendorSettingsController)
  );

  // Installation settings: /api/installation
  apiRouter.use(
    '/installation',
    createInstallationRoutes(container.installationController)
  );

  // =====================================
  // ADMIN
  // =====================================

  // Users: /api/users
  apiRouter.use('/users', createUserRoutes(container.userController));

  // Admin: /api/admin/*
  apiRouter.use(
    '/admin',
    createAdminRoutes(container.adminController)
  );

  app.use('/api', perAddress, apiRouter);

  // Agent-facing endpoints live outside /api: agents authenticate with a
  // pairing code or their own token, never a user's JWT (ADR 0002, R4).
  app.use(
    '/agent/v1',
    perAddress,
    createSubscriptionGuard(
      container.getSubscriptionStatusUseCase,
      container.getLogger()
    ),
    createAgentEnrollmentRoutes(container.agentEnrollmentController),
    createAgentUpdateRoutes(container.agentUpdateController)
  );
}
