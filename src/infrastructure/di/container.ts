import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLogger } from '../logging';
import { JwtTokenService } from '../identity/services/JwtTokenService';
import { BcryptPasswordService } from '../identity/services/BcryptPasswordService';
import { PrismaUserRepository } from '../identity/repositories/PrismaUserRepository';
import {
  PrismaCustomerRepository,
  PrismaServicePlanRepository,
  PrismaContractedServiceRepository
} from '../customers';
import {
  PrismaBillRepository,
  PdfKitBillPdfRenderer
} from '../billing';
import { LoginUseCase } from 'application/identity/use-cases/LoginUseCase';
import { AuthController } from 'presentation/http/controllers/AuthController';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import {
  PrismaLocationRepository,
  PrismaDeviceRepository,
  PrismaDeviceModelRepository,
  PrismaVendorRepository,
  PrismaPollingConfigurationRepository,
  PrismaPingResultRepository,
  PrismaDeviceStateRepository,
  PrismaAlertRepository,
  PrismaDeviceCredentialsRepository
} from '../persistence/';
import {
  LocationController,
  DeviceController,
  DeviceModelController,
  VendorController,
  PollingController,
  AlertController,
  ScanController,
  WirelessController,
  CredentialsController,
  CustomerController,
  ServicePlanController,
  ContractedServiceController,
  BillController,
  EnforcementController
} from 'presentation/http/controllers';
import {
  CreateCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
  DeleteCustomerUseCase,
  CreateServicePlanUseCase,
  GetServicePlanUseCase,
  ListServicePlansUseCase,
  UpdateServicePlanUseCase,
  DeleteServicePlanUseCase,
  CreateContractedServiceUseCase,
  GetContractedServiceUseCase,
  ListContractedServicesUseCase,
  UpdateContractedServiceUseCase,
  DeleteContractedServiceUseCase
} from 'application/customers/use-cases';
import {
  GenerateBillUseCase,
  GenerateBillsForPeriodUseCase,
  GetBillUseCase,
  GetBillPdfUseCase,
  ListBillsUseCase,
  MarkBillPaidUseCase,
  MarkBillOverdueUseCase,
  CancelBillUseCase
} from 'application/billing/use-cases';
import {
  PrismaWirelessSnapshotRepository,
  PrismaWirelessAlertRecordRepository,
  PrismaWirelessDeviceConfigRepository,
  AirOsHttpClient,
  UbiquitiHttpCollector,
  WirelessPollingOrchestrator
} from '../wireless-monitoring';
import { WirelessDeviceRepositoryAdapter } from '../wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { WirelessAlertEvaluator } from 'domain/wireless-monitoring/services';
import { SignalStrengthRule } from 'domain/wireless-monitoring/services/rules/SignalStrengthRule';
import { SnrRule } from 'domain/wireless-monitoring/services/rules/SnrRule';
import { CcqRule } from 'domain/wireless-monitoring/services/rules/CcqRule';
import { CpuMemoryRule } from 'domain/wireless-monitoring/services/rules/CpuMemoryRule';
import { LanHealthRule } from 'domain/wireless-monitoring/services/rules/LanHealthRule';
import { ClientCountRule } from 'domain/wireless-monitoring/services/rules/ClientCountRule';
import { CapacityRule } from 'domain/wireless-monitoring/services/rules/CapacityRule';
import { DistanceRule } from 'domain/wireless-monitoring/services/rules/DistanceRule';
import { IdentityChangeRule } from 'domain/wireless-monitoring/services/rules/IdentityChangeRule';
import { FirmwareRule } from 'domain/wireless-monitoring/services/rules/FirmwareRule';
import { ThroughputSaturationRule } from 'domain/wireless-monitoring/services/rules/ThroughputSaturationRule';
import { ClockSyncRule } from 'domain/wireless-monitoring/services/rules/ClockSyncRule';
import { LatencyRule } from 'domain/wireless-monitoring/services/rules/LatencyRule';
import {
  PollWirelessDeviceUseCase,
  GetWirelessDeviceStatusUseCase,
  GetWirelessDeviceHistoryUseCase,
  GetWirelessClientsUseCase,
  GetActiveWirelessAlertsUseCase,
  GetWirelessAlertHistoryUseCase,
  TriggerWirelessPollUseCase,
  RebootWirelessDeviceUseCase,
  CreateWirelessConfigUseCase,
  GetWirelessConfigUseCase,
  UpdateWirelessConfigUseCase,
  DeleteWirelessConfigUseCase
} from 'application/wireless-monitoring/use-cases';
import {
  SetDeviceCredentialsUseCase,
  GetDeviceCredentialsUseCase,
  DeleteDeviceCredentialsUseCase,
  GetMapLocationsUseCase,
  DeleteLocationUseCase
} from 'application/device-inventory/use-cases';
import { PingService } from '../monitoring/ping';
import { ProbeHealthReporter } from '../monitoring/health';
import {
  ArpService,
  NetworkScannerService
} from '../monitoring/network-scanner';
import { PollingOrchestrator } from '../monitoring/orchestrator';
import {
  TelegramNotificationService,
  WhatsAppNotificationService,
  WirelessAlertNotifier
} from '../notifications';
import {
  RouterOsQueueService,
  SuspensionReconciliationOrchestrator
} from '../service-enforcement';
import { EnforcementRouterResolver } from 'application/service-enforcement/services';
import {
  EnforceSuspensionUseCase,
  ReleaseSuspensionUseCase,
  ListSuspensionEnforcementsUseCase,
  GetServiceEnforcementStatusUseCase
} from 'application/service-enforcement/use-cases';
import { ContractedServiceStatusChangedEnforcementHandler } from 'application/service-enforcement/event-handlers';
import { EventDispatcher } from 'domain/shared/core';
import { ContractedServiceStatusChangedEvent } from 'domain/customers/events';
import {
  DeviceCreatedEvent,
  DeviceStatusChangedEvent,
  DeviceMonitoringToggledEvent,
  DeviceDetailsUpdatedEvent
} from 'domain/device-inventory/events';
import {
  DeviceWentOfflineEvent,
  DeviceCameOnlineEvent
} from 'domain/device-monitoring/events';
import {
  DeviceProvisionedHandler,
  DeviceStatusChangedHandler,
  DeviceMonitoringToggledHandler,
  DeviceIPAddressChangedHandler
} from 'application/device-monitoring/event-handlers';
import {
  SendDeviceDownAlertUseCase,
  SendDeviceRecoveryAlertUseCase,
  ListAlertsUseCase,
  PurgeOldAlertsUseCase,
  SendSuspensionNoticeUseCase,
  SendAlertNotificationUseCase
} from 'application/notifications/use-cases';
import {
  DeviceWentOfflineNotificationHandler,
  DeviceCameOnlineNotificationHandler,
  ContractedServiceSuspendedNotificationHandler
} from 'application/notifications/event-handlers';
import { WirelessAlertClearedNotificationHandler } from 'application/wireless-monitoring/event-handlers';
import { WirelessAlertClearedEvent } from 'domain/wireless-monitoring/events';

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
  CreateDevicePollingUseCase,
  PurgeOldPingResultsUseCase
} from '../../application/device-monitoring/use-cases';
import {
  PurgeOldWirelessSnapshotsUseCase,
  PurgeOldWirelessAlertRecordsUseCase
} from 'application/wireless-monitoring/use-cases';
import { DataRetentionOrchestrator } from '../retention/DataRetentionOrchestrator';
import { TriggerDataRetentionUseCase } from 'application/shared/use-cases/TriggerDataRetentionUseCase';
import { AdminController } from 'presentation/http/controllers/AdminController';

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
  private wirelessDeviceConfigRepository: PrismaWirelessDeviceConfigRepository;
  private deviceCredentialsRepository: PrismaDeviceCredentialsRepository;

  // Customers
  public customerRepository: PrismaCustomerRepository;
  public servicePlanRepository: PrismaServicePlanRepository;
  public contractedServiceRepository: PrismaContractedServiceRepository;

  // Billing
  public billRepository: PrismaBillRepository;

  // Identity
  public tokenService: ITokenService;
  public authController: AuthController;

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
  public customerController: CustomerController;
  public servicePlanController: ServicePlanController;
  public contractedServiceController: ContractedServiceController;
  public billController: BillController;
  public enforcementController: EnforcementController;

  // Orchestrators (lifecycle managed by main.ts)
  public pollingOrchestrator: PollingOrchestrator;
  public wirelessPollingOrchestrator: WirelessPollingOrchestrator;
  public dataRetentionOrchestrator: DataRetentionOrchestrator;
  // null when ENFORCEMENT_ROUTER_DEVICE_ID is not configured
  public suspensionReconciliationOrchestrator: SuspensionReconciliationOrchestrator | null =
    null;

  // Admin
  public adminController: AdminController;

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
    this.wirelessDeviceConfigRepository =
      new PrismaWirelessDeviceConfigRepository(this.prisma);

    // =====================================
    // CUSTOMERS BOUNDED CONTEXT
    // =====================================

    this.customerRepository = new PrismaCustomerRepository(
      this.prisma
    );
    this.servicePlanRepository = new PrismaServicePlanRepository(
      this.prisma
    );
    this.contractedServiceRepository =
      new PrismaContractedServiceRepository(this.prisma);

    this.customerController = new CustomerController(
      new CreateCustomerUseCase(this.customerRepository, this.logger),
      new GetCustomerUseCase(this.customerRepository, this.logger),
      new ListCustomersUseCase(this.customerRepository, this.logger),
      new UpdateCustomerUseCase(this.customerRepository, this.logger),
      new DeleteCustomerUseCase(
        this.customerRepository,
        this.contractedServiceRepository,
        this.logger
      ),
      this.logger
    );

    this.servicePlanController = new ServicePlanController(
      new CreateServicePlanUseCase(
        this.servicePlanRepository,
        this.logger
      ),
      new GetServicePlanUseCase(
        this.servicePlanRepository,
        this.logger
      ),
      new ListServicePlansUseCase(
        this.servicePlanRepository,
        this.logger
      ),
      new UpdateServicePlanUseCase(
        this.servicePlanRepository,
        this.logger
      ),
      new DeleteServicePlanUseCase(
        this.servicePlanRepository,
        this.contractedServiceRepository,
        this.logger
      ),
      this.logger
    );

    this.contractedServiceController =
      new ContractedServiceController(
        new CreateContractedServiceUseCase(
          this.contractedServiceRepository,
          this.customerRepository,
          this.servicePlanRepository,
          this.logger
        ),
        new GetContractedServiceUseCase(
          this.contractedServiceRepository,
          this.logger
        ),
        new ListContractedServicesUseCase(
          this.contractedServiceRepository,
          this.logger
        ),
        new UpdateContractedServiceUseCase(
          this.contractedServiceRepository,
          this.servicePlanRepository,
          this.logger
        ),
        new DeleteContractedServiceUseCase(
          this.contractedServiceRepository,
          this.logger
        ),
        this.logger
      );

    // =====================================
    // BILLING BOUNDED CONTEXT
    // =====================================

    this.billRepository = new PrismaBillRepository(this.prisma);

    const generateBillUseCase = new GenerateBillUseCase(
      this.billRepository,
      this.customerRepository,
      this.contractedServiceRepository,
      this.servicePlanRepository,
      this.logger
    );

    this.billController = new BillController(
      generateBillUseCase,
      new GenerateBillsForPeriodUseCase(
        generateBillUseCase,
        this.billRepository,
        this.contractedServiceRepository,
        this.logger
      ),
      new ListBillsUseCase(this.billRepository, this.logger),
      new GetBillUseCase(this.billRepository, this.logger),
      new GetBillPdfUseCase(
        this.billRepository,
        this.customerRepository,
        new PdfKitBillPdfRenderer(),
        this.logger
      ),
      new MarkBillPaidUseCase(this.billRepository, this.logger),
      new MarkBillOverdueUseCase(this.billRepository, this.logger),
      new CancelBillUseCase(this.billRepository, this.logger),
      this.logger
    );

    // =====================================
    // IDENTITY BOUNDED CONTEXT
    // =====================================

    const jwtTokenService = new JwtTokenService();
    const bcryptPasswordService = new BcryptPasswordService();
    const userRepository = new PrismaUserRepository(this.prisma);
    const loginUseCase = new LoginUseCase(
      userRepository,
      bcryptPasswordService,
      jwtTokenService,
      this.logger
    );

    this.tokenService = jwtTokenService;
    this.authController = new AuthController(
      loginUseCase,
      this.logger
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
    const getMapLocationsUseCase = new GetMapLocationsUseCase(
      this.locationRepository,
      this.deviceRepository,
      this.logger
    );
    const deleteLocationUseCase = new DeleteLocationUseCase(
      this.locationRepository,
      this.deviceRepository,
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
      this.deviceRepository,
      this.wirelessDeviceConfigRepository,
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
      getMapLocationsUseCase,
      deleteLocationUseCase,
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

    const probeHealthReporter = new ProbeHealthReporter(this.logger);

    const executePollingCycleUseCase = new ExecutePollingCycleUseCase(
      this.pollingConfigRepository,
      this.pingResultRepository,
      this.deviceStateRepository,
      pingService,
      this.logger,
      undefined,
      probeHealthReporter
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
      { maxConcurrentPolls: 50, checkIntervalMs: 1_000 },
      this.logger
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
    const sendAlertNotificationUseCase =
      new SendAlertNotificationUseCase(
        this.deviceRepository,
        telegramNotificationService,
        this.logger
      );

    // Wireless alert delivery is independently disableable so wireless
    // polling can run without paging anyone.
    const wirelessAlertNotifier =
      process.env.WIRELESS_ALERT_NOTIFICATIONS_ENABLED === 'false'
        ? null
        : new WirelessAlertNotifier(sendAlertNotificationUseCase);
    if (!wirelessAlertNotifier) {
      this.logger.warn(
        'WIRELESS_ALERT_NOTIFICATIONS_ENABLED=false — wireless alert notifications disabled'
      );
    }
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
    this.deviceCredentialsRepository =
      new PrismaDeviceCredentialsRepository(this.prisma);

    const airOsHttpClient = new AirOsHttpClient(10_000, this.logger);
    const httpCollector = new UbiquitiHttpCollector(airOsHttpClient);
    const alertEvaluator = new WirelessAlertEvaluator([
      new SignalStrengthRule(),
      new SnrRule(),
      new CcqRule(),
      new CpuMemoryRule(),
      new LanHealthRule(),
      new ClientCountRule(),
      new CapacityRule(),
      new DistanceRule(),
      new IdentityChangeRule(),
      new FirmwareRule(),
      new ThroughputSaturationRule(),
      new ClockSyncRule(),
      new LatencyRule()
    ]);
    const wirelessDeviceRepo = new WirelessDeviceRepositoryAdapter(
      this.deviceRepository
    );

    const pollWirelessDeviceUseCase = new PollWirelessDeviceUseCase(
      this.wirelessDeviceConfigRepository,
      this.wirelessSnapshotRepository,
      this.wirelessAlertRecordRepository,
      this.deviceCredentialsRepository,
      httpCollector,
      alertEvaluator,
      wirelessDeviceRepo,
      wirelessAlertNotifier,
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
    const rebootWirelessDeviceUseCase =
      new RebootWirelessDeviceUseCase(
        this.wirelessDeviceConfigRepository,
        this.deviceCredentialsRepository,
        httpCollector,
        this.logger
      );
    const createWirelessConfigUseCase =
      new CreateWirelessConfigUseCase(
        this.deviceRepository,
        this.deviceModelRepository,
        this.wirelessDeviceConfigRepository,
        this.logger
      );
    const getWirelessConfigUseCase = new GetWirelessConfigUseCase(
      this.wirelessDeviceConfigRepository,
      this.logger
    );
    const updateWirelessConfigUseCase =
      new UpdateWirelessConfigUseCase(
        this.wirelessDeviceConfigRepository,
        this.logger
      );
    const deleteWirelessConfigUseCase =
      new DeleteWirelessConfigUseCase(
        this.wirelessDeviceConfigRepository,
        this.logger
      );

    this.wirelessController = new WirelessController(
      getWirelessDeviceStatusUseCase,
      getWirelessDeviceHistoryUseCase,
      getWirelessClientsUseCase,
      getActiveWirelessAlertsUseCase,
      getWirelessAlertHistoryUseCase,
      triggerWirelessPollUseCase,
      rebootWirelessDeviceUseCase,
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
        this.wirelessDeviceConfigRepository,
        pollWirelessDeviceUseCase,
        { maxConcurrentPolls: 50 },
        this.logger
      );

    // =====================================
    // DATA RETENTION
    // =====================================

    const purgeOldPingResultsUseCase = new PurgeOldPingResultsUseCase(
      this.pingResultRepository
    );
    const purgeOldAlertsUseCase = new PurgeOldAlertsUseCase(
      this.alertRepository
    );
    const purgeOldWirelessSnapshotsUseCase =
      new PurgeOldWirelessSnapshotsUseCase(
        this.wirelessSnapshotRepository
      );
    const purgeOldWirelessAlertRecordsUseCase =
      new PurgeOldWirelessAlertRecordsUseCase(
        this.wirelessAlertRecordRepository
      );

    const retentionConfig = {
      pingResultRetentionDays: parseInt(
        process.env.PING_RESULT_RETENTION_DAYS ?? '30',
        10
      ),
      wirelessSnapshotRetentionDays: parseInt(
        process.env.WIRELESS_SNAPSHOT_RETENTION_DAYS ?? '30',
        10
      ),
      alertRetentionDays: parseInt(
        process.env.ALERT_RETENTION_DAYS ?? '90',
        10
      ),
      wirelessAlertRecordRetentionDays: parseInt(
        process.env.WIRELESS_ALERT_RECORD_RETENTION_DAYS ?? '90',
        10
      )
    };

    const triggerDataRetentionUseCase =
      new TriggerDataRetentionUseCase(
        purgeOldPingResultsUseCase,
        purgeOldAlertsUseCase,
        purgeOldWirelessSnapshotsUseCase,
        purgeOldWirelessAlertRecordsUseCase,
        retentionConfig
      );

    this.adminController = new AdminController(
      triggerDataRetentionUseCase,
      this.logger
    );

    this.dataRetentionOrchestrator = new DataRetentionOrchestrator(
      purgeOldPingResultsUseCase,
      purgeOldAlertsUseCase,
      purgeOldWirelessSnapshotsUseCase,
      purgeOldWirelessAlertRecordsUseCase,
      retentionConfig,
      this.logger
    );

    EventDispatcher.setErrorReporter((eventClassName, error) =>
      this.logger.error(
        `Unhandled error in domain event handler`,
        error,
        { event: eventClassName }
      )
    );

    // Register cross-context event handlers
    EventDispatcher.register(
      DeviceCreatedEvent.name,
      new DeviceProvisionedHandler(
        this.pollingConfigRepository,
        this.logger
      )
    );
    EventDispatcher.register(
      DeviceStatusChangedEvent.name,
      new DeviceStatusChangedHandler(
        this.pollingConfigRepository,
        this.logger
      )
    );
    EventDispatcher.register(
      DeviceMonitoringToggledEvent.name,
      new DeviceMonitoringToggledHandler(
        this.pollingConfigRepository,
        this.logger
      )
    );
    EventDispatcher.register(
      DeviceDetailsUpdatedEvent.name,
      new DeviceIPAddressChangedHandler(
        this.pollingConfigRepository,
        this.logger
      )
    );
    EventDispatcher.register(
      DeviceWentOfflineEvent.name,
      new DeviceWentOfflineNotificationHandler(
        sendDeviceDownAlertUseCase,
        this.logger
      )
    );
    EventDispatcher.register(
      DeviceCameOnlineEvent.name,
      new DeviceCameOnlineNotificationHandler(
        sendDeviceRecoveryAlertUseCase,
        this.logger
      )
    );

    if (wirelessAlertNotifier) {
      EventDispatcher.register(
        WirelessAlertClearedEvent.name,
        new WirelessAlertClearedNotificationHandler(
          wirelessAlertNotifier,
          this.logger
        )
      );
    }

    // WhatsApp suspension notices are optional — existing deployments
    // without the env vars must keep booting.
    if (
      process.env.WHATSAPP_ACCESS_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_TEMPLATE_NAME
    ) {
      const whatsAppNotificationService =
        new WhatsAppNotificationService();
      const sendSuspensionNoticeUseCase =
        new SendSuspensionNoticeUseCase(
          this.contractedServiceRepository,
          this.customerRepository,
          whatsAppNotificationService,
          this.logger
        );
      EventDispatcher.register(
        ContractedServiceStatusChangedEvent.name,
        new ContractedServiceSuspendedNotificationHandler(
          sendSuspensionNoticeUseCase,
          this.logger
        )
      );
    } else {
      this.logger.warn(
        'WhatsApp env vars not set — suspension notices disabled'
      );
    }

    // MikroTik suspension enforcement is optional — existing deployments
    // without an enforcement router must keep booting.
    const enforcementRouterDeviceId =
      process.env.ENFORCEMENT_ROUTER_DEVICE_ID;
    if (enforcementRouterDeviceId) {
      const routerResolver = new EnforcementRouterResolver(
        this.deviceRepository,
        this.deviceCredentialsRepository,
        {
          routerDeviceId: enforcementRouterDeviceId,
          apiPort: Number(
            process.env.ENFORCEMENT_ROUTER_API_PORT ?? 8728
          )
        }
      );
      const routerQueueService = new RouterOsQueueService(
        this.logger
      );
      const enforceSuspensionUseCase = new EnforceSuspensionUseCase(
        this.contractedServiceRepository,
        this.deviceRepository,
        routerResolver,
        routerQueueService,
        this.logger
      );
      const releaseSuspensionUseCase = new ReleaseSuspensionUseCase(
        routerResolver,
        routerQueueService,
        this.logger
      );
      EventDispatcher.register(
        ContractedServiceStatusChangedEvent.name,
        new ContractedServiceStatusChangedEnforcementHandler(
          enforceSuspensionUseCase,
          releaseSuspensionUseCase,
          this.logger
        )
      );
      this.suspensionReconciliationOrchestrator =
        new SuspensionReconciliationOrchestrator(
          this.contractedServiceRepository,
          this.deviceRepository,
          routerResolver,
          routerQueueService,
          {
            checkIntervalMs: Number(
              process.env.SUSPENSION_RECONCILE_INTERVAL_MS ?? 60_000
            )
          },
          this.logger
        );
      this.enforcementController = new EnforcementController(
        new ListSuspensionEnforcementsUseCase(
          routerResolver,
          routerQueueService,
          this.logger
        ),
        new GetServiceEnforcementStatusUseCase(
          routerResolver,
          routerQueueService,
          this.logger
        ),
        this.logger
      );
    } else {
      this.logger.warn(
        'ENFORCEMENT_ROUTER_DEVICE_ID not set — suspension enforcement disabled'
      );
      // routes stay mounted; endpoints answer 503 until configured
      this.enforcementController = new EnforcementController(
        null,
        null,
        this.logger
      );
    }
  }

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

  public getPrisma(): PrismaClient {
    return this.prisma;
  }

  public getLogger(): WinstonLogger {
    return this.logger;
  }
}

export async function setupDependencies(): Promise<DependencyContainer> {
  const container = new DependencyContainer();
  await container.connect();
  return container;
}
