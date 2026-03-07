import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLogger } from '../logging/WinstonLogger';
import {
  PrismaLocationRepository,
  PrismaDeviceRepository
} from '../persistence/';
import {
  LocationController,
  DeviceController
} from '../../presentation/http/controllers';

// Use Cases
import {
  CreateLocationUseCase,
  GetLocationUseCase,
  ListLocationsUseCase,
  CreateDeviceUseCase,
  GetDeviceUseCase,
  ListDevicesUseCase
} from '../../application/device-inventory/use-cases';

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

  // Controllers
  public locationController: LocationController;
  public deviceController: DeviceController;

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

    // Initialize controllers
    this.locationController = new LocationController(
      createLocationUseCase,
      getLocationUseCase,
      listLocationsUseCase,
      this.logger
    );

    this.deviceController = new DeviceController(
      createDeviceUseCase,
      getDeviceUseCase,
      listDevicesUseCase,
      this.logger
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
