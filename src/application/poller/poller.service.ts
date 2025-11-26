import {
  IPollerServiceWithEvents,
  PollingConfig,
  NetworkDevice,
  PollingResult,
  PollingStatus,
  DeviceEvent,
  DeviceEventType,
  PollerStatus,
  PollerEventHandlers,
  PollingError,
  CommunicationMethod
} from '../../shared/interfaces/PollerService.interface';

/**
 * Internal device state for tracking polling
 */
interface DeviceState {
  device: NetworkDevice;
  isPaused: boolean;
  lastPollTime: number;
  consecutiveFailures: number;
  intervalId?: NodeJS.Timeout;
}

/**
 * Poller Service Implementation
 *
 * Executes polling jobs against network devices and reports results.
 * Stateless, horizontally scalable worker service.
 */
export class PollerService implements IPollerServiceWithEvents {
  private devices: Map<string, DeviceState> = new Map();
  private config: PollingConfig | null = null;
  private isRunning: boolean = false;
  private handlers: PollerEventHandlers = {};
  private concurrencyLimit: number;
  private activePolls: number = 0;
  private pollQueue: string[] = [];

  // Statistics tracking
  private totalPolls: number = 0;
  private successfulPolls: number = 0;
  private lastPollTimestamp: string | null = null;
  private responseTimes: number[] = [];

  constructor(concurrencyLimit: number = 50) {
    this.concurrencyLimit = concurrencyLimit;
  }

  /**
   * Initialize the poller with configuration
   */
  async initialize(config: PollingConfig): Promise<void> {
    this.config = config;

    // Initialize device states
    for (const device of config.devices) {
      this.devices.set(device.apId, {
        device,
        isPaused: device.isPaused,
        lastPollTime: 0,
        consecutiveFailures: 0
      });
    }

    console.log(
      `[PollerService] Initialized with ${config.devices.length} devices`
    );
  }

  /**
   * Start polling all non-paused devices
   */
  async start(): Promise<void> {
    if (!this.config) {
      throw new Error(
        'Poller not initialized. Call initialize() first.'
      );
    }

    if (this.isRunning) {
      console.warn('[PollerService] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[PollerService] Starting poller...');

    // Start polling loops for each device
    for (const [apId, state] of this.devices.entries()) {
      if (!state.isPaused) {
        this.startDevicePolling(apId);
      }
    }

    console.log('[PollerService] Poller started');
  }

  /**
   * Stop all polling operations
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    // Clear all interval timers
    for (const state of this.devices.values()) {
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = undefined;
      }
    }

    // Wait for active polls to complete
    while (this.activePolls > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log('[PollerService] Poller stopped');
  }

  /**
   * Add new devices to poll at runtime
   */
  async addDevices(devices: NetworkDevice[]): Promise<void> {
    for (const device of devices) {
      if (this.devices.has(device.apId)) {
        console.warn(
          `[PollerService] Device ${device.apId} already exists, skipping`
        );
        continue;
      }

      this.devices.set(device.apId, {
        device,
        isPaused: device.isPaused,
        lastPollTime: 0,
        consecutiveFailures: 0
      });

      // Start polling if service is running and device is not paused
      if (this.isRunning && !device.isPaused) {
        this.startDevicePolling(device.apId);
      }

      console.log(`[PollerService] Added device ${device.apId}`);
    }
  }

  /**
   * Remove devices from polling at runtime
   */
  async removeDevices(apIds: string[]): Promise<void> {
    for (const apId of apIds) {
      const state = this.devices.get(apId);
      if (!state) {
        console.warn(`[PollerService] Device ${apId} not found`);
        continue;
      }

      // Stop polling for this device
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = undefined;
      }

      this.devices.delete(apId);
      console.log(`[PollerService] Removed device ${apId}`);
    }
  }

