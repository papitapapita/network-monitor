import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLogger } from '../logging/WinstonLogger';
import {
  PrismaLocationRepository,
  PrismaDeviceRepository,
  PrismaDeviceModelRepository,
  PrismaPollingConfigurationRepository,
  PrismaPingResultRepository,
  PrismaDeviceStateRepository
} from '../persistence/';
import {
  LocationController,
  DeviceController,
  DeviceModelController,
  PollingController
} from '../../presentation/http/controllers';
import { PingService } from '../monitoring/ping/PingService';
import { PollingOrchestrator } from '../monitoring/orchestrator/PollingOrchestrator';
import { EventDispatcher } from '../../domain/shared/core';
import { DeviceCreatedEvent } from '../../domain/device-inventory/events/DeviceCreatedEvent';
import { DeviceMonitoringToggledEvent } from '../../domain/device-inventory/events/DeviceMonitoringToggledEvent';
import { DeviceDetailsUpdatedEvent } from '../../domain/device-inventory/events/DeviceDetailsUpdatedEvent';
import { DeviceProvisionedHandler } from '../../application/device-monitoring/event-handlers/DeviceProvisionedHandler';
import { DeviceMonitoringToggledHandler } from '../../application/device-monitoring/event-handlers/DeviceMonitoringToggledHandler';
import { DeviceIPAddressChangedHandler } from '../../application/device-monitoring/event-handlers/DeviceIPAddressChangedHandler';

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
  GetDeviceModelUseCase,
  ListDeviceModelsUseCase
} from '../../application/device-inventory/use-cases';
import {
  ExecutePollingCycleUseCase,
  ConfigureDevicePollingUseCase,
  GetDevicePollingStatusUseCase,
  GetDevicePollingHistoryUseCase
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
  private pollingConfigRepository: PrismaPollingConfigurationRepository;
  private pingResultRepository: PrismaPingResultRepository;
  private deviceStateRepository: PrismaDeviceStateRepository;

  // Controllers
  public locationController: LocationController;
  public deviceController: DeviceController;
  public deviceModelController: DeviceModelController;
  public pollingController: PollingController;

  // Orchestrator (lifecycle managed by main.ts)
  public pollingOrchestrator: PollingOrchestrator;

  constructor() {
    // Initialize infrastructure
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL
    });
    this.prisma = new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
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
    this.pollingConfigRepository =
      new PrismaPollingConfigurationRepository(this.prisma);
    this.pingResultRepository = new PrismaPingResultRepository(
      this.prisma
    );
    this.deviceStateRepository = new PrismaDeviceStateRepository(
      this.prisma
    );

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

    // Initialize device model use cases
    const getDeviceModelUseCase = new GetDeviceModelUseCase(
      this.deviceModelRepository,
      this.logger
    );
    const listDeviceModelsUseCase = new ListDeviceModelsUseCase(
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
      this.logger
    );

    this.deviceModelController = new DeviceModelController(
      getDeviceModelUseCase,
      listDeviceModelsUseCase,
      this.logger
    );

    // Initialize monitoring services
    const pingService = new PingService();

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

    this.pollingController = new PollingController(
      executePollingCycleUseCase,
      getPollingStatusUseCase,
      getPollingHistoryUseCase,
      configurePollingUseCase
    );

    this.pollingOrchestrator = new PollingOrchestrator(
      this.pollingConfigRepository,
      executePollingCycleUseCase
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
