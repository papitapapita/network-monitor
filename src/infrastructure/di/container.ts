import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLogger } from '../logging/WinstonLogger';
import {
  PrismaLocationRepository,
  PrismaDeviceRepository,
  PrismaDeviceModelRepository,
  PrismaVendorRepository,
  PrismaPollingConfigurationRepository,
  PrismaPingResultRepository,
  PrismaDeviceStateRepository
} from '../persistence/';
import { PrismaAlertRepository } from '../persistence/PrismaAlertRepository';
import {
  LocationController,
  DeviceController,
  DeviceModelController,
  VendorController,
  PollingController
} from '../../presentation/http/controllers';
import { AlertController } from '../../presentation/http/controllers/AlertController';
import { ScanController } from '../../presentation/http/controllers/ScanController';
import { WirelessController } from '../../presentation/http/controllers/WirelessController';
import {
  PrismaWirelessSnapshotRepository,
  PrismaWirelessAlertRecordRepository,
  PrismaWirelessPollingConfigRepository,
  SNMPCollector,
  UbiquitiHttpCollector,
  WirelessCounterStore,
  WirelessPollingOrchestrator
} from '../wireless-monitoring';
import { PrismaDeviceCredentialsRepository } from '../persistence/PrismaDeviceCredentialsRepository';
import { WirelessAlertEvaluator } from '../../application/wireless-monitoring/services/WirelessAlertEvaluator';
import {
  PollWirelessDeviceUseCase,
  GetWirelessDeviceStatusUseCase,
  GetWirelessDeviceHistoryUseCase,
  GetWirelessClientsUseCase,
  GetActiveWirelessAlertsUseCase,
  GetWirelessAlertHistoryUseCase,
  TriggerWirelessPollUseCase,
  CreateWirelessConfigUseCase,
  GetWirelessConfigUseCase,
  UpdateWirelessConfigUseCase,
  DeleteWirelessConfigUseCase
} from '../../application/wireless-monitoring/use-cases';
import {
  SetDeviceCredentialsUseCase,
  GetDeviceCredentialsUseCase,
  DeleteDeviceCredentialsUseCase
} from '../../application/device-inventory/use-cases';
import { CredentialsController } from '../../presentation/http/controllers/CredentialsController';
import { PingService } from '../monitoring/ping/PingService';
import { ArpService } from '../monitoring/network-scanner/ArpService';
import { NetworkScannerService } from '../monitoring/network-scanner/NetworkScannerService';
import { PollingOrchestrator } from '../monitoring/orchestrator/PollingOrchestrator';
import { TelegramNotificationService } from '../notifications/TelegramNotificationService';
import { EventDispatcher } from '../../domain/shared/core';
import { DeviceCreatedEvent } from '../../domain/device-inventory/events/DeviceCreatedEvent';
import { DeviceMonitoringToggledEvent } from '../../domain/device-inventory/events/DeviceMonitoringToggledEvent';
import { DeviceDetailsUpdatedEvent } from '../../domain/device-inventory/events/DeviceDetailsUpdatedEvent';
import { DeviceWentOfflineEvent } from '../../domain/device-monitoring/events/DeviceWentOfflineEvent';
import { DeviceCameOnlineEvent } from '../../domain/device-monitoring/events/DeviceCameOnlineEvent';
import { DeviceProvisionedHandler } from '../../application/device-monitoring/event-handlers/DeviceProvisionedHandler';
import { DeviceMonitoringToggledHandler } from '../../application/device-monitoring/event-handlers/DeviceMonitoringToggledHandler';
import { DeviceIPAddressChangedHandler } from '../../application/device-monitoring/event-handlers/DeviceIPAddressChangedHandler';
import { SendDeviceDownAlertUseCase } from '../../application/notifications/use-cases/SendDeviceDownAlertUseCase';
import { SendDeviceRecoveryAlertUseCase } from '../../application/notifications/use-cases/SendDeviceRecoveryAlertUseCase';
import { ListAlertsUseCase } from '../../application/notifications/use-cases/ListAlertsUseCase';
import { DeviceWentOfflineNotificationHandler } from '../../application/notifications/event-handlers/DeviceWentOfflineNotificationHandler';
import { DeviceCameOnlineNotificationHandler } from '../../application/notifications/event-handlers/DeviceCameOnlineNotificationHandler';

