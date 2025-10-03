// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Supported polling methods
 */
export enum CommunicationMethod {
  ICMP = 'ICMP',
  SNMP_V2 = 'SNMP_V2',
  SNMP_V3 = 'SNMP_V3',
  HTTP = 'HTTP',
  VENDOR_API = 'VENDOR_API'
}

/**
 * Network device configuration for polling
 * To Do: This interface should represent a portion of a larger Network Device configuration
 * that includes additional properties like location, model, etc.
 * For simplicity, we focus on the essential properties needed for polling.
 */
export interface NetworkDevice {
  apId: string;
  ipAddress: string;
  isPaused: boolean;
}

/**
 * Polling configuration received from Poller Controller
 */
export interface PollingConfig {
  devices: NetworkDevice[];
  intervalMs: number;
  maxRetries: number;
  timeoutMs: number;
  method: CommunicationMethod;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Status of a polling attempt
 */
export enum PollingStatus {
  UP = 'up',
  DOWN = 'down',
  TIMEOUT = 'timeout',
  ERROR = 'error'
}

/**
 * Normalized polling result
 */
export interface PollingResult {
  apId: string;
  ipAddress: string;
  timestamp: string; // ISO 8601 format
  method: CommunicationMethod;
  status: PollingStatus;
  success: boolean;
  responseTimes: number[]; // milliseconds
  error: string | null;
  packetLoss: number; // percentage (0-100)
  attempts: number;
  minTime: number | null; // milliseconds
  maxTime: number | null; // milliseconds
  avgTime: number | null; // milliseconds
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event types for runtime device management
 */
export enum DeviceEventType {
  ADDED = 'ADDED',
  REMOVED = 'REMOVED',
  PAUSED = 'PAUSED',
  RESUMED = 'RESUMED'
}

/**
 * Device management event
 */
export interface DeviceEvent {
  type: DeviceEventType;
  device: NetworkDevice;
  timestamp: string; // ISO 8601 format
}

// ============================================================================
// POLLER SERVICE INTERFACE
// ============================================================================

/**
 * Main Poller Service interface
 *
 * This service executes polling jobs against network devices and reports results.
 * It is stateless and designed to be horizontally scalable.
 */
export interface IPollerService {
  /**
   * Initialize the poller with configuration
   * @param config - Polling configuration from Poller Controller
   * @returns Promise that resolves when initialization is complete
   */
  initialize(config: PollingConfig): Promise<void>;

  /**
   * Start polling all non-paused devices
   * @returns Promise that resolves when polling has started
   */
  start(): Promise<void>;

  /**
   * Stop all polling operations
   * @returns Promise that resolves when polling has stopped
   */
  stop(): Promise<void>;

  /**
   * Add new devices to poll at runtime
   * @param devices - Array of network devices to add
   * @returns Promise that resolves when devices are added
   */
  addDevices(devices: NetworkDevice[]): Promise<void>;

  /**
   * Remove devices from polling at runtime
   * @param apIds - Array of AP IDs to remove
   * @returns Promise that resolves when devices are removed
   */
  removeDevices(apIds: string[]): Promise<void>;

  /**
   * Pause polling for specific devices
   * @param apIds - Array of AP IDs to pause
   * @returns Promise that resolves when devices are paused
   */
  pauseDevices(apIds: string[]): Promise<void>;

  /**
   * Resume polling for specific devices
   * @param apIds - Array of AP IDs to resume
   * @returns Promise that resolves when devices are resumed
   */
  resumeDevices(apIds: string[]): Promise<void>;

  /**
   * Modify IP addresses for existing devices
   * @param modifications - Map of AP ID to new IP address
   * @returns Promise that resolves when modifications are applied
   */
  modifyIpAddresses(
    modifications: Map<string, string>
  ): Promise<void>;

  /**
   * Update polling configuration at runtime
   * @param config - Partial configuration to update
   * @returns Promise that resolves when configuration is updated
   */
  updateConfig(
    config: Partial<Omit<PollingConfig, 'devices'>>
  ): Promise<void>;

  /**
   * Get current polling status
   * @returns Current status information
   */
  getStatus(): PollerStatus;

  /**
   * Handle device events from Poller Controller
   * @param event - Device management event
   * @returns Promise that resolves when event is handled
   */
  handleDeviceEvent(event: DeviceEvent): Promise<void>;
}

// ============================================================================
// STATUS TYPES
// ============================================================================

/**
 * Current status of the Poller Service
 */
export interface PollerStatus {
  isRunning: boolean;
  totalDevices: number;
  activeDevices: number;
  pausedDevices: number;
  lastPollTimestamp: string | null; // ISO 8601 format
  successRate: number; // percentage (0-100)
  averageResponseTime: number | null; // milliseconds
}

// ============================================================================
// CALLBACK/HANDLER TYPES
// ============================================================================

/**
 * Callback for when polling results are ready
 */
export type PollingResultHandler = (
  result: PollingResult
) => void | Promise<void>;

/**
 * Callback for when polling errors occur
 */
export type PollingErrorHandler = (
  error: PollingError
) => void | Promise<void>;

/**
 * Error information for polling failures
 */
export interface PollingError {
  apId: string;
  ipAddress: string;
  timestamp: string; // ISO 8601 format
  error: Error;
  context?: Record<string, unknown>;
}

/**
 * Handlers for poller events
 */
export interface PollerEventHandlers {
  onResult?: PollingResultHandler;
  onError?: PollingErrorHandler;
}

// ============================================================================
// EXTENDED INTERFACE WITH EVENT HANDLERS
// ============================================================================

/**
 * Extended Poller Service interface with event handler registration
 */
export interface IPollerServiceWithEvents extends IPollerService {
  /**
   * Register event handlers
   * @param handlers - Event handler callbacks
   */
  registerHandlers(handlers: PollerEventHandlers): void;

  /**
   * Unregister event handlers
   */
  unregisterHandlers(): void;
}

// ============================================================================
// FACTORY TYPES
// ============================================================================

/**
 * Options for creating a Poller Service instance
 */
export interface PollerServiceOptions {
  config: PollingConfig;
  handlers?: PollerEventHandlers;
  concurrencyLimit?: number; // Max number of concurrent polls
}

/**
 * Factory function type for creating Poller Service instances
 */
export type PollerServiceFactory = (
  options: PollerServiceOptions
) => IPollerServiceWithEvents;
