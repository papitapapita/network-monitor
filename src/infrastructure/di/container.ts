import { PrismaClient } from 'generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { WinstonLogger } from '../logging';
import { PrismaAgentRepository } from '../probe-agents/repositories';
import { NodeAgentSecretService } from '../probe-agents/crypto';
import { loadAgentPublicUrl } from '../probe-agents/config';
import {
  loadAppPublicUrl,
  loadWebPushConfig
} from '../notifications/config';
import {
  PrismaAgentAssignmentQuery,
  PrismaAgentDeviceIndex,
  PrismaAgentPollingTargetsQuery,
  PrismaAgentDeviceCountQuery,
  PrismaAgentOutageQuery,
  PrismaAgentStatusQuery
} from '../probe-agents/queries';
import {
  AgentChannelConfigFetcher,
  AgentChannelTrafficReader,
  AgentChannelPortReader,
  AgentChannelRouterOsPrinter,
  AgentChannelPingProbe,
  AgentChannelSweepProbe,
  AgentChannelHostDiscovery,
  AgentChannelRadioReader,
  AgentChannelRadioSettings,
  DeviceMonitoringPingResultSink
} from '../probe-agents/adapters';
import {
  AgentGateway,
  ConnectedAgents
} from '../../presentation/ws/agent';
import {
  CreateAgentUseCase,
  ListAgentsUseCase,
  GetAgentUseCase,
  ReissuePairingKeyUseCase,
  RevokeAgentUseCase,
  ListAgentOutagesUseCase,
  EnrollAgentUseCase,
  AuthenticateAgentUseCase,
  RecordAgentContactUseCase,
  BuildAgentConfigSnapshotUseCase,
  AcceptAgentResultsUseCase,
  MarkSilentAgentsOfflineUseCase,
  GetAgentUpdateOfferUseCase,
  RecordAgentUpdateOutcomeUseCase,
  OpenAgentReleaseFileUseCase
} from '../../application/probe-agents/use-cases';
import { AgentLivenessOrchestrator } from '../probe-agents/orchestrator';
import { FileSystemAgentReleaseCatalog } from '../probe-agents/releases';
import { loadVendorSettingsDefaults } from './vendorSettingsDefaults';
import {
  SubscriptionJobSupervisor,
  SupervisedJob
} from '../installation';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';
import {
  AgentWentOfflineEvent,
  AgentCameBackEvent,
  AgentClockDriftedEvent,
  AgentClockCorrectedEvent,
  AgentUpdateFailedEvent
} from 'domain/probe-agents/events';
import { JwtTokenService } from '../identity/services/JwtTokenService';
import {
  UserSignInPausedEvent,
  UserTwoFactorResetEvent
} from 'domain/identity/events';
import { DeviceBackupFailingEvent } from 'domain/device-backups/events';
import { MAX_CONFIG_BYTES } from 'domain/device-backups';
import { BcryptPasswordService } from '../identity/services/BcryptPasswordService';
import { PrismaUserRepository } from '../identity/repositories/PrismaUserRepository';
import {
  PrismaCustomerRepository,
  PrismaServicePlanRepository,
  PrismaContractedServiceRepository,
  PrismaContractedServiceDetailQuery
} from '../customers';
import {
  PrismaBillRepository,
  PdfKitBillPdfRenderer,
  PrismaCollectionAccountRepository,
  PrismaBankAccountRepository,
  PrismaBillingSettingsRepository,
  PrismaBillableServicesQuery,
  PrismaBillingContactsQuery,
  PrismaBillReminderLog,
  BillingCycleOrchestrator,
  ContractedServiceAccessAdapter,
  SettingsIssuerPdfRenderer
} from '../billing';
import {
  PrismaQuotationRepository,
  PdfKitQuotationPdfRenderer,
  HttpImageFetcher
} from '../quoting';
import { LoginUseCase } from 'application/identity/use-cases/LoginUseCase';
import { StartTwoFactorSetupUseCase } from 'application/identity/use-cases/StartTwoFactorSetupUseCase';
import { ConfirmTwoFactorSetupUseCase } from 'application/identity/use-cases/ConfirmTwoFactorSetupUseCase';
import { VerifyTwoFactorUseCase } from 'application/identity/use-cases/VerifyTwoFactorUseCase';
import { RequestPasswordResetUseCase } from 'application/identity/use-cases/RequestPasswordResetUseCase';
import { ResetPasswordUseCase } from 'application/identity/use-cases/ResetPasswordUseCase';
import { SignInSteps } from 'application/identity/services/SignInSteps';
import { NewSignInWarning } from 'application/identity/services/NewSignInWarning';
import { IEmailSender } from 'application/shared/interfaces';
import { loadSmtpConfig } from '../email/smtpConfig';
import { SmtpEmailSender } from '../email/SmtpEmailSender';
import { UnconfiguredEmailSender } from '../email/UnconfiguredEmailSender';
import { TotpTwoFactorCodes } from '../identity/services/TotpTwoFactorCodes';
import { HashedRecoveryCodes } from '../identity/services/HashedRecoveryCodes';
import { AesSecretCipher } from '../identity/services/AesSecretCipher';
import { SessionValidator } from 'application/identity/services/SessionValidator';
import {
  ListUsersUseCase,
  CreateUserUseCase,
  UpdateUserUseCase,
  ResetTwoFactorUseCase,
  ChangeOwnPasswordUseCase,
  UnlockCredentialRevealUseCase,
  CredentialRevealGate
} from 'application/identity';
import { EnsureVendorAccountUseCase } from 'application/identity/use-cases/EnsureVendorAccountUseCase';
import { AuthController } from 'presentation/http/controllers/AuthController';
import { ITokenService } from 'application/identity/interfaces/ITokenService';
import {
  PrismaLocationRepository,
  PrismaDeviceRepository,
  PrismaDeviceListQuery,
  PrismaTopologyQuery,
  PrismaOutageTopologyQuery,
  PrismaReportedApQuery,
  PrismaDeviceModelRepository,
  PrismaVendorRepository,
  PrismaPollingConfigurationRepository,
  PrismaPingResultRepository,
  PrismaDeviceStateRepository,
  PrismaAlertRepository,
  PrismaAlertListQuery,
  PrismaPollingStatusListQuery,
  PrismaDeviceCredentialsRepository,
  PrismaDeviceNotificationPolicyRepository,
  PrismaMutedAlertTypeRepository,
  PrismaPushSubscriptionRepository,
  PrismaInboxNotificationRepository,
  PrismaSpeedTestResultRepository,
  PrismaPortExpectedSpeedRepository,
  PrismaRouterSystemStateRepository,
  PrismaRouterHealthThresholdsRepository,
  PrismaReportedOutageQuery,
  PrismaDiscoveredDeviceRepository,
  PrismaDiscoverySettingsRepository,
  PrismaKnownDeviceLookup,
  PrismaDiscoveredDeviceListQuery,
  PrismaDiscoveryPrefillQuery,
  PrismaInboxRecipientsQuery,
  PrismaNotificationSettingsRepository,
  PrismaVendorSettingsRepository
} from '../persistence/';
import {
  LocationController,
  DeviceController,
  TopologyController,
  RadioSettingsController,
  DeviceModelController,
  VendorController,
  PollingController,
  NotificationPolicyController,
  NotificationMuteController,
  NotificationSettingsController,
  PushController,
  InboxNotificationController,
  InboxStreamController,
  VendorSettingsController,
  AlertController,
  ScanController,
  DiscoveredDeviceController,
  DiscoverySettingsController,
  WirelessController,
  WirelessStreamController,
  NetworkSweepController,
  SpeedTestController,
  PortSpeedController,
  RouterSystemController,
  PingToolController,
  LinkDiagnosisController,
  AlertThresholdsController,
  CredentialsController,
  CustomerController,
  ServicePlanController,
  ContractedServiceController,
  BillController,
  BillingSettingsController,
  CollectionAccountController,
  BankAccountController,
  AgentController,
  AgentEnrollmentController,
  AgentUpdateController,
  SubscriptionController,
  InstallationController,
  UserController,
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
  GetBillingSettingsUseCase,
  UpdateBillingSettingsUseCase,
  RunBillingCycleUseCase,
  RestoreServicesAfterPaymentUseCase,
  SendBillEmailUseCase,
  SendBillWhatsAppUseCase,
  SendPaymentRemindersUseCase,
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
import { RestoreServicesOnPaymentHandler } from 'application/billing/event-handlers';
import { BillPaidEvent } from 'domain/billing/events';
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
  PrismaAlertThresholdsRepository,
  AirOsHttpClient,
  UbiquitiHttpCollector,
  SnmpClient,
  MimosaSnmpCollector,
  WirelessCollectorRegistry,
  WirelessPollingOrchestrator,
  LinkDiagnosisRunner,
  AirOsHostnameWriter,
  RadioHostnameWriterRegistry,
  RadioSettingsGateway
} from '../wireless-monitoring';
import { RadioLoginAdapter } from '../wireless-monitoring/adapters/RadioLoginAdapter';
import { WirelessDeviceRepositoryAdapter } from '../wireless-monitoring/adapters/WirelessDeviceRepositoryAdapter';
import { DeviceReachAdapter } from '../wireless-monitoring/adapters/DeviceReachAdapter';
import { StationSightingsAdapter } from '../wireless-monitoring/adapters/StationSightingsAdapter';
import { ContractedCapacityAdapter } from '../wireless-monitoring/adapters/ContractedCapacityAdapter';
import { DeviceVendorAdapter } from '../wireless-monitoring/adapters/DeviceVendorAdapter';
import { PrismaDeviceHardwareQuery } from '../persistence/PrismaDeviceHardwareQuery';
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
  DEFAULT_ALERT_CONFIRMATION,
  GetWirelessDeviceStatusUseCase,
  GetWirelessDeviceHistoryUseCase,
  GetWirelessClientsUseCase,
  GetApExpectedClientsUseCase,
  GetDeviceIdentitySuggestionsUseCase,
  GetActiveWirelessAlertsUseCase,
  GetWirelessAlertHistoryUseCase,
  TriggerWirelessPollUseCase,
  RebootWirelessDeviceUseCase,
  RevealWirelessKeyUseCase,
  RenameRadioUseCase,
  CreateWirelessConfigUseCase,
  GetWirelessConfigUseCase,
  GetWirelessThroughputUseCase,
  GetFleetWirelessThroughputUseCase,
  UpdateWirelessConfigUseCase,
  DeleteWirelessConfigUseCase,
  ClearWirelessAlertUseCase,
  BulkClearWirelessAlertsUseCase,
  StartLinkDiagnosisUseCase,
  GetAlertThresholdsUseCase,
  UpdateAlertThresholdsUseCase,
  GetDeviceAlertThresholdsUseCase,
  UpdateDeviceAlertThresholdsUseCase,
  GetLinkDiagnosisUseCase,
  StopLinkDiagnosisUseCase
} from 'application/wireless-monitoring/use-cases';
import {
  SetDeviceCredentialsUseCase,
  GetDeviceCredentialsUseCase,
  RevealDeviceCredentialsUseCase,
  DeleteDeviceCredentialsUseCase,
  GetMapLocationsUseCase,
  GetTopologyUseCase,
  ListUpstreamSuggestionsUseCase,
  AcceptUpstreamSuggestionsUseCase,
  GetDeviceDescendantsUseCase,
  DeleteLocationUseCase
} from 'application/device-inventory/use-cases';
import { PingService } from '../monitoring/ping';
import { ProbeHealthReporter } from '../monitoring/health';
import {
  ArpService,
  NetworkScannerService,
  SegmentScanner
} from '../monitoring/network-scanner';
import {
  PollingOrchestrator,
  DiscoveryScanOrchestrator,
  PortSpeedCheckOrchestrator,
  loadPortSpeedCheckIntervalMs,
  RouterSystemCheckOrchestrator,
  loadRouterSystemCheckIntervalMs
} from '../monitoring/orchestrator';
import {
  PrismaRouterTrafficTargetsQuery,
  RouterOsTrafficReader,
  RouterTrafficMonitor
} from '../monitoring/router-traffic';
import {
  PrismaPortSpeedTargetsQuery,
  RouterOsPortReader
} from '../monitoring/port-speeds';
import { RouterOsApiPrinter } from '../monitoring/routeros';
import { RouterOsSystemReader } from '../monitoring/router-system';
import {
  RunNetworkSweepUseCase,
  RunSpeedTestUseCase,
  RunPingToolUseCase,
  ListSpeedTestsUseCase,
  WatchRouterTrafficUseCase,
  ListRouterPortSpeedsUseCase,
  GetRouterPortSpeedsUseCase,
  SetPortExpectedSpeedUseCase,
  AcceptCurrentPortSpeedsUseCase,
  CheckPortSpeedsUseCase,
  ListRouterSystemsUseCase,
  GetRouterSystemUseCase,
  CheckRouterSystemsUseCase,
  GetRouterHealthThresholdsUseCase,
  UpdateRouterHealthThresholdsUseCase
} from 'application/device-monitoring/use-cases';
import {
  RouterPortInspector,
  RouterSystemRecorder,
  RouterSystemNotifier
} from 'application/device-monitoring/services';
import { PrismaNetworkSweepTargetsQuery } from '../monitoring/network-sweep';
import { CloudflareSpeedTester } from '../monitoring/speed-test';
import { PrismaPingToolAgentQuery } from '../monitoring/ping-tool';
import {
  TelegramNotificationService,
  WhatsAppNotificationService,
  AlertPublisher,
  QuietHoursAlertPublisher,
  MutedTypeAlertPublisher,
  AlertRecorder,
  FanOutAlertPublisher,
  InstallLabelAlertPublisher,
  SubscriptionAlertPublisher,
  SwitchedOffAlertPublisher,
  TicketModeGatedOpener,
  TelegramTestMessageSender,
  WhenConfiguredAlertPublisher,
  WebPushSender,
  PushAlertPublisher,
  InboxAlertPublisher,
  InboxDiscoveryNotifier
} from '../notifications';
import {
  OverdueDeviceDownAlertOrchestrator,
  SubscriptionReminderOrchestrator
} from '../notifications/orchestrator';
import {
  RouterOsQueueService,
  AgentRouterQueueService,
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
  AlertDirectoryAdapter,
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
  CreateTicketFromAlertUseCase,
  CreateTechnicianUseCase,
  GetTechnicianUseCase,
  ListTechniciansUseCase,
  UpdateTechnicianUseCase,
  DeleteTechnicianUseCase
} from 'application/tickets/use-cases';
import { ITicketOpener } from 'application/tickets/interfaces';
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
import { EventDispatcher, Result } from 'domain/shared/core';
import {
  ContractedServiceStatusChangedEvent,
  ContractedServiceCancelledEvent
} from 'domain/customers/events';
import { ContractedServiceCancelledDeviceHandler } from 'application/device-inventory/event-handlers';
import {
  GetHardwareChangesUseCase,
  RetireDeviceAfterCancellationUseCase
} from 'application/device-inventory/use-cases';
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
  ResolveStrandedDeviceDownAlertsUseCase,
  GetDeviceNotificationPolicyUseCase,
  UpsertDeviceNotificationPolicyUseCase,
  DeleteDeviceNotificationPolicyUseCase,
  BulkUpsertDeviceNotificationPoliciesUseCase,
  GetMutedAlertTypesUseCase,
  SetMutedAlertTypesUseCase,
  SubscribePushUseCase,
  ListInboxNotificationsUseCase,
  GetUnreadInboxCountUseCase,
  MarkInboxNotificationReadUseCase,
  MarkAllInboxNotificationsReadUseCase,
  RecordInboxNotificationUseCase,
  PurgeOldInboxNotificationsUseCase,
  UnsubscribePushUseCase,
  SendTestPushUseCase,
  SendPushAlertUseCase,
  SendSubscriptionReminderUseCase,
  GetNotificationSettingsUseCase,
  UpdateNotificationSettingsUseCase,
  SendTestNotificationUseCase
} from 'application/notifications/use-cases';
import {
  InboxStream,
  OutageRollup
} from 'application/notifications/shared';
import {
  DeviceCameOnlineNotificationHandler,
  DeviceWentOfflineAlertRecordHandler,
  ContractedServiceSuspendedNotificationHandler,
  AgentWentOfflineNotificationHandler,
  UserSignInPausedNotificationHandler,
  UserTwoFactorResetNotificationHandler,
  AgentCameBackNotificationHandler,
  AgentClockDriftedNotificationHandler,
  AgentClockCorrectedNotificationHandler,
  AgentUpdateFailedNotificationHandler,
  DeviceBackupFailingNotificationHandler
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
  ListDiscoveredDevicesUseCase,
  IgnoreDiscoveredDeviceUseCase,
  UnignoreDiscoveredDeviceUseCase,
  GetDiscoveredDevicePrefillUseCase,
  PurgeStaleDiscoveredDevicesUseCase,
  GetDiscoverySettingsUseCase,
  UpdateDiscoverySettingsUseCase,
  RunScheduledDiscoveryUseCase,
  AssignDevicesToAgentUseCase
} from '../../application/device-inventory/use-cases';
import {
  AgentAssignmentPolicy,
  UpstreamAssignment,
  DeviceSightingRecorder
} from '../../application/device-inventory/services';
import {
  ExecutePollingCycleUseCase,
  IngestPingResultsUseCase,
  ConfigureDevicePollingUseCase,
  GetDevicePollingStatusUseCase,
  ListDevicePollingStatusesUseCase,
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
import { HardwareChangeAssessor } from 'application/device-inventory/services';
import { DataRetentionOrchestrator } from '../retention/DataRetentionOrchestrator';
import { TriggerDataRetentionUseCase } from 'application/shared/use-cases/TriggerDataRetentionUseCase';
import { GetVendorSettingsUseCase } from 'application/shared/use-cases/GetVendorSettingsUseCase';
import { UpdateVendorSettingsUseCase } from 'application/shared/use-cases/UpdateVendorSettingsUseCase';
import { AdminController } from 'presentation/http/controllers/AdminController';
import { loadIssuerDisplayConfig } from '../billing/config/collectionAccountIssuerConfig';
import { EnabledModules } from './enabledModules';
import { loadServerOnSite } from './serverOnSite';
import {
  BackUpDeviceNowUseCase,
  DeviceConfigBackupService,
  DownloadDeviceBackupUseCase,
  ListDeviceBackupsUseCase,
  RunScheduledBackupsUseCase
} from 'application/device-backups';
import {
  AirOsConfigFetcher,
  ConfigBackupOrchestrator,
  ConfigFetcherRegistry,
  PrismaBackupTargetsQuery,
  RouterOsConfigFetcher,
  SshCommandClient,
  PrismaConfigBackupRepository,
  PrismaDeviceBackupStateRepository
} from '../device-backups';
import { DeviceBackupController } from 'presentation/http/controllers/DeviceBackupController';
import {
  GetDevicePowerSourceUseCase,
  ListSitePoePortsUseCase,
  SitePoeInspector,
  PoweredDeviceSurvey
} from 'application/power-control';
import {
  PoeSwitchReaderRegistry,
  PrismaPoeSwitchTargetsQuery,
  PoweringSwitchQueryAdapter,
  RouterOsPoeReader,
  SwOsPoeReader
} from '../power-control';
import { PowerControlController } from 'presentation/http/controllers/PowerControlController';
import { loadNotificationSettingsDefaults } from './notificationSettingsDefaults';
import { loadVendorAccount } from './vendorAccount';
import { loadInstallersDir } from './installersDir';
import { FileSystemInstallerStore } from '../installation/FileSystemInstallerStore';
import { ListInstallersUseCase } from 'application/shared/use-cases/ListInstallersUseCase';
import { GetInstallerUseCase } from 'application/shared/use-cases/GetInstallerUseCase';

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
  private notificationSettingsRepository: PrismaNotificationSettingsRepository;
  private vendorSettingsRepository: PrismaVendorSettingsRepository;

  // Wireless repositories
  private wirelessSnapshotRepository: PrismaWirelessSnapshotRepository;
  private wirelessAlertRecordRepository: PrismaWirelessAlertRecordRepository;
  private wirelessDeviceConfigRepository: PrismaWirelessDeviceConfigRepository;
  private alertThresholdsRepository: PrismaAlertThresholdsRepository;
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
  private ticketOpener: ITicketOpener | undefined;

  // Identity
  public tokenService: ITokenService;
  public sessionValidator: SessionValidator;
  public credentialRevealGate: CredentialRevealGate;
  public userController: UserController;
  private ensureVendorAccountUseCase: EnsureVendorAccountUseCase;
  public authController: AuthController;

  // Controllers
  public locationController: LocationController;
  public deviceController: DeviceController;
  public topologyController: TopologyController;
  public deviceModelController: DeviceModelController;
  public vendorController: VendorController;
  public pollingController: PollingController;
  public notificationPolicyController: NotificationPolicyController;
  public notificationMuteController: NotificationMuteController;
  public pushController: PushController;
  public inboxNotificationController: InboxNotificationController;
  public inboxStreamController: InboxStreamController;
  public notificationSettingsController: NotificationSettingsController;
  public vendorSettingsController: VendorSettingsController;
  public agentController: AgentController;
  public subscriptionController: SubscriptionController;
  public installationController: InstallationController;
  public getSubscriptionStatusUseCase: GetSubscriptionStatusUseCase;
  public agentEnrollmentController: AgentEnrollmentController;
  public agentUpdateController: AgentUpdateController;
  // Attached to the HTTP server by main.ts, once it is listening.
  public agentGateway: AgentGateway;
  public alertController: AlertController;
  public scanController: ScanController;
  public discoveredDeviceController: DiscoveredDeviceController;
  public discoverySettingsController: DiscoverySettingsController;
  public discoveryScanOrchestrator: DiscoveryScanOrchestrator;
  public portSpeedCheckOrchestrator: PortSpeedCheckOrchestrator;
  public routerSystemCheckOrchestrator: RouterSystemCheckOrchestrator;
  // Shared by every source of sightings (DEV-200).
  public deviceSightingRecorder: DeviceSightingRecorder;
  private purgeStaleDiscoveredDevicesUseCase: PurgeStaleDiscoveredDevicesUseCase;
  public wirelessController: WirelessController;
  public radioSettingsController: RadioSettingsController;
  public wirelessStreamController: WirelessStreamController;
  public networkSweepController: NetworkSweepController;
  public speedTestController: SpeedTestController;
  public portSpeedController: PortSpeedController;
  public routerSystemController: RouterSystemController;
  public pingToolController: PingToolController;
  public linkDiagnosisController: LinkDiagnosisController;
  public alertThresholdsController: AlertThresholdsController;
  public credentialsController: CredentialsController;
  public deviceBackupController: DeviceBackupController;
  public powerControlController: PowerControlController;
  public customerController: CustomerController | null = null;
  public ticketController: TicketController | null = null;
  public technicianController: TechnicianController | null = null;
  public servicePlanController: ServicePlanController | null = null;
  public contractedServiceController: ContractedServiceController | null =
    null;
  public billController: BillController | null = null;
  public billingSettingsController: BillingSettingsController | null =
    null;
  public billingCycleOrchestrator: BillingCycleOrchestrator | null =
    null;
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
  public routerTrafficMonitor: RouterTrafficMonitor;
  public dataRetentionOrchestrator: DataRetentionOrchestrator;
  public configBackupOrchestrator: ConfigBackupOrchestrator;
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
    ),
    private readonly vendorAccount = loadVendorAccount(process.env)
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
      new PrismaPollingConfigurationRepository(
        this.prisma,
        this.serverOnSite
      );
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
    this.notificationSettingsRepository =
      new PrismaNotificationSettingsRepository(
        this.prisma,
        loadNotificationSettingsDefaults(process.env)
      );
    this.vendorSettingsRepository =
      new PrismaVendorSettingsRepository(
        this.prisma,
        loadVendorSettingsDefaults(process.env)
      );
    // Shared by sign-in emails and billing notices.
    const smtpConfig = loadSmtpConfig(process.env);
    const emailSender: IEmailSender = smtpConfig
      ? new SmtpEmailSender(smtpConfig)
      : new UnconfiguredEmailSender(this.logger);
    this.wirelessDeviceConfigRepository =
      new PrismaWirelessDeviceConfigRepository(
        this.prisma,
        this.serverOnSite
      );
    this.alertThresholdsRepository =
      new PrismaAlertThresholdsRepository(this.prisma);
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

      const contractedServiceDetailQuery =
        new PrismaContractedServiceDetailQuery(this.prisma);
      this.contractedServiceController =
        new ContractedServiceController(
          new CreateContractedServiceUseCase(
            this.contractedServiceRepository,
            this.customerRepository,
            this.servicePlanRepository,
            this.logger
          ),
          new GetContractedServiceUseCase(
            contractedServiceDetailQuery,
            this.logger
          ),
          new ListContractedServicesUseCase(
            contractedServiceDetailQuery,
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
        this.contractedServiceRepository,
        this.servicePlanRepository,
        this.logger
      );

      const getBillPdfUseCase = new GetBillPdfUseCase(
        this.billRepository,
        this.customerRepository,
        new PdfKitBillPdfRenderer(),
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
        getBillPdfUseCase,
        new MarkBillPaidUseCase(this.billRepository, this.logger),
        new MarkBillOverdueUseCase(this.billRepository, this.logger),
        new CancelBillUseCase(this.billRepository, this.logger),
        this.logger
      );

      const billingSettingsRepository =
        new PrismaBillingSettingsRepository(this.prisma);
      this.billingSettingsController = new BillingSettingsController(
        new GetBillingSettingsUseCase(
          billingSettingsRepository,
          this.logger
        ),
        new UpdateBillingSettingsUseCase(
          billingSettingsRepository,
          this.logger
        ),
        this.logger
      );
      const billingContacts = new PrismaBillingContactsQuery(
        this.prisma
      );
      const serviceAccess = new ContractedServiceAccessAdapter(
        this.contractedServiceRepository
      );
      // Bills and reminders by WhatsApp need the token, like suspension
      // notices.
      const customerWhatsApp = process.env.WHATSAPP_ACCESS_TOKEN
        ? new WhatsAppNotificationService(async () => {
            const settings =
              await this.vendorSettingsRepository.get();
            return settings.isSuccess
              ? settings.value.whatsApp
              : null;
          })
        : null;
      this.billingCycleOrchestrator = new BillingCycleOrchestrator(
        new RunBillingCycleUseCase(
          billingSettingsRepository,
          new PrismaBillableServicesQuery(this.prisma),
          this.billRepository,
          generateBillUseCase,
          serviceAccess,
          new SendBillEmailUseCase(
            this.billRepository,
            billingContacts,
            getBillPdfUseCase,
            emailSender,
            this.logger
          ),
          new SendBillWhatsAppUseCase(
            this.billRepository,
            billingContacts,
            getBillPdfUseCase,
            customerWhatsApp,
            this.logger
          ),
          new SendPaymentRemindersUseCase(
            this.billRepository,
            new PrismaBillReminderLog(this.prisma),
            billingContacts,
            emailSender,
            customerWhatsApp,
            this.logger
          ),
          this.logger
        ),
        {},
        this.logger
      );
      EventDispatcher.register(
        BillPaidEvent.name,
        new RestoreServicesOnPaymentHandler(
          new RestoreServicesAfterPaymentUseCase(
            billingSettingsRepository,
            this.billRepository,
            serviceAccess,
            this.logger
          ),
          this.logger
        )
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
            new SettingsIssuerPdfRenderer(
              this.vendorSettingsRepository,
              loadIssuerDisplayConfig(process.env)
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

      const openTicketFromAlertUseCase =
        new OpenTicketFromAlertUseCase(
          this.ticketRepository,
          customerDirectory,
          deviceDirectory,
          this.logger
        );

      // Built here rather than inline below because the notifications context
      // needs it: OpenAlertUseCase turns a newly recorded alert into a ticket,
      // when the administrator's ticket mode says so (NOT-205).
      this.ticketOpener = new TicketModeGatedOpener(
        new TicketOpenerAdapter(openTicketFromAlertUseCase),
        this.notificationSettingsRepository,
        this.logger
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
        new CreateTicketFromAlertUseCase(
          new AlertDirectoryAdapter(this.prisma),
          this.ticketRepository,
          openTicketFromAlertUseCase,
          this.logger
        ),
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
    const signInSteps = new SignInSteps(
      userRepository,
      jwtTokenService
    );
    const twoFactorCodes = new TotpTwoFactorCodes();
    const recoveryCodes = new HashedRecoveryCodes();
    const secretCipher = new AesSecretCipher();
    const accountLinksUrl = loadAppPublicUrl(process.env);
    const newSignInWarning = new NewSignInWarning(
      emailSender,
      this.logger
    );
    const loginUseCase = new LoginUseCase(
      userRepository,
      bcryptPasswordService,
      signInSteps,
      this.logger
    );

    this.ensureVendorAccountUseCase = new EnsureVendorAccountUseCase(
      userRepository,
      bcryptPasswordService,
      this.logger
    );

    this.tokenService = jwtTokenService;
    this.sessionValidator = new SessionValidator(userRepository);
    this.credentialRevealGate = new CredentialRevealGate(
      userRepository,
      jwtTokenService
    );
    this.userController = new UserController(
      new ListUsersUseCase(userRepository, this.logger),
      new CreateUserUseCase(
        userRepository,
        bcryptPasswordService,
        jwtTokenService,
        emailSender,
        accountLinksUrl,
        this.logger
      ),
      new UpdateUserUseCase(
        userRepository,
        bcryptPasswordService,
        this.logger
      ),
      new ChangeOwnPasswordUseCase(
        userRepository,
        bcryptPasswordService,
        jwtTokenService,
        this.logger
      ),
      new ResetTwoFactorUseCase(userRepository, this.logger),
      new UnlockCredentialRevealUseCase(
        userRepository,
        bcryptPasswordService,
        jwtTokenService,
        signInSteps,
        this.logger
      ),
      this.logger
    );
    this.authController = new AuthController(
      loginUseCase,
      new StartTwoFactorSetupUseCase(
        userRepository,
        signInSteps,
        twoFactorCodes,
        secretCipher,
        this.logger
      ),
      new ConfirmTwoFactorSetupUseCase(
        userRepository,
        signInSteps,
        twoFactorCodes,
        recoveryCodes,
        secretCipher,
        newSignInWarning,
        this.logger
      ),
      new VerifyTwoFactorUseCase(
        userRepository,
        signInSteps,
        twoFactorCodes,
        recoveryCodes,
        secretCipher,
        newSignInWarning,
        this.logger
      ),
      new RequestPasswordResetUseCase(
        userRepository,
        jwtTokenService,
        emailSender,
        accountLinksUrl,
        this.logger
      ),
      new ResetPasswordUseCase(
        userRepository,
        bcryptPasswordService,
        jwtTokenService,
        this.logger
      ),
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
    const agentAssignmentQuery = new PrismaAgentAssignmentQuery(
      this.prisma
    );
    const agentAssignmentPolicy = new AgentAssignmentPolicy(
      agentAssignmentQuery
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
      new PrismaDeviceListQuery(this.prisma, this.serverOnSite),
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
    // Filled by the agent gateway further down; built here so a manual poll
    // can ask a device's agent (MON-022).
    const connectedAgents = new ConnectedAgents(this.logger);
    const executePollingCycleUseCase = new ExecutePollingCycleUseCase(
      this.pollingConfigRepository,
      this.deviceRepository,
      deviceEligibilityService,
      new PingCycleProbe(pingService),
      ingestPingResultsUseCase,
      this.logger,
      probeHealthReporter,
      this.serverOnSite,
      new AgentChannelPingProbe(connectedAgents)
    );
    // MON-080..MON-084: a snapshot of the whole network, on demand.
    this.networkSweepController = new NetworkSweepController(
      new RunNetworkSweepUseCase(
        new PrismaNetworkSweepTargetsQuery(this.prisma),
        new PingCycleProbe(pingService, 0, 1_000),
        new AgentChannelSweepProbe(connectedAgents),
        this.logger,
        this.serverOnSite
      ),
      this.logger
    );
    // MON-120..MON-123: ping any address, from here or from an agent.
    this.pingToolController = new PingToolController(
      new RunPingToolUseCase(
        pingService,
        new AgentChannelPingProbe(connectedAgents),
        new PrismaPingToolAgentQuery(this.prisma),
        this.logger,
        this.serverOnSite
      ),
      this.logger
    );
    // MON-100..MON-104: the server's own internet connection, on demand.
    const speedTestRepository = new PrismaSpeedTestResultRepository(
      this.prisma
    );
    this.speedTestController = new SpeedTestController(
      new RunSpeedTestUseCase(
        new CloudflareSpeedTester(),
        speedTestRepository,
        this.logger,
        this.serverOnSite
      ),
      new ListSpeedTestsUseCase(speedTestRepository, this.logger),
      this.logger
    );
    // MON-140..MON-146: each MikroTik port's negotiated speed against the
    // speed it should link at; off site read through the router's agent.
    const portSpeedTargets = new PrismaPortSpeedTargetsQuery(
      this.prisma,
      this.serverOnSite
    );
    const portExpectedSpeeds = new PrismaPortExpectedSpeedRepository(
      this.prisma
    );
    const routerPortInspector = new RouterPortInspector(
      this.serverOnSite
        ? new RouterOsPortReader(this.logger)
        : new AgentChannelPortReader(connectedAgents),
      portExpectedSpeeds
    );
    this.portSpeedController = new PortSpeedController(
      new ListRouterPortSpeedsUseCase(
        portSpeedTargets,
        routerPortInspector,
        this.logger
      ),
      new SetPortExpectedSpeedUseCase(
        portSpeedTargets,
        portExpectedSpeeds,
        this.logger
      ),
      new AcceptCurrentPortSpeedsUseCase(
        portSpeedTargets,
        routerPortInspector,
        portExpectedSpeeds,
        this.logger
      ),
      new GetRouterPortSpeedsUseCase(
        portSpeedTargets,
        routerPortInspector,
        this.logger
      ),
      this.logger
    );
    // MON-160..MON-163: what each MikroTik says about itself, read with
    // allowed RouterOS commands; off site through the router's agent
    // (AGT-123).
    const routerSystemRecorder = new RouterSystemRecorder(
      new RouterOsSystemReader(
        this.serverOnSite
          ? new RouterOsApiPrinter(this.logger)
          : new AgentChannelRouterOsPrinter(connectedAgents)
      ),
      new PrismaRouterSystemStateRepository(this.prisma)
    );
    const routerHealthThresholds =
      new PrismaRouterHealthThresholdsRepository(this.prisma);
    const configurePollingUseCase = new ConfigureDevicePollingUseCase(
      this.pollingConfigRepository,
      suspendDeviceMonitoringUseCase,
      this.logger
    );
    // R17: vendor-set terms, read on every call so a payment recorded from
    // the dashboard applies at once (INS-028); none means not enforced.
    const getSubscriptionStatusUseCase =
      (this.getSubscriptionStatusUseCase =
        new GetSubscriptionStatusUseCase(
          this.vendorSettingsRepository,
          this.logger
        ));
    this.vendorSettingsController = new VendorSettingsController(
      new GetVendorSettingsUseCase(
        this.vendorSettingsRepository,
        this.logger
      ),
      new UpdateVendorSettingsUseCase(
        this.vendorSettingsRepository,
        this.logger
      ),
      this.logger
    );
    this.subscriptionController = new SubscriptionController(
      getSubscriptionStatusUseCase,
      this.logger
    );

    // R7: what monitoring and notifications know about agents, read-only.
    const agentStatusQuery = new PrismaAgentStatusQuery(
      this.prisma,
      this.serverOnSite
    );
    const getPollingStatusUseCase = new GetDevicePollingStatusUseCase(
      this.pollingConfigRepository,
      this.deviceStateRepository,
      this.pingResultRepository,
      this.logger,
      agentStatusQuery
    );
    const listPollingStatusesUseCase =
      new ListDevicePollingStatusesUseCase(
        new PrismaPollingStatusListQuery(this.prisma),
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
      listPollingStatusesUseCase,
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
    const installersDir = loadInstallersDir(process.env);
    const installerStore = installersDir
      ? new FileSystemInstallerStore(installersDir)
      : null;
    this.installationController = new InstallationController(
      {
        modules: {
          customers: this.modules.has('customers'),
          billing: this.modules.has('billing'),
          quoting: this.modules.has('quoting'),
          tickets: this.modules.has('tickets'),
          enforcement: this.modules.has('enforcement')
        },
        serverOnSite: this.serverOnSite,
        agentPairingAvailable: agentPublicUrl !== null,
        installersAvailable: installerStore !== null
      },
      new ListInstallersUseCase(installerStore, this.logger),
      new GetInstallerUseCase(installerStore, this.logger),
      this.logger
    );
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
      new ListAgentOutagesUseCase(
        agentRepository,
        new PrismaAgentOutageQuery(this.prisma),
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
    const authenticateAgentUseCase = new AuthenticateAgentUseCase(
      agentRepository,
      agentSecrets,
      this.logger
    );
    // Releases sit beside the installers (AGT-082); without the folder no
    // release is offered.
    const agentReleases = new FileSystemAgentReleaseCatalog(
      installersDir,
      this.logger
    );
    this.agentUpdateController = new AgentUpdateController(
      authenticateAgentUseCase,
      new OpenAgentReleaseFileUseCase(agentReleases, this.logger),
      this.logger
    );
    this.agentGateway = new AgentGateway(
      authenticateAgentUseCase,
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
        subscriptionStatus: getSubscriptionStatusUseCase,
        updateOffer: new GetAgentUpdateOfferUseCase(
          agentRepository,
          agentReleases,
          this.logger
        ),
        recordUpdateOutcome: new RecordAgentUpdateOutcomeUseCase(
          agentRepository,
          this.logger
        )
      },
      connectedAgents,
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

    // Fail-fast without a bot token. The install's chat is read from the
    // dashboard settings on each send (NOT-200), env TELEGRAM_CHAT_ID being
    // only their default.
    const telegramNotificationService =
      new TelegramNotificationService(async () => {
        const settings =
          await this.notificationSettingsRepository.get();
        return settings.isSuccess
          ? settings.value.telegramChatId
          : null;
      });
    this.notificationSettingsController =
      new NotificationSettingsController(
        new GetNotificationSettingsUseCase(
          this.notificationSettingsRepository,
          this.logger
        ),
        new UpdateNotificationSettingsUseCase(
          this.notificationSettingsRepository,
          this.logger
        ),
        new SendTestNotificationUseCase(
          this.notificationSettingsRepository,
          new TelegramTestMessageSender(telegramNotificationService),
          this.logger
        ),
        this.logger
      );

    // Initialize notification use cases. The single renderer +
    // AlertPublisher adapter are built first so every alert-producing
    // use case can deliver through the one shared spine.
    const appPublicUrl = loadAppPublicUrl(process.env);
    const pushSubscriptionRepository =
      new PrismaPushSubscriptionRepository(this.prisma);
    // NOT-228: phone notifications only once the VAPID keys are set.
    const webPushConfig = loadWebPushConfig(
      process.env,
      appPublicUrl
    );
    const pushSender = webPushConfig
      ? new WebPushSender(webPushConfig)
      : null;
    this.pushController = new PushController(
      webPushConfig?.publicKey ?? null,
      new SubscribePushUseCase(
        pushSubscriptionRepository,
        this.logger
      ),
      new UnsubscribePushUseCase(
        pushSubscriptionRepository,
        this.logger
      ),
      // Unreachable without keys: the controller answers 503 first.
      new SendTestPushUseCase(
        pushSubscriptionRepository,
        pushSender ?? {
          send: async () => Result.fail('Push not configured')
        },
        this.logger
      ),
      this.logger
    );
    // Every live stream (inbox, throughput, diagnosis, traffic) shares this
    // one SSE hub, so the install-wide connection cap counts them all.
    this.eventStreamHub = new SseBroadcaster(this.logger);

    const inboxNotificationRepository =
      new PrismaInboxNotificationRepository(this.prisma);
    const inboxStream = new InboxStream(
      this.eventStreamHub,
      inboxNotificationRepository,
      this.logger
    );
    const getUnreadInboxCountUseCase = new GetUnreadInboxCountUseCase(
      inboxNotificationRepository,
      this.logger
    );
    this.inboxNotificationController =
      new InboxNotificationController(
        new ListInboxNotificationsUseCase(
          inboxNotificationRepository,
          this.logger
        ),
        getUnreadInboxCountUseCase,
        new MarkInboxNotificationReadUseCase(
          inboxNotificationRepository,
          inboxStream,
          this.logger
        ),
        new MarkAllInboxNotificationsReadUseCase(
          inboxNotificationRepository,
          inboxStream,
          this.logger
        ),
        this.logger
      );
    this.inboxStreamController = new InboxStreamController(
      getUnreadInboxCountUseCase,
      this.eventStreamHub,
      this.logger
    );
    const sendAlertNotificationUseCase =
      new SendAlertNotificationUseCase(
        this.deviceRepository,
        telegramNotificationService,
        this.logger,
        appPublicUrl
      );
    // Wraps the real publisher so every alert-producing path below (down,
    // recovery, wireless — they all share this one instance) gets
    // quiet-hours suppression for free.
    // An expired subscription (R17) silences every delivery.
    const deliveryPublisher = new SubscriptionAlertPublisher(
      new QuietHoursAlertPublisher(
        new MutedTypeAlertPublisher(
          pushSender
            ? new FanOutAlertPublisher([
                new AlertPublisher(sendAlertNotificationUseCase),
                new PushAlertPublisher(
                  new SendPushAlertUseCase(
                    pushSubscriptionRepository,
                    pushSender,
                    this.logger
                  ),
                  this.logger
                )
              ])
            : new AlertPublisher(sendAlertNotificationUseCase),
          this.mutedAlertTypeRepository,
          this.logger
        ),
        this.deviceNotificationPolicyRepository,
        this.notificationSettingsRepository,
        this.logger
      ),
      getSubscriptionStatusUseCase,
      this.logger
    );
    // NOT-267: the inbox sits outside every filter, so it records what they
    // keep off Telegram and phones.
    const recordInboxNotificationUseCase =
      new RecordInboxNotificationUseCase(
        inboxNotificationRepository,
        new PrismaInboxRecipientsQuery(this.prisma),
        inboxStream,
        this.logger
      );
    const alertPublisher = new InboxAlertPublisher(
      deliveryPublisher,
      recordInboxNotificationUseCase,
      this.logger
    );

    // DEV-200..207: hosts the network shows that inventory lacks.
    const discoveredDeviceRepository =
      new PrismaDiscoveredDeviceRepository(this.prisma);
    this.deviceSightingRecorder = new DeviceSightingRecorder(
      discoveredDeviceRepository,
      new PrismaKnownDeviceLookup(this.prisma),
      new InboxDiscoveryNotifier(
        recordInboxNotificationUseCase,
        this.logger
      )
    );
    // DEV-214: a segment is scanned from the server or from its agent.
    const segmentScanner = new SegmentScanner(
      networkScannerService,
      new AgentChannelHostDiscovery(connectedAgents)
    );
    const scanNetworkSegmentUseCase = new ScanNetworkSegmentUseCase(
      segmentScanner,
      this.deviceSightingRecorder,
      agentAssignmentQuery,
      this.logger,
      this.serverOnSite
    );
    this.scanController = new ScanController(
      scanNetworkSegmentUseCase,
      this.logger
    );
    this.discoveredDeviceController = new DiscoveredDeviceController(
      new ListDiscoveredDevicesUseCase(
        new PrismaDiscoveredDeviceListQuery(this.prisma),
        this.logger
      ),
      new IgnoreDiscoveredDeviceUseCase(
        discoveredDeviceRepository,
        this.logger
      ),
      new UnignoreDiscoveredDeviceUseCase(
        discoveredDeviceRepository,
        this.logger
      ),
      new GetDiscoveredDevicePrefillUseCase(
        discoveredDeviceRepository,
        new PrismaDiscoveryPrefillQuery(this.prisma),
        this.logger
      ),
      this.logger
    );
    this.purgeStaleDiscoveredDevicesUseCase =
      new PurgeStaleDiscoveredDevicesUseCase(
        discoveredDeviceRepository
      );

    // DEV-210..213: the scheduled scan.
    const discoverySettingsRepository =
      new PrismaDiscoverySettingsRepository(this.prisma);
    this.discoverySettingsController =
      new DiscoverySettingsController(
        new GetDiscoverySettingsUseCase(
          discoverySettingsRepository,
          this.logger
        ),
        new UpdateDiscoverySettingsUseCase(
          discoverySettingsRepository,
          agentAssignmentQuery,
          this.logger,
          this.serverOnSite
        ),
        this.logger
      );
    this.discoveryScanOrchestrator = new DiscoveryScanOrchestrator(
      new RunScheduledDiscoveryUseCase(
        discoverySettingsRepository,
        segmentScanner,
        this.deviceSightingRecorder,
        this.serverOnSite
      ),
      {},
      this.logger
    );
    this.portSpeedCheckOrchestrator = new PortSpeedCheckOrchestrator(
      new CheckPortSpeedsUseCase(
        portSpeedTargets,
        routerPortInspector,
        portExpectedSpeeds,
        alertPublisher,
        this.logger
      ),
      { checkIntervalMs: loadPortSpeedCheckIntervalMs(process.env) },
      this.logger
    );
    const routerSystemNotifier = new RouterSystemNotifier(
      alertPublisher,
      new PrismaReportedOutageQuery(this.prisma),
      this.logger
    );
    this.routerSystemController = new RouterSystemController(
      new ListRouterSystemsUseCase(
        portSpeedTargets,
        routerSystemRecorder,
        this.logger
      ),
      new GetRouterSystemUseCase(
        portSpeedTargets,
        routerSystemRecorder,
        routerSystemNotifier,
        this.logger
      ),
      new GetRouterHealthThresholdsUseCase(
        routerHealthThresholds,
        this.logger
      ),
      new UpdateRouterHealthThresholdsUseCase(
        routerHealthThresholds,
        this.logger
      ),
      this.logger
    );
    this.routerSystemCheckOrchestrator =
      new RouterSystemCheckOrchestrator(
        new CheckRouterSystemsUseCase(
          portSpeedTargets,
          routerSystemRecorder,
          routerHealthThresholds,
          routerSystemNotifier,
          this.logger
        ),
        {
          checkIntervalMs: loadRouterSystemCheckIntervalMs(
            process.env
          )
        },
        this.logger
      );

    const outageTopologyQuery = new PrismaOutageTopologyQuery(
      this.prisma
    );
    const outageRollup = new OutageRollup(
      this.alertRepository,
      outageTopologyQuery,
      this.logger
    );
    const sendDeviceDownAlertUseCase = new SendDeviceDownAlertUseCase(
      this.alertRepository,
      this.pollingConfigRepository,
      this.deviceRepository,
      deviceEligibilityService,
      alertPublisher,
      this.logger,
      this.ticketOpener,
      outageRollup
    );
    const sendDeviceRecoveryAlertUseCase =
      new SendDeviceRecoveryAlertUseCase(
        this.alertRepository,
        this.deviceRepository,
        alertPublisher,
        this.logger,
        outageRollup,
        // NOT-270: nothing is delivered, only the inbox records it.
        new InboxAlertPublisher(
          { publish: async () => Result.ok() },
          recordInboxNotificationUseCase,
          this.logger
        )
      );

    const raiseOverdueDeviceDownAlertsUseCase =
      new RaiseOverdueDeviceDownAlertsUseCase(
        this.deviceStateRepository,
        this.deviceNotificationPolicyRepository,
        sendDeviceDownAlertUseCase,
        this.notificationSettingsRepository,
        this.logger,
        agentStatusQuery,
        this.alertRepository,
        outageTopologyQuery
      );
    const resolveStrandedDeviceDownAlertsUseCase =
      new ResolveStrandedDeviceDownAlertsUseCase(
        this.alertRepository,
        this.deviceStateRepository,
        this.logger
      );
    this.overdueDeviceDownAlertOrchestrator =
      new OverdueDeviceDownAlertOrchestrator(
        raiseOverdueDeviceDownAlertsUseCase,
        resolveStrandedDeviceDownAlertsUseCase,
        { checkIntervalMs: 60_000 },
        this.logger
      );

    // Wireless alert delivery can be switched off from the dashboard so
    // wireless polling runs without paging anyone (NOT-203). Device
    // availability alerts (down/recovery) are unaffected by the switch.
    const wirelessAlertPublisher = new InboxAlertPublisher(
      new SwitchedOffAlertPublisher(
        deliveryPublisher,
        this.notificationSettingsRepository,
        this.logger
      ),
      recordInboxNotificationUseCase,
      this.logger
    );
    const listAlertsUseCase = new ListAlertsUseCase(
      new PrismaAlertListQuery(this.prisma),
      this.logger,
      this.modules.has('tickets')
    );
    const getAlertByIdUseCase = new GetAlertByIdUseCase(
      this.alertRepository,
      this.logger,
      outageRollup
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
      deviceEligibilityService,
      new UpstreamAssignment(this.deviceRepository)
    );
    const deviceReach = new DeviceReachAdapter(
      this.serverOnSite,
      this.deviceRepository
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
      this.alertThresholdsRepository,
      wirelessAlertPublisher,
      this.logger,
      new AgentChannelRadioReader(connectedAgents),
      DEFAULT_ALERT_CONFIRMATION,
      new StationSightingsAdapter(this.deviceSightingRecorder)
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
    const deviceHardwareQuery = new PrismaDeviceHardwareQuery(
      this.prisma
    );
    const hardwareChangeAssessor = new HardwareChangeAssessor(
      deviceHardwareQuery,
      this.logger
    );
    const getDeviceIdentitySuggestionsUseCase =
      new GetDeviceIdentitySuggestionsUseCase(
        this.wirelessSnapshotRepository,
        this.wirelessDeviceConfigRepository,
        wirelessDeviceRepo,
        deviceHardwareQuery,
        hardwareChangeAssessor,
        this.logger
      );
    const getHardwareChangesUseCase = new GetHardwareChangesUseCase(
      deviceHardwareQuery,
      hardwareChangeAssessor,
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
      getHardwareChangesUseCase,
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

    const radioTargetSources = {
      configRepo: this.wirelessDeviceConfigRepository,
      loginSource: new RadioLoginAdapter(
        this.deviceCredentialsRepository
      ),
      vendorLookup: deviceVendorLookup,
      deviceReach
    };
    const radioSettingsGateway = new RadioSettingsGateway(
      airOsHttpClient,
      new RadioHostnameWriterRegistry({
        ubiquiti: new AirOsHostnameWriter(new SshCommandClient())
      }),
      new AgentChannelRadioSettings(connectedAgents)
    );
    this.radioSettingsController = new RadioSettingsController(
      new RevealWirelessKeyUseCase(
        radioTargetSources,
        radioSettingsGateway,
        this.logger
      ),
      new RenameRadioUseCase(
        radioTargetSources,
        radioSettingsGateway,
        this.logger
      ),
      this.logger
    );

    // Live throughput (SSE)

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
      this.alertThresholdsRepository,
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

    this.alertThresholdsController = new AlertThresholdsController(
      new GetAlertThresholdsUseCase(
        this.alertThresholdsRepository,
        this.logger
      ),
      new UpdateAlertThresholdsUseCase(
        this.alertThresholdsRepository,
        this.logger
      ),
      new GetDeviceAlertThresholdsUseCase(
        this.wirelessDeviceConfigRepository,
        this.alertThresholdsRepository,
        this.logger
      ),
      new UpdateDeviceAlertThresholdsUseCase(
        this.wirelessDeviceConfigRepository,
        this.alertThresholdsRepository,
        this.logger
      ),
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

    // Live router traffic (MON-060); off site the routers are read through
    // their agent (MON-065).
    this.routerTrafficMonitor = new RouterTrafficMonitor(
      new PrismaRouterTrafficTargetsQuery(this.prisma),
      this.serverOnSite
        ? new RouterOsTrafficReader(this.logger)
        : new AgentChannelTrafficReader(connectedAgents),
      this.eventStreamHub,
      this.logger
    );

    this.wirelessStreamController = new WirelessStreamController(
      getWirelessThroughputUseCase,
      getFleetWirelessThroughputUseCase,
      getLinkDiagnosisUseCase,
      new WatchRouterTrafficUseCase(
        this.routerTrafficMonitor,
        this.logger
      ),
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
      new RevealDeviceCredentialsUseCase(
        this.deviceCredentialsRepository,
        this.logger
      ),
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
    const purgeOldInboxNotificationsUseCase =
      new PurgeOldInboxNotificationsUseCase(
        inboxNotificationRepository
      );

    const triggerDataRetentionUseCase =
      new TriggerDataRetentionUseCase(
        purgeOldPingResultsUseCase,
        purgeOldAlertsUseCase,
        purgeOldWirelessSnapshotsUseCase,
        purgeOldWirelessAlertRecordsUseCase,
        this.vendorSettingsRepository
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
      purgeOldInboxNotificationsUseCase,
      this.purgeStaleDiscoveredDevicesUseCase,
      { deletedDeviceGraceDays },
      this.vendorSettingsRepository,
      this.logger
    );

    // =====================================
    // DEVICE BACKUPS
    // =====================================

    // Shares the poller's AirOS client, so a backup reuses its open session.
    const backupTargets = new PrismaBackupTargetsQuery(
      this.prisma,
      this.serverOnSite
    );
    const configBackupRepository = new PrismaConfigBackupRepository(
      this.prisma
    );
    const deviceBackupStateRepository =
      new PrismaDeviceBackupStateRepository(this.prisma);
    const deviceConfigBackupService = new DeviceConfigBackupService(
      new ConfigFetcherRegistry([
        {
          vendor: 'ubiquiti',
          kinds: ['ACCESS_POINT', 'STATION'],
          fetcher: new AirOsConfigFetcher(airOsHttpClient)
        },
        {
          vendor: 'mikrotik',
          kinds: ['ACCESS_POINT', 'STATION', 'ROUTER', 'SWITCH'],
          fetcher: new RouterOsConfigFetcher(
            new SshCommandClient({ maxOutputBytes: MAX_CONFIG_BYTES })
          )
        }
      ]),
      configBackupRepository,
      deviceBackupStateRepository,
      new AgentChannelConfigFetcher(connectedAgents)
    );
    this.deviceBackupController = new DeviceBackupController(
      new ListDeviceBackupsUseCase(
        backupTargets,
        configBackupRepository,
        deviceBackupStateRepository,
        this.logger
      ),
      new BackUpDeviceNowUseCase(
        backupTargets,
        deviceConfigBackupService,
        this.logger
      ),
      new DownloadDeviceBackupUseCase(
        backupTargets,
        configBackupRepository,
        this.logger
      ),
      this.logger
    );
    this.configBackupOrchestrator = new ConfigBackupOrchestrator(
      new RunScheduledBackupsUseCase(
        backupTargets,
        deviceBackupStateRepository,
        deviceConfigBackupService,
        this.logger
      ),
      {},
      this.logger
    );

    // =====================================
    // POWER CONTROL
    // =====================================

    const poeSwitchTargets = new PrismaPoeSwitchTargetsQuery(
      this.prisma,
      this.serverOnSite
    );
    const sitePoeInspector = new SitePoeInspector(
      poeSwitchTargets,
      new PoeSwitchReaderRegistry({
        ROUTEROS: new RouterOsPoeReader(this.logger),
        SWOS: new SwOsPoeReader(this.logger)
      })
    );
    // Built after power control: suggestions read the PoE switches live.
    const topologyQuery = new PrismaTopologyQuery(
      this.prisma,
      this.serverOnSite
    );
    this.topologyController = new TopologyController(
      new GetTopologyUseCase(topologyQuery, this.logger),
      new GetDeviceDescendantsUseCase(topologyQuery, this.logger),
      new ListUpstreamSuggestionsUseCase(
        topologyQuery,
        new PrismaReportedApQuery(this.prisma),
        new PoweringSwitchQueryAdapter(
          new PoweredDeviceSurvey(poeSwitchTargets, sitePoeInspector)
        ),
        this.logger
      ),
      new AcceptUpstreamSuggestionsUseCase(
        this.deviceRepository,
        this.logger
      ),
      this.logger
    );
    this.powerControlController = new PowerControlController(
      new ListSitePoePortsUseCase(
        poeSwitchTargets,
        sitePoeInspector,
        this.logger
      ),
      new GetDevicePowerSourceUseCase(
        poeSwitchTargets,
        sitePoeInspector,
        this.logger
      ),
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
      ContractedServiceCancelledEvent.name,
      new ContractedServiceCancelledDeviceHandler(
        new RetireDeviceAfterCancellationUseCase(
          this.deviceRepository,
          this.logger
        ),
        this.logger
      )
    );
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
    // the customer's settings, not the vendor's. The vendor chat is read from
    // the vendor settings on every send (INS-028).
    const vendorChatId = async (): Promise<string | null> => {
      const settings = await this.vendorSettingsRepository.get();
      return settings.isSuccess
        ? settings.value.vendorTelegramChatId
        : null;
    };
    const vendorBotToken =
      process.env.TELEGRAM_VENDOR_BOT_TOKEN?.trim() ||
      process.env.TELEGRAM_BOT_TOKEN;
    const vendorPublisher = new WhenConfiguredAlertPublisher(
      new SubscriptionAlertPublisher(
        new InstallLabelAlertPublisher(
          new AlertPublisher(
            new SendAlertNotificationUseCase(
              this.deviceRepository,
              new TelegramNotificationService(
                vendorChatId,
                vendorBotToken
              ),
              this.logger
            )
          ),
          agentPublicUrl
            ? new URL(agentPublicUrl).host
            : 'sin AGENT_PUBLIC_URL'
        ),
        getSubscriptionStatusUseCase,
        this.logger
      ),
      async () => (await vendorChatId()) !== null
    );
    const agentHealthPublisher = new FanOutAlertPublisher([
      alertPublisher,
      vendorPublisher
    ]);
    // BKP-061, BKP-062: through the shared publisher, so quiet hours and
    // muted types apply.
    EventDispatcher.register(
      DeviceBackupFailingEvent.name,
      new DeviceBackupFailingNotificationHandler(
        alertPublisher,
        this.logger
      )
    );
    EventDispatcher.register(
      UserSignInPausedEvent.name,
      new UserSignInPausedNotificationHandler(
        alertPublisher,
        this.logger
      )
    );
    EventDispatcher.register(
      UserTwoFactorResetEvent.name,
      new UserTwoFactorResetNotificationHandler(
        alertPublisher,
        this.logger
      )
    );
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
    // AGT-084: the vendor's alone; nothing changes for the customer.
    EventDispatcher.register(
      AgentUpdateFailedEvent.name,
      new AgentUpdateFailedNotificationHandler(
        vendorPublisher,
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

    EventDispatcher.register(
      WirelessAlertClearedEvent.name,
      new WirelessAlertClearedNotificationHandler(
        wirelessAlertPublisher,
        this.logger
      )
    );

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
    // without them must keep booting. The access token turns them on; the
    // phone number and template are the vendor's settings, read on every send
    // (INS-028).
    if (process.env.WHATSAPP_ACCESS_TOKEN) {
      const whatsAppNotificationService =
        new WhatsAppNotificationService(async () => {
          const settings = await this.vendorSettingsRepository.get();
          return settings.isSuccess ? settings.value.whatsApp : null;
        });
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
        'WHATSAPP_ACCESS_TOKEN not set — WhatsApp notices disabled'
      );
    }

    // The module switch decides whether enforcement exists at all; the router
    // setting alone must never turn it on (SVC-063). Within the module the
    // router is the vendor's setting, read on every operation (INS-028):
    // until it is set, operations answer "not configured" and the
    // reconciliation job waits.
    if (!this.modules.has('enforcement')) {
      if (process.env.ENFORCEMENT_ROUTER_DEVICE_ID) {
        this.logger.warn(
          'ENFORCEMENT_ROUTER_DEVICE_ID is set but the enforcement module is disabled — ignoring it'
        );
      }
    } else {
      const routerResolver = new EnforcementRouterResolver(
        this.deviceRepository,
        this.deviceCredentialsRepository,
        this.vendorSettingsRepository
      );
      // Off site the router is reached through its agent (SVC-070).
      const routerQueueService = this.serverOnSite
        ? new RouterOsQueueService(this.logger)
        : new AgentRouterQueueService(connectedAgents);
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
      },
      {
        name: 'config-backups',
        ...bindJob(this.configBackupOrchestrator)
      },
      {
        name: 'discovery-scan',
        ...bindJob(this.discoveryScanOrchestrator)
      },
      {
        name: 'port-speed-check',
        ...bindJob(this.portSpeedCheckOrchestrator)
      },
      {
        name: 'router-system-check',
        ...bindJob(this.routerSystemCheckOrchestrator)
      }
    ];
    if (this.billingCycleOrchestrator) {
      supervisedJobs.push({
        name: 'billing-cycle',
        ...bindJob(this.billingCycleOrchestrator)
      });
    }
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

  // A vendor account that cannot be put in place stops the boot: the install
  // would otherwise run with nobody able to manage its agents.
  public async ensureVendorAccount(): Promise<void> {
    if (!this.vendorAccount) {
      this.logger.warn('No vendor account configured (VENDOR_EMAIL)');
      return;
    }
    const result = await this.ensureVendorAccountUseCase.execute(
      this.vendorAccount
    );
    if (result.isFailure) {
      throw new Error(`Vendor account: ${result.error}`);
    }
    this.logger.info(
      `Vendor account ${this.vendorAccount.email}: ${result.value.outcome}`
    );
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