// Use Cases
import {
  CreateLocationUseCase,
  GetLocationUseCase,
  ListLocationsUseCase,
  UpdateLocationUseCase,
  CreateDeviceUseCase,
  GetDeviceUseCase,
  ListDevicesUseCase,
  UpdateDeviceUseCase,
  DeleteDeviceUseCase,
  GetDeviceModelUseCase,
  ListDeviceModelsUseCase,
  CreateVendorUseCase,
  GetVendorUseCase,
  ListVendorsUseCase,
  UpdateVendorUseCase,
  DeleteVendorUseCase,
  CreateDeviceModelUseCase,
  UpdateDeviceModelUseCase,
  DeleteDeviceModelUseCase,
  ScanNetworkSegmentUseCase
} from '../../application/device-inventory/use-cases';
import {
  ExecutePollingCycleUseCase,
  ConfigureDevicePollingUseCase,
  GetDevicePollingStatusUseCase,
  GetDevicePollingHistoryUseCase,
  CreateDevicePollingUseCase
} from '../../application/device-monitoring/use-cases';

/**
 * DependencyContainer
 *
 * Simple dependency injection container for the application.
 * Provides singleton instances of all services, repositories, and controllers.
 */
export class DependencyContainer {
  private prisma: PrismaClient;
  private logger: WinstonLogger;
  private locationRepository: PrismaLocationRepository;
  private deviceRepository: PrismaDeviceRepository;
  private deviceModelRepository: PrismaDeviceModelRepository;
  private vendorRepository: PrismaVendorRepository;
  private pollingConfigRepository: PrismaPollingConfigurationRepository;
  private pingResultRepository: PrismaPingResultRepository;
  private deviceStateRepository: PrismaDeviceStateRepository;
  private alertRepository: PrismaAlertRepository;

  // Wireless repositories
  private wirelessSnapshotRepository: PrismaWirelessSnapshotRepository;
  private wirelessAlertRecordRepository: PrismaWirelessAlertRecordRepository;
  private wirelessPollingConfigRepository: PrismaWirelessPollingConfigRepository;
  private deviceCredentialsRepository: PrismaDeviceCredentialsRepository;

  // Controllers
  public locationController: LocationController;
  public deviceController: DeviceController;
  public deviceModelController: DeviceModelController;
  public vendorController: VendorController;
  public pollingController: PollingController;
  public alertController: AlertController;
  public scanController: ScanController;
  public wirelessController: WirelessController;
  public credentialsController: CredentialsController;

  // Orchestrators (lifecycle managed by main.ts)
  public pollingOrchestrator: PollingOrchestrator;
  public wirelessPollingOrchestrator: WirelessPollingOrchestrator;