  /**
   * Pause polling for specific devices
   */
  async pauseDevices(apIds: string[]): Promise<void> {
    for (const apId of apIds) {
      const state = this.devices.get(apId);
      if (!state) {
        console.warn(`[PollerService] Device ${apId} not found`);
        continue;
      }

      state.isPaused = true;

      // Stop the polling interval
      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = undefined;
      }

      console.log(`[PollerService] Paused device ${apId}`);
    }
  }

  /**
   * Resume polling for specific devices
   */
  async resumeDevices(apIds: string[]): Promise<void> {
    for (const apId of apIds) {
      const state = this.devices.get(apId);
      if (!state) {
        console.warn(`[PollerService] Device ${apId} not found`);
        continue;
      }

      state.isPaused = false;

      // Start polling if service is running
      if (this.isRunning) {
        this.startDevicePolling(apId);
      }

      console.log(`[PollerService] Resumed device ${apId}`);
    }
  }

  /**
   * Modify IP addresses for existing devices
   */
  async modifyIpAddresses(
    modifications: Map<string, string>
  ): Promise<void> {
    for (const [apId, newIpAddress] of modifications.entries()) {
      const state = this.devices.get(apId);
      if (!state) {
        console.warn(`[PollerService] Device ${apId} not found`);
        continue;
      }

      state.device.ipAddress = newIpAddress;
      console.log(
        `[PollerService] Updated IP for ${apId} to ${newIpAddress}`
      );
    }
  }

  /**
   * Update polling configuration at runtime
   */
  async updateConfig(
    config: Partial<Omit<PollingConfig, 'devices'>>
  ): Promise<void> {
    if (!this.config) {
      throw new Error('Poller not initialized');
    }

    // Update configuration
    this.config = { ...this.config, ...config };

    // Restart polling with new configuration if running
    if (this.isRunning) {
      await this.stop();
      await this.start();
    }

    console.log('[PollerService] Configuration updated');
  }

  /**
   * Get current polling status
   */
  getStatus(): PollerStatus {
    const totalDevices = this.devices.size;
    const activeDevices = Array.from(this.devices.values()).filter(
      (s) => !s.isPaused
    ).length;
    const pausedDevices = totalDevices - activeDevices;

    const successRate =
      this.totalPolls > 0
        ? (this.successfulPolls / this.totalPolls) * 100
        : 0;

    const averageResponseTime =
      this.responseTimes.length > 0
        ? this.responseTimes.reduce((sum, t) => sum + t, 0) /
          this.responseTimes.length
        : null;

    return {
      isRunning: this.isRunning,
      totalDevices,
      activeDevices,
      pausedDevices,
      lastPollTimestamp: this.lastPollTimestamp,
      successRate,
      averageResponseTime
    };
  }

  /**
   * Handle device events from Poller Controller
   */
  async handleDeviceEvent(event: DeviceEvent): Promise<void> {
    switch (event.type) {
      case DeviceEventType.ADDED:
        await this.addDevices([event.device]);
        break;
      case DeviceEventType.REMOVED:
        await this.removeDevices([event.device.apId]);
        break;
      case DeviceEventType.PAUSED:
        await this.pauseDevices([event.device.apId]);
        break;
      case DeviceEventType.RESUMED:
        await this.resumeDevices([event.device.apId]);
        break;
      default:
        console.warn(
          `[PollerService] Unknown event type: ${event.type}`
        );
    }
  }

  /**
   * Register event handlers
   */
  registerHandlers(handlers: PollerEventHandlers): void {
    this.handlers = handlers;
    console.log('[PollerService] Event handlers registered');
  }

  /**
   * Unregister event handlers
   */
  unregisterHandlers(): void {
    this.handlers = {};
    console.log('[PollerService] Event handlers unregistered');
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Start polling loop for a specific device
   */
  private startDevicePolling(apId: string): void {
    const state = this.devices.get(apId);
    if (!state || !this.config) return;

    // Clear existing interval if any
    if (state.intervalId) {
      clearInterval(state.intervalId);
    }

    // Create new polling interval
    state.intervalId = setInterval(() => {
      this.pollDevice(apId);
    }, this.config.intervalMs);

    // Poll immediately on start
    this.pollDevice(apId);
  }

  /**
   * Poll a single device
   */
  private async pollDevice(apId: string): Promise<void> {
    const state = this.devices.get(apId);
    if (!state || !this.config || state.isPaused) return;

    // Respect concurrency limit
    if (this.activePolls >= this.concurrencyLimit) {
      this.pollQueue.push(apId);
      return;
    }

    this.activePolls++;

    try {
      const result = await this.executePolling(
        state.device,
        this.config
      );

      // Update statistics
      this.totalPolls++;
      if (result.success) {
        this.successfulPolls++;
        state.consecutiveFailures = 0;

        // Track response times (keep last 100)
        if (result.avgTime !== null) {
          this.responseTimes.push(result.avgTime);
          if (this.responseTimes.length > 100) {
            this.responseTimes.shift();
          }
        }
      } else {
        state.consecutiveFailures++;
      }

      state.lastPollTime = Date.now();
      this.lastPollTimestamp = result.timestamp;

      // Call result handler if registered
      if (this.handlers.onResult) {
        await this.handlers.onResult(result);
      }
    } catch (error) {
      console.error(`[PollerService] Error polling ${apId}:`, error);

      const pollingError: PollingError = {
        apId: state.device.apId,
        ipAddress: state.device.ipAddress,
        timestamp: new Date().toISOString(),
        error: error as Error,
        context: { consecutiveFailures: state.consecutiveFailures }
      };

      // Call error handler if registered
      if (this.handlers.onError) {
        await this.handlers.onError(pollingError);
      }
    } finally {
      this.activePolls--;

      // Process queue
      if (this.pollQueue.length > 0) {
        const nextApId = this.pollQueue.shift();
        if (nextApId) {
          this.pollDevice(nextApId);
        }
      }
    }
  }

  /**
   * Execute the actual polling based on method
   */
  private async executePolling(
    device: NetworkDevice,
    config: PollingConfig
  ): Promise<PollingResult> {
    const startTime = Date.now();
    const responseTimes: number[] = [];
    let success = false;
    let error: string | null = null;
    let status: PollingStatus = PollingStatus.ERROR;
    let attempts = 0;

    // Retry logic
    for (let i = 0; i <= config.maxRetries; i++) {
      attempts++;
      try {
        const attemptStartTime = Date.now();

        // Execute polling based on method
        switch (config.method) {
          case CommunicationMethod.ICMP:
            await this.pollIcmp(device.ipAddress, config.timeoutMs);
            break;
          case CommunicationMethod.SNMP_V2:
          case CommunicationMethod.SNMP_V3:
            await this.pollSnmp(device.ipAddress, config.timeoutMs);
            break;
          case CommunicationMethod.HTTP:
            await this.pollHttp(device.ipAddress, config.timeoutMs);
            break;
          case CommunicationMethod.VENDOR_API:
            await this.pollVendorApi(
              device.ipAddress,
              config.timeoutMs
            );
            break;
          default:
            throw new Error(
              `Unsupported polling method: ${config.method}`
            );
        }

        const responseTime = Date.now() - attemptStartTime;
        responseTimes.push(responseTime);
        success = true;
        status = PollingStatus.UP;
        break; // Success, exit retry loop
      } catch (err) {
        error = (err as Error).message;

        if (error.includes('timeout')) {
          status = PollingStatus.TIMEOUT;
        } else if (
          error.includes('unreachable') ||
          error.includes('no route')
        ) {
          status = PollingStatus.DOWN;
        }

        // If not last attempt, wait before retry
        if (i < config.maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    // Calculate statistics
    const minTime =
      responseTimes.length > 0 ? Math.min(...responseTimes) : null;
    const maxTime =
      responseTimes.length > 0 ? Math.max(...responseTimes) : null;
    const avgTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, t) => sum + t, 0) /
          responseTimes.length
        : null;

    const packetLoss =
      ((attempts - responseTimes.length) / attempts) * 100;

    return {
      apId: device.apId,
      ipAddress: device.ipAddress,
      timestamp: new Date().toISOString(),
      method: config.method,
      status,
      success,
      responseTimes,
      error,
      packetLoss,
      attempts,
      minTime,
      maxTime,
      avgTime
    };
  }

  /**
   * Poll device using ICMP (ping)
   */
  private async pollIcmp(
    ipAddress: string,
    timeoutMs: number
  ): Promise<void> {
    // Simulate ICMP polling
    // In production, use a library like 'ping' or 'net-ping'
    return new Promise((resolve, reject) => {
      const randomDelay = Math.random() * 50 + 1; // 1-51ms

      setTimeout(() => {
        // 90% success rate simulation
        if (Math.random() > 0.1) {
          resolve();
        } else {
          reject(new Error('Host unreachable'));
        }
      }, randomDelay);
    });
  }

  /**
   * Poll device using SNMP
   */
  private async pollSnmp(
    ipAddress: string,
    timeoutMs: number
  ): Promise<void> {
    // Simulate SNMP polling
    // In production, use a library like 'net-snmp'
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.05) {
          resolve();
        } else {
          reject(new Error('SNMP timeout'));
        }
      }, Math.random() * 100);
    });
  }

  /**
   * Poll device using HTTP
   */
  private async pollHttp(
    ipAddress: string,
    timeoutMs: number
  ): Promise<void> {
    // Simulate HTTP polling
    // In production, use fetch or axios with timeout
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.05) {
          resolve();
        } else {
          reject(new Error('HTTP request timeout'));
        }
      }, Math.random() * 150);
    });
  }

  /**
   * Poll device using vendor-specific API
   */
  private async pollVendorApi(
    ipAddress: string,
    timeoutMs: number
  ): Promise<void> {
    // Simulate vendor API polling
    // In production, implement vendor-specific API calls
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.05) {
          resolve();
        } else {
          reject(new Error('API request failed'));
        }
      }, Math.random() * 200);
    });
  }
}

/**
 * Factory function for creating PollerService instances
 */
export function createPollerService(
  config: PollingConfig,
  handlers?: PollerEventHandlers,
  concurrencyLimit?: number
): IPollerServiceWithEvents {
  const service = new PollerService(concurrencyLimit);

  if (handlers) {
    service.registerHandlers(handlers);
  }

  service.initialize(config);

  return service;
}
