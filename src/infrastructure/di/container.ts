import { PrismaClient } from '../../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLogger } from '../logging/WinstonLogger';
//import { PrismaNetworkDeviceRepository } from '../persistence/PrismaNetworkDeviceRepository';
import { PrismaLocationRepository } from '../persistence/PrismaLocationRepository';
//import { NetworkDeviceController } from '../../presentation/http/controllers/NetworkDeviceController';
import { LocationController } from '../../presentation/http/controllers/LocationController';

// Use Cases
//import { CreateNetworkDeviceUseCase } from '../../application/device-inventory/use-cases/CreateNetworkDeviceUseCase';
import { CreateLocationUseCase } from '../../application/device-inventory/use-cases/CreateLocationUseCase';
import { GetLocationUseCase } from '../../application/device-inventory/use-cases/GetLocationUseCase';
import { ListLocationsUseCase } from '../../application/device-inventory/use-cases/ListLocationsUseCase';

/**
 * DependencyContainer
 *
 * Simple dependency injection container for the application.
 * Provides singleton instances of all services, repositories, and controllers.
 */
export class DependencyContainer {
  private prisma: PrismaClient;
  private logger: WinstonLogger;
  // private deviceRepository: PrismaNetworkDeviceRepository;
  private locationRepository: PrismaLocationRepository;

  // Controllers
  // public networkDeviceController: NetworkDeviceController;
  public locationController: LocationController;

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
    /*this.deviceRepository = new PrismaNetworkDeviceRepository(
      this.prisma
    );*/
    this.locationRepository = new PrismaLocationRepository(
      this.prisma
    );

    // Initialize network device use cases
    /*const createDeviceUseCase = new CreateNetworkDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    /*   const getUseCase = new GetNetworkDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const getByIpUseCase = new GetNetworkDeviceByIpUseCase(
      this.deviceRepository,
      this.logger
    );
    const updateUseCase = new UpdateNetworkDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const deleteUseCase = new DeleteNetworkDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const listUseCase = new ListNetworkDevicesUseCase(
      this.deviceRepository,
      this.logger
    );
    const activateUseCase = new ActivateNetworkDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const softDeleteUseCase = new SoftDeleteNetworkDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const restoreUseCase = new RestoreNetworkDeviceUseCase(
      this.deviceRepository,
      this.logger
    );*/

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

    // Initialize controllers
    /*this.networkDeviceController = new NetworkDeviceController(
      createDeviceUseCase,
      /*     getUseCase,
      getByIpUseCase,
      updateUseCase,
      deleteUseCase,
      listUseCase,
      activateUseCase,
      softDeleteUseCase,
      restoreUseCase,*/
    //  this.logger
    //);

    this.locationController = new LocationController(
      createLocationUseCase,
      getLocationUseCase,
      listLocationsUseCase,
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
