import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLogger } from '../logging';
import { PrismaAgentRepository } from '../probe-agents/repositories';
import { NodeAgentSecretService } from '../probe-agents/crypto';
import { loadAgentPublicUrl } from '../probe-agents/config';
import {
  PrismaAgentAssignmentQuery,
  PrismaAgentDeviceIndex,
  PrismaAgentPollingTargetsQuery,
  PrismaAgentDeviceCountQuery,
  PrismaAgentStatusQuery
} from '../probe-agents/queries';
import { DeviceMonitoringPingResultSink } from '../probe-agents/adapters';
import { AgentGateway } from '../../presentation/ws/agent';
import {
  CreateAgentUseCase,
  ListAgentsUseCase,
  GetAgentUseCase,
  ReissuePairingKeyUseCase,
  RevokeAgentUseCase,
  EnrollAgentUseCase,
  AuthenticateAgentUseCase,
  RecordAgentContactUseCase,
  BuildAgentConfigSnapshotUseCase,
  AcceptAgentResultsUseCase,
  MarkSilentAgentsOfflineUseCase
} from '../../application/probe-agents/use-cases';
import { AgentLivenessOrchestrator } from '../probe-agents/orchestrator';
import { loadSubscriptionTerms } from './subscriptionTerms';
import {
  SubscriptionJobSupervisor,
  SupervisedJob
} from '../installation';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';
import {
  AgentWentOfflineEvent,
  AgentCameBackEvent,
  AgentClockDriftedEvent,
  AgentClockCorrectedEvent
} from 'domain/probe-agents/events';
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
  PdfKitBillPdfRenderer,
  PrismaCollectionAccountRepository,
  PrismaBankAccountRepository,
  PdfKitCollectionAccountPdfRenderer
} from '../billing';
import {
  PrismaQuotationRepository,
  PdfKitQuotationPdfRenderer,
  HttpImageFetcher
} from '../quoting';
import { LoginUseCase } from 'application/identity/use-cases/LoginUseCase';
import { AuthController } from 'presentation/http/controllers/AuthController';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import {
  PrismaLocationRepository,
  PrismaDeviceRepository,
  PrismaDeviceListQuery,
  PrismaDeviceModelRepository,
  PrismaVendorRepository,
  PrismaPollingConfigurationRepository,
  PrismaPingResultRepository,
  PrismaDeviceStateRepository,
  PrismaAlertRepository,
  PrismaAlertListQuery,
  PrismaDeviceCredentialsRepository,
  PrismaDeviceNotificationPolicyRepository,
  PrismaMutedAlertTypeRepository
} from '../persistence/';
import {
  LocationController,
  DeviceController,
  DeviceModelController,
  VendorController,
  PollingController,
  NotificationPolicyController,
  NotificationMuteController,
  AlertController,
  ScanController,
  WirelessController,
  WirelessStreamController,
  LinkDiagnosisController,
  CredentialsController,
  CustomerController,
  ServicePlanController,
  ContractedServiceController,
  BillController,
  CollectionAccountController,
  BankAccountController,
  AgentController,
  AgentEnrollmentController,
  SubscriptionController,
  QuotationController,
  EnforcementController,
  TicketController,
  TechnicianController
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
  CancelBillUseCase,
  CreateCollectionAccountUseCase,
  ListCollectionAccountsUseCase,
  GetCollectionAccountUseCase,
  GetCollectionAccountPdfUseCase,
  MarkCollectionAccountPaidUseCase,
  CancelCollectionAccountUseCase,
  CreateBankAccountUseCase,
  ListBankAccountsUseCase,
  GetBankAccountUseCase,
  UpdateBankAccountUseCase,
  DeleteBankAccountUseCase
} from 'application/billing/use-cases';
import {
  CreateQuotationUseCase,
  UpdateQuotationLineItemsUseCase,
  UpdateQuotationDetailsUseCase,
  SendQuotationUseCase,
  AcceptQuotationUseCase,
  RejectQuotationUseCase,
  MarkQuotationExpiredUseCase,
  GetQuotationUseCase,
  ListQuotationsUseCase,
  GetQuotationPdfUseCase
} from 'application/quoting/use-cases';
import {
  PrismaWirelessSnapshotRepository,
  PrismaWirelessAlertRecordRepository,
  PrismaWirelessDeviceConfigRepository,
  AirOsHttpClient,
  UbiquitiHttpCollector,
  SnmpClient,
  MimosaSnmpCollector,
  WirelessCollectorRegistry,
  WirelessPollingOrchestrator,
  LinkDiagnosisRunner
} from '../wireless-monitoring';
import { WirelessDeviceRepositoryAdapter } from '../wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { DeviceReachAdapter } from '../wireless-monitoring/adapters/DeviceReachAdapter';
import { ContractedCapacityAdapter } from '../wireless-monitoring/adapters/ContractedCapacityAdapter';
import { DeviceVendorAdapter } from '../wireless-monitoring/adapters/DeviceVendorAdapter';
import {
  WirelessAlertEvaluator,
  LinkDiagnosisAnalyzer
} from 'domain/wireless-monitoring/services';
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
  GetApExpectedClientsUseCase,
  GetDeviceIdentitySuggestionsUseCase,
  GetActiveWirelessAlertsUseCase,
  GetWirelessAlertHistoryUseCase,
  TriggerWirelessPollUseCase,
  RebootWirelessDeviceUseCase,
  CreateWirelessConfigUseCase,
  GetWirelessConfigUseCase,
  GetWirelessThroughputUseCase,
  GetFleetWirelessThroughputUseCase,
  UpdateWirelessConfigUseCase,
  DeleteWirelessConfigUseCase,
  ClearWirelessAlertUseCase,
  BulkClearWirelessAlertsUseCase,
  StartLinkDiagnosisUseCase,
  GetLinkDiagnosisUseCase,
  StopLinkDiagnosisUseCase
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
  AlertPublisher,
  QuietHoursAlertPublisher,
  MutedTypeAlertPublisher,
  AlertRecorder,
  FanOutAlertPublisher,
  InstallLabelAlertPublisher,
  SubscriptionAlertPublisher
} from '../notifications';
import {
  OverdueDeviceDownAlertOrchestrator,
  SubscriptionReminderOrchestrator
} from '../notifications/orchestrator';
import {
  RouterOsQueueService,
  SuspensionReconciliationOrchestrator
} from '../service-enforcement';
import {
  PrismaTicketRepository,
  PrismaTechnicianRepository
} from '../tickets/repositories';
import {
  CustomerDirectoryAdapter,
  DeviceDirectoryAdapter,
  TicketOpenerAdapter,
  TechnicianNotifierAdapter
} from '../tickets/adapters';
import {
  CreateTicketUseCase,
  GetTicketUseCase,
  ListTicketsUseCase,
  GetTechnicianDayUseCase,
  UpdateTicketUseCase,
  AssignTicketUseCase,
  ScheduleTicketUseCase,
  StartTicketUseCase,
  ResolveTicketUseCase,
  CancelTicketUseCase,
  DeleteTicketUseCase,
  OpenTicketFromAlertUseCase,
  CreateTechnicianUseCase,
  GetTechnicianUseCase,
  ListTechniciansUseCase,
  UpdateTechnicianUseCase,
  DeleteTechnicianUseCase
} from 'application/tickets/use-cases';
import { TicketAssignedNotificationHandler } from 'application/tickets/event-handlers';
import { TicketAssignedEvent } from 'domain/tickets/events';
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
  DeviceDetailsUpdatedEvent,
  DeviceDeletedEvent
} from 'domain/device-inventory/events';
import { DeviceEligibilityService } from 'domain/device-inventory/services';
import {
  DeviceCameOnlineEvent,
  DeviceWentOfflineEvent
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
  GetAlertByIdUseCase,
  DeleteAlertUseCase,
  OpenAlertUseCase,
  ResolveAlertUseCase,
  ClearAlertUseCase,
  BulkClearAlertsUseCase,
  BulkDeleteAlertsUseCase,
  PurgeOldAlertsUseCase,
  SendSuspensionNoticeUseCase,
  SendAlertNotificationUseCase,
  RaiseOverdueDeviceDownAlertsUseCase,
  GetDeviceNotificationPolicyUseCase,
  UpsertDeviceNotificationPolicyUseCase,
  DeleteDeviceNotificationPolicyUseCase,
  BulkUpsertDeviceNotificationPoliciesUseCase,
  GetMutedAlertTypesUseCase,
  SetMutedAlertTypesUseCase,
  SendSubscriptionReminderUseCase
} from 'application/notifications/use-cases';
import {
  DeviceCameOnlineNotificationHandler,
  DeviceWentOfflineAlertRecordHandler,
  ContractedServiceSuspendedNotificationHandler,
  AgentWentOfflineNotificationHandler,
  AgentCameBackNotificationHandler,
  AgentClockDriftedNotificationHandler,
  AgentClockCorrectedNotificationHandler
} from 'application/notifications/event-handlers';
import {
  WirelessAlertClearedNotificationHandler,
  WirelessAlertTriggeredAlertRecordHandler,
  WirelessAlertClearedAlertRecordHandler,
  DeviceDeletedWirelessConfigHandler,
  DeviceStatusChangedWirelessConfigHandler,
  WirelessSnapshotCreatedThroughputHandler
} from 'application/wireless-monitoring/event-handlers';
import {
  WirelessAlertClearedEvent,
  WirelessAlertTriggeredEvent,
  WirelessSnapshotCreatedEvent
} from 'domain/wireless-monitoring/events';
import { SseBroadcaster } from '../realtime/SseBroadcaster';

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
  RestoreDeviceUseCase,
  ReplaceDeviceUseCase,
  SwapDeviceHardwareUseCase,
  PermanentlyDeleteDeviceUseCase,
  PurgeDeletedDevicesUseCase,
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
  ScanNetworkSegmentUseCase,
  AssignDevicesToAgentUseCase
} from '../../application/device-inventory/use-cases';
import { AgentAssignmentPolicy } from '../../application/device-inventory/services';
import {
  ExecutePollingCycleUseCase,
  IngestPingResultsUseCase,
  ConfigureDevicePollingUseCase,
  GetDevicePollingStatusUseCase,
  GetDevicePollingHistoryUseCase,
  DeleteDevicePingHistoryUseCase,
  CreateDevicePollingUseCase,
  PurgeOldPingResultsUseCase,
  SuspendDeviceMonitoringUseCase
} from '../../application/device-monitoring/use-cases';
import { PingCycleProbe } from '../../application/device-monitoring/services';
import {
  PurgeOldWirelessSnapshotsUseCase,
  PurgeOldWirelessAlertRecordsUseCase
} from 'application/wireless-monitoring/use-cases';
import { DataRetentionOrchestrator } from '../retention/DataRetentionOrchestrator';
import { TriggerDataRetentionUseCase } from 'application/shared/use-cases/TriggerDataRetentionUseCase';
import { AdminController } from 'presentation/http/controllers/AdminController';
import { loadCollectionAccountIssuerConfig } from '../billing/config/collectionAccountIssuerConfig';
import { EnabledModules } from './enabledModules';
import { loadServerOnSite } from './serverOnSite';

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
  private deviceNotificationPolicyRepository: PrismaDeviceNotificationPolicyRepository;
  private mutedAlertTypeRepository: PrismaMutedAlertTypeRepository;

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
  public collectionAccountRepository: PrismaCollectionAccountRepository;
  public bankAccountRepository: PrismaBankAccountRepository;

  // Quoting
  public quotationRepository: PrismaQuotationRepository;

  public ticketRepository: PrismaTicketRepository;
  public technicianRepository: PrismaTechnicianRepository;
  // undefined when tickets are disabled — alerts then open no tickets
  private ticketOpener: TicketOpenerAdapter | undefined;

  // Identity
  public tokenService: ITokenService;
  public authController: AuthController;

  // Controllers
  public locationController: LocationController;
  public deviceController: DeviceController;
  public deviceModelController: DeviceModelController;
  public vendorController: VendorController;
  public pollingController: PollingController;
  public notificationPolicyController: NotificationPolicyController;
  public notificationMuteController: NotificationMuteController;
  public agentController: AgentController;
  public subscriptionController: SubscriptionController;
  public getSubscriptionStatusUseCase: GetSubscriptionStatusUseCase;
  public agentEnrollmentController: AgentEnrollmentController;
  // Attached to the HTTP server by main.ts, once it is listening.
  public agentGateway: AgentGateway;
  public alertController: AlertController;
  public scanController: ScanController;
  public wirelessController: WirelessController;
  public wirelessStreamController: WirelessStreamController;
  public linkDiagnosisController: LinkDiagnosisController;
  public credentialsController: CredentialsController;
  public customerController: CustomerController | null = null;
  public ticketController: TicketController | null = null;
  public technicianController: TechnicianController | null = null;
  public servicePlanController: ServicePlanController | null = null;
  public contractedServiceController: ContractedServiceController | null =
    null;
  public billController: BillController | null = null;
  public collectionAccountController: CollectionAccountController | null =
    null;
  public bankAccountController: BankAccountController | null = null;
  public quotationController: QuotationController | null = null;
  public enforcementController: EnforcementController | null = null;

  // Orchestrators (lifecycle managed by main.ts)
  public pollingOrchestrator: PollingOrchestrator;
  public wirelessPollingOrchestrator: WirelessPollingOrchestrator;
  // lifecycle managed by main.ts — live diagnosis timers must stop on shutdown
  public linkDiagnosisRunner: LinkDiagnosisRunner;
  public dataRetentionOrchestrator: DataRetentionOrchestrator;
  public overdueDeviceDownAlertOrchestrator: OverdueDeviceDownAlertOrchestrator;
  public agentLivenessOrchestrator: AgentLivenessOrchestrator;
  public subscriptionJobSupervisor: SubscriptionJobSupervisor;
  public subscriptionReminderOrchestrator: SubscriptionReminderOrchestrator;
  // null when the enforcement module is off or has no router configured
  public suspensionReconciliationOrchestrator: SuspensionReconciliationOrchestrator | null =
    null;

  // Admin
  public adminController: AdminController;

  // SSE hub (lifecycle managed by main.ts — open streams block shutdown)
  public eventStreamHub: SseBroadcaster;

  // Optional modules' controllers stay null when the module is disabled, and
  // their routes are then never mounted. Their repositories are still built:
  // the schema is the same in every install, and the monitoring side reads
  // them (a device with no contract, no tickets, no plan capacity).
  constructor(
    public readonly modules: EnabledModules = EnabledModules.parse(
      process.env.ENABLED_MODULES
    ),
    public readonly serverOnSite: boolean = loadServerOnSite(
      process.env
    )
  ) {
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
    this.logger.info(`Enabled modules: ${this.modules}`);
    this.logger.info(`Server on site: ${this.serverOnSite}`);

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
    this.deviceNotificationPolicyRepository =
      new PrismaDeviceNotificationPolicyRepository(this.prisma);
    this.mutedAlertTypeRepository =
      new PrismaMutedAlertTypeRepository(this.prisma);
    this.wirelessDeviceConfigRepository =
      new PrismaWirelessDeviceConfigRepository(
        this.prisma,
        this.serverOnSite
      );
    // Sits with the other persistence repositories rather than down in the
    // wireless block: ReplaceDeviceUseCase needs it to move credentials onto
    // the new unit, and that is constructed well before wireless.
    this.deviceCredentialsRepository =
      new PrismaDeviceCredentialsRepository(this.prisma);

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

    if (this.modules.has('customers')) {
      this.customerController = new CustomerController(
        new CreateCustomerUseCase(
          this.customerRepository,
          this.logger
        ),
        new GetCustomerUseCase(this.customerRepository, this.logger),
        new ListCustomersUseCase(
          this.customerRepository,
          this.logger
        ),
        new UpdateCustomerUseCase(
          this.customerRepository,
          this.logger
        ),
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
    }

    // =====================================
    // BILLING BOUNDED CONTEXT
    // =====================================

    this.billRepository = new PrismaBillRepository(this.prisma);

    if (this.modules.has('billing')) {
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
    }

    this.collectionAccountRepository =
      new PrismaCollectionAccountRepository(this.prisma);
    this.bankAccountRepository = new PrismaBankAccountRepository(
      this.prisma
    );

    if (this.modules.has('billing')) {
      this.collectionAccountController =
        new CollectionAccountController(
          new CreateCollectionAccountUseCase(
            this.collectionAccountRepository,
            this.customerRepository,
            this.bankAccountRepository,
            this.logger
          ),
          new ListCollectionAccountsUseCase(
            this.collectionAccountRepository,
            this.logger
          ),
          new GetCollectionAccountUseCase(
            this.collectionAccountRepository,
            this.logger
          ),
          new GetCollectionAccountPdfUseCase(
            this.collectionAccountRepository,
            new PdfKitCollectionAccountPdfRenderer(
              loadCollectionAccountIssuerConfig(process.env)
            ),
            this.logger
          ),
          new MarkCollectionAccountPaidUseCase(
            this.collectionAccountRepository,
            this.logger
          ),
          new CancelCollectionAccountUseCase(
            this.collectionAccountRepository,
            this.logger
          ),
          this.logger
        );

      this.bankAccountController = new BankAccountController(
        new CreateBankAccountUseCase(
          this.bankAccountRepository,
          this.logger
        ),
        new ListBankAccountsUseCase(
          this.bankAccountRepository,
          this.logger
        ),
        new GetBankAccountUseCase(
          this.bankAccountRepository,
          this.logger
        ),
        new UpdateBankAccountUseCase(
          this.bankAccountRepository,
          this.logger
        ),
        new DeleteBankAccountUseCase(
          this.bankAccountRepository,
          this.logger
        ),
        this.logger
      );
    }

    // =====================================
    // QUOTING BOUNDED CONTEXT
    // =====================================

    this.quotationRepository = new PrismaQuotationRepository(
      this.prisma
    );

    if (this.modules.has('quoting')) {
      this.quotationController = new QuotationController(
        new CreateQuotationUseCase(
          this.quotationRepository,
          this.customerRepository,
          this.deviceModelRepository,
          this.logger
        ),
        new UpdateQuotationLineItemsUseCase(
          this.quotationRepository,
          this.deviceModelRepository,
          this.logger
        ),
        new UpdateQuotationDetailsUseCase(
          this.quotationRepository,
          this.logger
        ),
        new SendQuotationUseCase(
          this.quotationRepository,
          this.logger
        ),
        new AcceptQuotationUseCase(
          this.quotationRepository,
          this.logger
        ),
        new RejectQuotationUseCase(
          this.quotationRepository,
          this.logger
        ),
        new MarkQuotationExpiredUseCase(
          this.quotationRepository,
          this.logger
        ),
        new GetQuotationUseCase(
          this.quotationRepository,
          this.logger
        ),
        new ListQuotationsUseCase(
          this.quotationRepository,
          this.logger
        ),
        new GetQuotationPdfUseCase(
          this.quotationRepository,
          new PdfKitQuotationPdfRenderer(),
          new HttpImageFetcher(),
          this.logger
        ),
        this.logger
      );
    }

    // =====================================
    // TICKETS BOUNDED CONTEXT
    // =====================================

    this.ticketRepository = new PrismaTicketRepository(this.prisma);
    this.technicianRepository = new PrismaTechnicianRepository(
      this.prisma
    );

    if (this.modules.has('tickets')) {
      // Anti-corruption reads onto customers and device-inventory: a work order
      // needs a phone number and a device name, not those aggregates.
      const customerDirectory = new CustomerDirectoryAdapter(
        this.prisma
      );
      const deviceDirectory = new DeviceDirectoryAdapter(this.prisma);

      // Built here rather than inline below because the notifications context
      // needs it: OpenAlertUseCase turns a newly recorded alert into a ticket.
      this.ticketOpener = new TicketOpenerAdapter(
        new OpenTicketFromAlertUseCase(
          this.ticketRepository,
          customerDirectory,
          deviceDirectory,
          this.logger
        )
      );

      this.ticketController = new TicketController(
        new CreateTicketUseCase(
          this.ticketRepository,
          this.technicianRepository,
          customerDirectory,
          deviceDirectory,
          this.logger
        ),
        new GetTicketUseCase(
          this.ticketRepository,
          this.technicianRepository,
          customerDirectory,
          deviceDirectory,
          this.logger
        ),
        new ListTicketsUseCase(this.ticketRepository, this.logger),
        new GetTechnicianDayUseCase(
          this.ticketRepository,
          this.technicianRepository,
          customerDirectory,
          deviceDirectory,
          this.logger
        ),
        new UpdateTicketUseCase(
          this.ticketRepository,
          customerDirectory,
          deviceDirectory,
          this.logger
        ),
        new AssignTicketUseCase(
          this.ticketRepository,
          this.technicianRepository,
          this.logger
        ),
        new ScheduleTicketUseCase(this.ticketRepository, this.logger),
        new StartTicketUseCase(this.ticketRepository, this.logger),
        new ResolveTicketUseCase(this.ticketRepository, this.logger),
        new CancelTicketUseCase(this.ticketRepository, this.logger),
        new DeleteTicketUseCase(this.ticketRepository, this.logger),
        this.logger
      );

      this.technicianController = new TechnicianController(
        new CreateTechnicianUseCase(
          this.technicianRepository,
          this.logger
        ),
        new GetTechnicianUseCase(
          this.technicianRepository,
          this.logger
        ),
        new ListTechniciansUseCase(
          this.technicianRepository,
          this.logger
        ),
        new UpdateTechnicianUseCase(
          this.technicianRepository,
          this.logger
        ),
        new DeleteTechnicianUseCase(
          this.technicianRepository,
          this.ticketRepository,
          this.logger
        ),
        this.logger
      );
    }

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

    // How long a soft-deleted device stays restorable. Read once here because
    // both halves need to agree: RestoreDeviceUseCase refuses past it, and the
    // retention orchestrator hard-deletes past it.
    const deletedDeviceGraceDays = parseInt(
      process.env.DEVICE_DELETE_GRACE_DAYS ?? '7',
      10
    );

    // Initialize device use cases
    // Inventory reads agents through its own port, never the probe-agents
    // domain (ADR 0002).
    const agentAssignmentPolicy = new AgentAssignmentPolicy(
      new PrismaAgentAssignmentQuery(this.prisma)
    );
    const createDeviceUseCase = new CreateDeviceUseCase(
      this.deviceRepository,
      this.deviceModelRepository,
      this.locationRepository,
      this.logger,
      agentAssignmentPolicy
    );
    const getDeviceUseCase = new GetDeviceUseCase(
      this.deviceRepository,
      this.logger
    );
    const listDevicesUseCase = new ListDevicesUseCase(
      new PrismaDeviceListQuery(this.prisma),
      this.logger
    );
    const updateDeviceUseCase = new UpdateDeviceUseCase(
      this.deviceRepository,
      this.deviceModelRepository,
      this.locationRepository,
      this.wirelessDeviceConfigRepository,
      this.logger,
      agentAssignmentPolicy
    );
    const deleteDeviceUseCase = new DeleteDeviceUseCase(
      this.deviceRepository,
      this.contractedServiceRepository,
      this.ticketRepository,
      this.logger
    );
    const restoreDeviceUseCase = new RestoreDeviceUseCase(
      this.deviceRepository,
      this.logger,
      deletedDeviceGraceDays
    );
    const permanentlyDeleteDeviceUseCase =
      new PermanentlyDeleteDeviceUseCase(
        this.deviceRepository,
        this.logger
      );
    const replaceDeviceUseCase = new ReplaceDeviceUseCase(
      this.deviceRepository,
      this.deviceModelRepository,
      this.deviceCredentialsRepository,
      this.contractedServiceRepository,
      this.wirelessDeviceConfigRepository,
      this.logger
    );
    const swapDeviceHardwareUseCase = new SwapDeviceHardwareUseCase(
      this.deviceRepository,
      this.deviceRepository,
      this.deviceModelRepository,
      this.wirelessDeviceConfigRepository,
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
      restoreDeviceUseCase,
      replaceDeviceUseCase,
      swapDeviceHardwareUseCase,
      permanentlyDeleteDeviceUseCase,
      new AssignDevicesToAgentUseCase(
        this.deviceRepository,
        agentAssignmentPolicy,
        this.logger
      ),
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
      this.logger,
      this.serverOnSite
    );
    this.scanController = new ScanController(
      scanNetworkSegmentUseCase,
      this.logger
    );

    const probeHealthReporter = new ProbeHealthReporter(this.logger);

    // Hoisted: shared by the alert recorder below and by the monitoring
    // suspension, which closes a device's open availability alert.
    const resolveAlertUseCase = new ResolveAlertUseCase(
      this.alertRepository,
      this.logger
    );

    const suspendDeviceMonitoringUseCase =
      new SuspendDeviceMonitoringUseCase(
        this.pollingConfigRepository,
        this.deviceStateRepository,
        resolveAlertUseCase
      );

    // Shared by every guard that has to ask "may we act on this device?" —
    // the polling cycles, the wireless adapter and the alert use cases below.
    const deviceEligibilityService = new DeviceEligibilityService();

    const ingestPingResultsUseCase = new IngestPingResultsUseCase(
      this.pollingConfigRepository,
      this.pingResultRepository,
      this.deviceStateRepository,
      this.logger
    );
    const executePollingCycleUseCase = new ExecutePollingCycleUseCase(
      this.pollingConfigRepository,
      this.deviceRepository,
      deviceEligibilityService,
      new PingCycleProbe(pingService),
      ingestPingResultsUseCase,
      this.logger,
      probeHealthReporter
    );
    const configurePollingUseCase = new ConfigureDevicePollingUseCase(
      this.pollingConfigRepository,
      suspendDeviceMonitoringUseCase,
      this.logger
    );
    // R17: vendor-set terms; unset means not enforced. Read once at boot, so
    // a renewal takes a restart with the new date.
    const getSubscriptionStatusUseCase =
      (this.getSubscriptionStatusUseCase =
        new GetSubscriptionStatusUseCase(
          loadSubscriptionTerms(process.env),
          this.logger
        ));
    this.subscriptionController = new SubscriptionController(
      getSubscriptionStatusUseCase,
      this.logger
    );

    // R7: what monitoring and notifications know about agents, read-only.
    const agentStatusQuery = new PrismaAgentStatusQuery(this.prisma);
    const getPollingStatusUseCase = new GetDevicePollingStatusUseCase(
      this.pollingConfigRepository,
      this.deviceStateRepository,
      this.pingResultRepository,
      this.logger,
      agentStatusQuery
    );
    const getPollingHistoryUseCase =
      new GetDevicePollingHistoryUseCase(
        this.pingResultRepository,
        this.logger
      );
    const createDevicePollingUseCase = new CreateDevicePollingUseCase(
      this.pollingConfigRepository,
      this.deviceRepository,
      suspendDeviceMonitoringUseCase,
      this.logger
    );
    const deleteDevicePingHistoryUseCase =
      new DeleteDevicePingHistoryUseCase(
        this.pingResultRepository,
        this.logger
      );

    this.pollingController = new PollingController(
      executePollingCycleUseCase,
      getPollingStatusUseCase,
      getPollingHistoryUseCase,
      configurePollingUseCase,
      createDevicePollingUseCase,
      deleteDevicePingHistoryUseCase,
      this.logger
    );

    const getDeviceNotificationPolicyUseCase =
      new GetDeviceNotificationPolicyUseCase(
        this.deviceNotificationPolicyRepository,
        this.deviceRepository,
        this.logger
      );
    const upsertDeviceNotificationPolicyUseCase =
      new UpsertDeviceNotificationPolicyUseCase(
        this.deviceNotificationPolicyRepository,
        this.deviceRepository,
        this.logger
      );
    const deleteDeviceNotificationPolicyUseCase =
      new DeleteDeviceNotificationPolicyUseCase(
        this.deviceNotificationPolicyRepository,
        this.logger
      );
    const bulkUpsertDeviceNotificationPoliciesUseCase =
      new BulkUpsertDeviceNotificationPoliciesUseCase(
        upsertDeviceNotificationPolicyUseCase,
        this.logger
      );
    this.notificationPolicyController =
      new NotificationPolicyController(
        getDeviceNotificationPolicyUseCase,
        upsertDeviceNotificationPolicyUseCase,
        deleteDeviceNotificationPolicyUseCase,
        bulkUpsertDeviceNotificationPoliciesUseCase,
        this.logger
      );

    const getMutedAlertTypesUseCase = new GetMutedAlertTypesUseCase(
      this.mutedAlertTypeRepository,
      this.logger
    );
    const setMutedAlertTypesUseCase = new SetMutedAlertTypesUseCase(
      this.mutedAlertTypeRepository,
      this.logger
    );
    this.notificationMuteController = new NotificationMuteController(
      getMutedAlertTypesUseCase,
      setMutedAlertTypesUseCase,
      this.logger
    );

    // PROBE-AGENTS — core, like monitoring: an install without agents simply
    // has none, and AGENT_PUBLIC_URL unset only disables issuing keys.
    const agentRepository = new PrismaAgentRepository(this.prisma);
    const agentSecrets = new NodeAgentSecretService();
    const agentPublicUrl = loadAgentPublicUrl(process.env);
    const agentDeviceCounts = new PrismaAgentDeviceCountQuery(
      this.prisma
    );
    const getAgentUseCase = new GetAgentUseCase(
      agentRepository,
      agentDeviceCounts,
      this.logger
    );
    this.agentController = new AgentController(
      new CreateAgentUseCase(
        agentRepository,
        agentSecrets,
        agentPublicUrl,
        this.logger
      ),
      new ListAgentsUseCase(
        agentRepository,
        agentDeviceCounts,
        this.logger
      ),
      getAgentUseCase,
      new ReissuePairingKeyUseCase(
        agentRepository,
        agentDeviceCounts,
        agentSecrets,
        agentPublicUrl,
        this.logger
      ),
      new RevokeAgentUseCase(
        agentRepository,
        agentDeviceCounts,
        this.logger
      ),
      this.logger
    );
    this.agentEnrollmentController = new AgentEnrollmentController(
      new EnrollAgentUseCase(
        agentRepository,
        agentSecrets,
        this.logger
      ),
      this.logger
    );

    const agentDeviceIndex = new PrismaAgentDeviceIndex(this.prisma);
    this.agentGateway = new AgentGateway(
      new AuthenticateAgentUseCase(
        agentRepository,
        agentSecrets,
        this.logger
      ),
      {
        recordContact: new RecordAgentContactUseCase(
          agentRepository,
          this.logger
        ),
        buildConfig: new BuildAgentConfigSnapshotUseCase(
          new PrismaAgentPollingTargetsQuery(this.prisma),
          agentDeviceIndex,
          this.logger
        ),
        acceptResults: new AcceptAgentResultsUseCase(
          agentRepository,
          agentDeviceIndex,
          new DeviceMonitoringPingResultSink(
            ingestPingResultsUseCase
          ),
          this.logger
        ),
        getAgent: getAgentUseCase,
        subscriptionStatus: getSubscriptionStatusUseCase
      },
      this.logger
    );
    this.agentLivenessOrchestrator = new AgentLivenessOrchestrator(
      new MarkSilentAgentsOfflineUseCase(
        agentRepository,
        this.logger
      ),
      { checkIntervalMs: 60_000 },
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

    // Initialize notification use cases. The single renderer +
    // AlertPublisher adapter are built first so every alert-producing
    // use case can deliver through the one shared spine.
    const sendAlertNotificationUseCase =
      new SendAlertNotificationUseCase(
        this.deviceRepository,
        telegramNotificationService,
        this.logger
      );
    // Wraps the real publisher so every alert-producing path below (down,
    // recovery, wireless — they all share this one instance) gets
    // quiet-hours suppression for free.
    // Outermost: an expired subscription (R17) silences everything.
    const alertPublisher = new SubscriptionAlertPublisher(
      new QuietHoursAlertPublisher(
        new MutedTypeAlertPublisher(
          new AlertPublisher(sendAlertNotificationUseCase),
          this.mutedAlertTypeRepository,
          this.logger
        ),
        this.deviceNotificationPolicyRepository,
        this.logger
      ),
      getSubscriptionStatusUseCase,
      this.logger
    );

    const sendDeviceDownAlertUseCase = new SendDeviceDownAlertUseCase(
      this.alertRepository,
      this.pollingConfigRepository,
      this.deviceRepository,
      deviceEligibilityService,
      alertPublisher,
      this.logger,
      this.ticketOpener
    );
    const sendDeviceRecoveryAlertUseCase =
      new SendDeviceRecoveryAlertUseCase(
        this.alertRepository,
        this.pollingConfigRepository,
        alertPublisher,
        this.logger
      );

    const deviceDownAlertDelayMs =
      parseInt(
        process.env.DEVICE_DOWN_ALERT_DELAY_MINUTES ?? '60',
        10
      ) *
      60 *
      1_000;
    const raiseOverdueDeviceDownAlertsUseCase =
      new RaiseOverdueDeviceDownAlertsUseCase(
        this.deviceStateRepository,
        this.deviceNotificationPolicyRepository,
        sendDeviceDownAlertUseCase,
        deviceDownAlertDelayMs,
        this.logger,
        agentStatusQuery
      );
    this.overdueDeviceDownAlertOrchestrator =
      new OverdueDeviceDownAlertOrchestrator(
        raiseOverdueDeviceDownAlertsUseCase,
        { checkIntervalMs: 60_000 },
        this.logger
      );

    // Wireless alert delivery is independently disableable so wireless
    // polling can run without paging anyone. Device-availability alerts
    // (down/recovery) are unaffected by this flag.
    const wirelessAlertPublisher =
      process.env.WIRELESS_ALERT_NOTIFICATIONS_ENABLED === 'false'
        ? null
        : alertPublisher;
    if (!wirelessAlertPublisher) {
      this.logger.warn(
        'WIRELESS_ALERT_NOTIFICATIONS_ENABLED=false — wireless alert notifications disabled'
      );
    }
    const listAlertsUseCase = new ListAlertsUseCase(
      new PrismaAlertListQuery(this.prisma),
      this.logger
    );
    const getAlertByIdUseCase = new GetAlertByIdUseCase(
      this.alertRepository,
      this.logger
    );
    const deleteAlertUseCase = new DeleteAlertUseCase(
      this.alertRepository,
      this.logger
    );
    const clearAlertUseCase = new ClearAlertUseCase(
      this.alertRepository,
      this.logger
    );
    const bulkClearAlertsUseCase = new BulkClearAlertsUseCase(
      this.alertRepository,
      this.logger
    );
    const bulkDeleteAlertsUseCase = new BulkDeleteAlertsUseCase(
      this.alertRepository,
      this.logger
    );

    // Recorder: any producer BC persists alerts into the shared list through
    // this (via IAlertRecorder), independent of notification delivery.
    const alertRecorder = new AlertRecorder(
      new OpenAlertUseCase(
        this.alertRepository,
        this.deviceRepository,
        deviceEligibilityService,
        this.logger,
        this.ticketOpener
      ),
      resolveAlertUseCase
    );

    // Initialize alert controller
    this.alertController = new AlertController(
      listAlertsUseCase,
      getAlertByIdUseCase,
      deleteAlertUseCase,
      clearAlertUseCase,
      bulkClearAlertsUseCase,
      bulkDeleteAlertsUseCase,
      this.logger
    );

    // =====================================
    // WIRELESS-MONITORING BOUNDED CONTEXT
    // =====================================

    this.wirelessSnapshotRepository =
      new PrismaWirelessSnapshotRepository(this.prisma);
    this.wirelessAlertRecordRepository =
      new PrismaWirelessAlertRecordRepository(this.prisma);

    const airOsHttpClient = new AirOsHttpClient(10_000, this.logger);
    const httpCollector = new UbiquitiHttpCollector(airOsHttpClient);
    const wirelessCollectors = new WirelessCollectorRegistry({
      ubiquiti: httpCollector,
      mimosa: new MimosaSnmpCollector(new SnmpClient(5_000))
    });
    const deviceVendorLookup = new DeviceVendorAdapter(
      this.deviceRepository,
      this.deviceModelRepository,
      this.vendorRepository
    );
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
      this.deviceRepository,
      deviceEligibilityService
    );
    const deviceReach = new DeviceReachAdapter(
      this.deviceRepository,
      this.serverOnSite
    );
    const contractedCapacityProvider = new ContractedCapacityAdapter(
      this.contractedServiceRepository,
      this.servicePlanRepository
    );

    const pollWirelessDeviceUseCase = new PollWirelessDeviceUseCase(
      this.wirelessDeviceConfigRepository,
      this.wirelessSnapshotRepository,
      this.wirelessAlertRecordRepository,
      this.deviceCredentialsRepository,
      wirelessCollectors,
      deviceVendorLookup,
      alertEvaluator,
      wirelessDeviceRepo,
      deviceReach,
      contractedCapacityProvider,
      wirelessAlertPublisher,
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
    const getApExpectedClientsUseCase =
      new GetApExpectedClientsUseCase(
        this.wirelessDeviceConfigRepository,
        this.wirelessSnapshotRepository,
        wirelessDeviceRepo,
        this.logger
      );
    const getDeviceIdentitySuggestionsUseCase =
      new GetDeviceIdentitySuggestionsUseCase(
        this.wirelessSnapshotRepository,
        wirelessDeviceRepo,
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
        deviceReach,
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
        wirelessDeviceRepo,
        this.logger
      );
    const deleteWirelessConfigUseCase =
      new DeleteWirelessConfigUseCase(
        this.wirelessDeviceConfigRepository,
        this.logger
      );
    const clearWirelessAlertUseCase = new ClearWirelessAlertUseCase(
      this.wirelessAlertRecordRepository,
      this.logger
    );
    const bulkClearWirelessAlertsUseCase =
      new BulkClearWirelessAlertsUseCase(
        this.wirelessAlertRecordRepository,
        this.logger
      );

    this.wirelessController = new WirelessController(
      getWirelessDeviceStatusUseCase,
      getWirelessDeviceHistoryUseCase,
      getWirelessClientsUseCase,
      getApExpectedClientsUseCase,
      getDeviceIdentitySuggestionsUseCase,
      getActiveWirelessAlertsUseCase,
      getWirelessAlertHistoryUseCase,
      triggerWirelessPollUseCase,
      rebootWirelessDeviceUseCase,
      createWirelessConfigUseCase,
      getWirelessConfigUseCase,
      updateWirelessConfigUseCase,
      deleteWirelessConfigUseCase,
      clearWirelessAlertUseCase,
      bulkClearWirelessAlertsUseCase,
      this.logger
    );

    // Live throughput (SSE)
    this.eventStreamHub = new SseBroadcaster(this.logger);

    // Live link diagnosis (frames stream over the same SSE hub)
    this.linkDiagnosisRunner = new LinkDiagnosisRunner(
      this.eventStreamHub,
      pingService,
      alertEvaluator,
      new LinkDiagnosisAnalyzer(),
      this.logger,
      {
        maxSessions: Number(process.env.DIAGNOSIS_MAX_SESSIONS ?? 5)
      }
    );
    const startLinkDiagnosisUseCase = new StartLinkDiagnosisUseCase(
      this.wirelessDeviceConfigRepository,
      this.wirelessSnapshotRepository,
      this.deviceCredentialsRepository,
      wirelessCollectors,
      deviceVendorLookup,
      wirelessDeviceRepo,
      deviceReach,
      contractedCapacityProvider,
      this.linkDiagnosisRunner,
      this.logger
    );
    const getLinkDiagnosisUseCase = new GetLinkDiagnosisUseCase(
      this.linkDiagnosisRunner,
      this.logger
    );
    const stopLinkDiagnosisUseCase = new StopLinkDiagnosisUseCase(
      this.linkDiagnosisRunner,
      this.logger
    );

    this.linkDiagnosisController = new LinkDiagnosisController(
      startLinkDiagnosisUseCase,
      getLinkDiagnosisUseCase,
      stopLinkDiagnosisUseCase,
      this.logger
    );

    const getWirelessThroughputUseCase =
      new GetWirelessThroughputUseCase(
        this.wirelessSnapshotRepository,
        this.wirelessDeviceConfigRepository,
        contractedCapacityProvider,
        this.logger
      );
    const getFleetWirelessThroughputUseCase =
      new GetFleetWirelessThroughputUseCase(
        this.wirelessSnapshotRepository,
        this.wirelessDeviceConfigRepository,
        contractedCapacityProvider,
        this.logger
      );

    this.wirelessStreamController = new WirelessStreamController(
      getWirelessThroughputUseCase,
      getFleetWirelessThroughputUseCase,
      getLinkDiagnosisUseCase,
      this.eventStreamHub,
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
    const purgeDeletedDevicesUseCase = new PurgeDeletedDevicesUseCase(
      this.deviceRepository,
      this.logger
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
      ),
      deletedDeviceGraceDays
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
      purgeDeletedDevicesUseCase,
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
        suspendDeviceMonitoringUseCase,
        this.logger
      )
    );
    EventDispatcher.register(
      DeviceMonitoringToggledEvent.name,
      new DeviceMonitoringToggledHandler(
        this.pollingConfigRepository,
        suspendDeviceMonitoringUseCase,
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
    // ICMP polling already stands down through the monitoring-toggled event
    // that softDelete raises. Wireless does not — its orchestrator selects on
    // its own `enabled` flag, so a deleted device would keep being polled.
    EventDispatcher.register(
      DeviceDeletedEvent.name,
      new DeviceDeletedWirelessConfigHandler(
        this.wirelessDeviceConfigRepository,
        this.logger
      )
    );
    // Same split for retirement: SuspendDeviceMonitoringUseCase only disables
    // the ICMP configuration, so without this a DAMAGED radio keeps being
    // wireless-polled. Both of these run in the enabling direction too, so a
    // unit coming back into service resumes where it left off.
    EventDispatcher.register(
      DeviceStatusChangedEvent.name,
      new DeviceStatusChangedWirelessConfigHandler(
        this.wirelessDeviceConfigRepository,
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

    // R6: agent health goes to the install's chat and, when configured, to
    // the vendor's. The vendor copy skips quiet hours and mutes — those are
    // the customer's settings, not the vendor's.
    const vendorChatId = process.env.TELEGRAM_VENDOR_CHAT_ID?.trim();
    const agentHealthPublisher = vendorChatId
      ? new FanOutAlertPublisher([
          alertPublisher,
          new SubscriptionAlertPublisher(
            new InstallLabelAlertPublisher(
              new AlertPublisher(
                new SendAlertNotificationUseCase(
                  this.deviceRepository,
                  new TelegramNotificationService(vendorChatId),
                  this.logger
                )
              ),
              agentPublicUrl
                ? new URL(agentPublicUrl).host
                : 'sin AGENT_PUBLIC_URL'
            ),
            getSubscriptionStatusUseCase,
            this.logger
          )
        ])
      : alertPublisher;
    EventDispatcher.register(
      AgentWentOfflineEvent.name,
      new AgentWentOfflineNotificationHandler(
        agentHealthPublisher,
        this.logger
      )
    );
    EventDispatcher.register(
      AgentCameBackEvent.name,
      new AgentCameBackNotificationHandler(
        agentHealthPublisher,
        this.logger
      )
    );
    EventDispatcher.register(
      AgentClockDriftedEvent.name,
      new AgentClockDriftedNotificationHandler(
        agentHealthPublisher,
        this.logger
      )
    );
    EventDispatcher.register(
      AgentClockCorrectedEvent.name,
      new AgentClockCorrectedNotificationHandler(
        agentHealthPublisher,
        this.logger
      )
    );

    // Device-down alerts feed the unified alert list the instant the
    // outage starts (NOT-097) — independent of whether it ever outlives the
    // notification delay. Notifying (and ticketing) still waits for
    // RaiseOverdueDeviceDownAlertsUseCase.
    EventDispatcher.register(
      DeviceWentOfflineEvent.name,
      new DeviceWentOfflineAlertRecordHandler(
        alertRecorder,
        this.pollingConfigRepository,
        this.logger
      )
    );

    // Wireless alerts feed the unified alert list (independent of whether
    // wireless notifications are enabled).
    EventDispatcher.register(
      WirelessAlertTriggeredEvent.name,
      new WirelessAlertTriggeredAlertRecordHandler(
        alertRecorder,
        this.logger
      )
    );
    EventDispatcher.register(
      WirelessAlertClearedEvent.name,
      new WirelessAlertClearedAlertRecordHandler(
        alertRecorder,
        this.logger
      )
    );

    if (wirelessAlertPublisher) {
      EventDispatcher.register(
        WirelessAlertClearedEvent.name,
        new WirelessAlertClearedNotificationHandler(
          wirelessAlertPublisher,
          this.logger
        )
      );
    }

    // Every stored poll feeds the live throughput streams. The handler
    // short-circuits when nobody is subscribed, so this costs nothing idle.
    EventDispatcher.register(
      WirelessSnapshotCreatedEvent.name,
      new WirelessSnapshotCreatedThroughputHandler(
        this.wirelessSnapshotRepository,
        this.wirelessDeviceConfigRepository,
        contractedCapacityProvider,
        this.eventStreamHub,
        this.logger
      )
    );

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
      if (this.modules.has('customers')) {
        EventDispatcher.register(
          ContractedServiceStatusChangedEvent.name,
          new ContractedServiceSuspendedNotificationHandler(
            sendSuspensionNoticeUseCase,
            this.logger
          )
        );
      }

      // Job notices ride the same WhatsApp sender, so they share its opt-in.
      if (this.modules.has('tickets')) {
        EventDispatcher.register(
          TicketAssignedEvent.name,
          new TicketAssignedNotificationHandler(
            this.ticketRepository,
            this.technicianRepository,
            new TechnicianNotifierAdapter(
              whatsAppNotificationService
            ),
            this.logger
          )
        );
      }
    } else {
      this.logger.warn(
        'WhatsApp env vars not set — suspension notices disabled'
      );
    }

    // The module switch decides whether enforcement exists at all; the router
    // variable alone must never turn it on. Within the module the router is
    // still optional, so an install without one keeps booting.
    const enforcementRouterDeviceId =
      process.env.ENFORCEMENT_ROUTER_DEVICE_ID;
    if (!this.modules.has('enforcement')) {
      if (enforcementRouterDeviceId) {
        this.logger.warn(
          'ENFORCEMENT_ROUTER_DEVICE_ID is set but the enforcement module is disabled — ignoring it'
        );
      }
    } else if (enforcementRouterDeviceId) {
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

    // R17: everything that measures or works in the background stops while
    // the subscription is read-only or locked. Agent liveness keeps running
    // so refused agents go offline and their devices read as unknown.
    const supervisedJobs: SupervisedJob[] = [
      { name: 'polling', ...bindJob(this.pollingOrchestrator) },
      {
        name: 'wireless-polling',
        ...bindJob(this.wirelessPollingOrchestrator)
      },
      {
        name: 'data-retention',
        ...bindJob(this.dataRetentionOrchestrator)
      },
      {
        name: 'overdue-down-alerts',
        ...bindJob(this.overdueDeviceDownAlertOrchestrator)
      }
    ];
    if (this.suspensionReconciliationOrchestrator) {
      supervisedJobs.push({
        name: 'suspension-reconciliation',
        ...bindJob(this.suspensionReconciliationOrchestrator)
      });
    }
    this.subscriptionJobSupervisor = new SubscriptionJobSupervisor(
      supervisedJobs,
      getSubscriptionStatusUseCase,
      this.logger
    );

    // R17: reminders go to the install's own chat directly — they must
    // arrive precisely while alerts are silenced.
    this.subscriptionReminderOrchestrator =
      new SubscriptionReminderOrchestrator(
        new SendSubscriptionReminderUseCase(
          getSubscriptionStatusUseCase,
          telegramNotificationService,
          this.logger
        ),
        {},
        this.logger
      );
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

function bindJob(job: {
  start(): void;
  stop(): void | Promise<void>;
}): Pick<SupervisedJob, 'start' | 'stop'> {
  return { start: () => job.start(), stop: () => job.stop() };
}