  constructor() {
    // Initialize infrastructure
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL
    });
    this.prisma = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? ['error', 'warn']
          : ['error']
    });
    this.logger = new WinstonLogger();

    // Initialize repositories
    this.locationRepository = new PrismaLocationRepository(
      this.prisma
    );
    this.deviceRepository = new PrismaDeviceRepository(this.prisma);
    this.deviceModelRepository = new PrismaDeviceModelRepository(
      this.prisma
    );
    this.vendorRepository = new PrismaVendorRepository(this.prisma);
    this.pollingConfigRepository =
      new PrismaPollingConfigurationRepository(this.prisma);
    this.pingResultRepository = new PrismaPingResultRepository(
      this.prisma
    );
    this.deviceStateRepository = new PrismaDeviceStateRepository(
      this.prisma
    );
    this.alertRepository = new PrismaAlertRepository(this.prisma);

    // Initialize location use cases
    const createLocationUseCase = new CreateLocationUseCase(
      this.locationRepository,
      this.logger
    );
    const getLocationUseCase = new GetLocationUseCase(
      this.locationRepository,
      this.logger
    );
    const listLocationsUseCase = new ListLocationsUseCase(
      this.locationRepository,
      this.logger
    );
    const updateLocationUseCase = new UpdateLocationUseCase(
      this.locationRepository,
      this.logger
    );

    // Initialize device use cases
    const createDeviceUseCase = new CreateDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const getDeviceUseCase = new GetDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const listDevicesUseCase = new ListDevicesUseCase(
      this.deviceRepository,
      this.logger
    );
    const updateDeviceUseCase = new UpdateDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const deleteDeviceUseCase = new DeleteDeviceUseCase(
      this.deviceRepository,
      this.logger
    );

    // Initialize device model use cases
    const getDeviceModelUseCase = new GetDeviceModelUseCase(
      this.deviceModelRepository,
      this.logger
    );
    const listDeviceModelsUseCase = new ListDeviceModelsUseCase(
      this.deviceModelRepository,
      this.logger
    );
    const createDeviceModelUseCase = new CreateDeviceModelUseCase(
      this.deviceModelRepository,
      this.vendorRepository,
      this.logger
    );
    const updateDeviceModelUseCase = new UpdateDeviceModelUseCase(
      this.deviceModelRepository,
      this.vendorRepository,
      this.logger
    );
    const deleteDeviceModelUseCase = new DeleteDeviceModelUseCase(
      this.deviceModelRepository,
      this.deviceRepository,
      this.logger
    );

    // Initialize vendor use cases
    const createVendorUseCase = new CreateVendorUseCase(
      this.vendorRepository,
      this.logger
    );
    const getVendorUseCase = new GetVendorUseCase(
      this.vendorRepository,
      this.logger
    );
    const listVendorsUseCase = new ListVendorsUseCase(
      this.vendorRepository,
      this.logger
    );
    const updateVendorUseCase = new UpdateVendorUseCase(
      this.vendorRepository,
      this.logger
    );
    const deleteVendorUseCase = new DeleteVendorUseCase(
      this.vendorRepository,
      this.deviceModelRepository,
      this.logger
    );

    // Initialize controllers
    this.locationController = new LocationController(
      createLocationUseCase,
      getLocationUseCase,
      listLocationsUseCase,
      updateLocationUseCase,
      this.logger
    );

    this.deviceController = new DeviceController(
      createDeviceUseCase,
      getDeviceUseCase,
      listDevicesUseCase,
      updateDeviceUseCase,
      deleteDeviceUseCase,
      this.logger
    );

    this.deviceModelController = new DeviceModelController(
      getDeviceModelUseCase,
      listDeviceModelsUseCase,
      createDeviceModelUseCase,
      updateDeviceModelUseCase,
      deleteDeviceModelUseCase,
      this.logger
    );

    this.vendorController = new VendorController(
      createVendorUseCase,
      getVendorUseCase,
      listVendorsUseCase,
      updateVendorUseCase,
      deleteVendorUseCase,
      this.logger
    );

    // Initialize monitoring services
    const pingService = new PingService();

    // Initialize network discovery services
    const arpService = new ArpService();
    const networkScannerService = new NetworkScannerService(
      pingService,
      arpService
    );
    const scanNetworkSegmentUseCase = new ScanNetworkSegmentUseCase(
      networkScannerService,
      this.logger
    );
    this.scanController = new ScanController(
      scanNetworkSegmentUseCase,
      this.logger
    );

    const executePollingCycleUseCase = new ExecutePollingCycleUseCase(
      this.pollingConfigRepository,
      this.pingResultRepository,
      this.deviceStateRepository,
      pingService,
      this.logger
    );
    const configurePollingUseCase = new ConfigureDevicePollingUseCase(
      this.pollingConfigRepository,
      this.logger
    );
    const getPollingStatusUseCase = new GetDevicePollingStatusUseCase(
      this.pollingConfigRepository,
      this.deviceStateRepository,
      this.pingResultRepository,
      this.logger
    );
    const getPollingHistoryUseCase =
      new GetDevicePollingHistoryUseCase(
        this.pingResultRepository,
        this.logger
      );
    const createDevicePollingUseCase = new CreateDevicePollingUseCase(
      this.pollingConfigRepository,
      this.deviceRepository,
      this.logger
    );

    this.pollingController = new PollingController(
      executePollingCycleUseCase,
      getPollingStatusUseCase,
      getPollingHistoryUseCase,
      configurePollingUseCase,
      createDevicePollingUseCase,
      this.logger
    );

    this.pollingOrchestrator = new PollingOrchestrator(
      this.pollingConfigRepository,
      executePollingCycleUseCase,
      { maxConcurrentPolls: 50 }
    );

    // Initialize notification service (fail-fast if env vars missing)
    const telegramNotificationService =
      new TelegramNotificationService();

    // Initialize notification use cases
    const sendDeviceDownAlertUseCase = new SendDeviceDownAlertUseCase(
      this.alertRepository,
      this.deviceRepository,
      this.pollingConfigRepository,
      telegramNotificationService,
      this.logger
    );
    const sendDeviceRecoveryAlertUseCase =
      new SendDeviceRecoveryAlertUseCase(
        this.alertRepository,
        this.deviceRepository,
        this.pollingConfigRepository,
        telegramNotificationService,
        this.logger
      );
    const listAlertsUseCase = new ListAlertsUseCase(
      this.alertRepository,
      this.logger
    );

    // Initialize alert controller
    this.alertController = new AlertController(
      listAlertsUseCase,
      this.logger
    );

    // =====================================
    // WIRELESS-MONITORING BOUNDED CONTEXT
    // =====================================

    this.wirelessSnapshotRepository =
      new PrismaWirelessSnapshotRepository(this.prisma);
    this.wirelessAlertRecordRepository =
      new PrismaWirelessAlertRecordRepository(this.prisma);
    this.wirelessPollingConfigRepository =
      new PrismaWirelessPollingConfigRepository(this.prisma);
    this.deviceCredentialsRepository =
      new PrismaDeviceCredentialsRepository(this.prisma);

    const snmpCollector = new SNMPCollector();
    const httpCollector = new UbiquitiHttpCollector();
    const counterStore = new WirelessCounterStore();
    const alertEvaluator = new WirelessAlertEvaluator();

    const pollWirelessDeviceUseCase = new PollWirelessDeviceUseCase(
      this.wirelessPollingConfigRepository,
      this.wirelessSnapshotRepository,
      this.wirelessAlertRecordRepository,
      this.deviceCredentialsRepository,
      snmpCollector,
      httpCollector,
      counterStore,
      alertEvaluator,
      this.logger
    );
    const getWirelessDeviceStatusUseCase =
      new GetWirelessDeviceStatusUseCase(
        this.wirelessSnapshotRepository,
        this.wirelessAlertRecordRepository,
        this.logger
      );
    const getWirelessDeviceHistoryUseCase =
      new GetWirelessDeviceHistoryUseCase(
        this.wirelessSnapshotRepository,
        this.logger
      );
    const getWirelessClientsUseCase = new GetWirelessClientsUseCase(
      this.wirelessSnapshotRepository,
      this.logger
    );
    const getActiveWirelessAlertsUseCase =
      new GetActiveWirelessAlertsUseCase(
        this.wirelessAlertRecordRepository,
        this.logger
      );
    const getWirelessAlertHistoryUseCase =
      new GetWirelessAlertHistoryUseCase(
        this.wirelessAlertRecordRepository,
        this.logger
      );
    const triggerWirelessPollUseCase = new TriggerWirelessPollUseCase(
      pollWirelessDeviceUseCase,
      this.logger
    );
    const createWirelessConfigUseCase =
      new CreateWirelessConfigUseCase(
        this.deviceRepository,
        this.wirelessPollingConfigRepository,
        this.logger
      );
    const getWirelessConfigUseCase = new GetWirelessConfigUseCase(
      this.wirelessPollingConfigRepository,
      this.logger
    );
    const updateWirelessConfigUseCase =
      new UpdateWirelessConfigUseCase(
        this.wirelessPollingConfigRepository,
        this.logger
      );
    const deleteWirelessConfigUseCase =
      new DeleteWirelessConfigUseCase(
        this.wirelessPollingConfigRepository,
        this.logger
      );

    this.wirelessController = new WirelessController(
      getWirelessDeviceStatusUseCase,
      getWirelessDeviceHistoryUseCase,
      getWirelessClientsUseCase,
      getActiveWirelessAlertsUseCase,
      getWirelessAlertHistoryUseCase,
      triggerWirelessPollUseCase,
      createWirelessConfigUseCase,
      getWirelessConfigUseCase,
      updateWirelessConfigUseCase,
      deleteWirelessConfigUseCase,
      this.logger
    );

    // =====================================
    // DEVICE CREDENTIALS (device-inventory BC)
    // =====================================

    const setDeviceCredentialsUseCase =
      new SetDeviceCredentialsUseCase(
        this.deviceRepository,
        this.deviceCredentialsRepository,
        this.logger
      );
    const getDeviceCredentialsUseCase =
      new GetDeviceCredentialsUseCase(
        this.deviceCredentialsRepository,
        this.logger
      );
    const deleteDeviceCredentialsUseCase =
      new DeleteDeviceCredentialsUseCase(
        this.deviceCredentialsRepository,
        this.logger
      );

    this.credentialsController = new CredentialsController(
      setDeviceCredentialsUseCase,
      getDeviceCredentialsUseCase,
      deleteDeviceCredentialsUseCase,
      this.logger
    );

    this.wirelessPollingOrchestrator =
      new WirelessPollingOrchestrator(
        this.wirelessPollingConfigRepository,
        pollWirelessDeviceUseCase,
        { maxConcurrentPolls: 50 },
        this.logger
      );

    // Register cross-context event handlers
    EventDispatcher.register(
      DeviceCreatedEvent.name,
      new DeviceProvisionedHandler(this.pollingConfigRepository)
    );
    EventDispatcher.register(
      DeviceMonitoringToggledEvent.name,
      new DeviceMonitoringToggledHandler(this.pollingConfigRepository)
    );
    EventDispatcher.register(
      DeviceDetailsUpdatedEvent.name,
      new DeviceIPAddressChangedHandler(this.pollingConfigRepository)
    );
    EventDispatcher.register(
      DeviceWentOfflineEvent.name,
      new DeviceWentOfflineNotificationHandler(
        sendDeviceDownAlertUseCase
      )
    );
    EventDispatcher.register(
      DeviceCameOnlineEvent.name,
      new DeviceCameOnlineNotificationHandler(
        sendDeviceRecoveryAlertUseCase
      )
    );
  }

  /**
   * Connects to database and performs any necessary initialization.
   */
  public async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.info('Database connected successfully');
    } catch (error) {
      this.logger.error(
        'Failed to connect to database',
        error as Error
      );
      throw error;
    }
  }

  /**
   * Gracefully disconnects from database.
   */
  public async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.logger.info('Database disconnected');
    } catch (error) {
      this.logger.error(
        'Error disconnecting from database',
        error as Error
      );
      throw error;
    }
  }

  /**
   * Returns the Prisma client instance for direct database access if needed.
   */
  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  /**
   * Returns the logger instance.
   */
  public getLogger(): WinstonLogger {
    return this.logger;
  }
}

/**
 * Factory function to create and initialize the dependency container.
 */
export async function setupDependencies(): Promise<DependencyContainer> {
  const container = new DependencyContainer();
  await container.connect();
  return container;
}
