import { EventEmitter } from 'events';
import { AccessPointPoller } from './Poller';
import { SettingsManager } from './services/settings.service';
import {
  PollResult,
  PollerOptions,
  AccessPointConfig,
  AccessPointStats,
  SchedulerStats,
  GlobalSettings,
  DatabaseData
} from './types/';

/**
 * Manages multiple AccessPointPoller instances with dynamic configuration.
 *
 * Features:
 * - Create and manage multiple poller instances
 * - Support for global and per-AP settings
 * - Dynamic reconfiguration without stopping polls
 * - Global and individual AP pause/resume functionality
 * - Comprehensive statistics and monitoring
 * - Event emission for all polling activities
 *
 * @example
 * ```typescript
 * const scheduler = new PollingScheduler(settingsManager);
 *
 * scheduler.on('ap-poll-result', (apId, result) => {
 *   console.log(`AP ${apId} result:`, result);
 * });
 *
 * await scheduler.start();
 * ```
 */
export class PollingScheduler extends EventEmitter {
  private settingsManager: SettingsManager;
  private pollers = new Map<string, AccessPointPoller>();
  private isRunning = false;
  private isPaused = false;
  private currentGlobalSettings?: GlobalSettings;
  private currentAPList: AccessPointConfig[] = [];

  /**
   * Creates a new PollingScheduler instance
   * @param settingsManager - Settings manager that provides configuration
   */
  constructor(settingsManager: SettingsManager) {
    super();
    this.settingsManager = settingsManager;

    // Listen for settings changes
    this.settingsManager.onSettingsUpdated((settings) => {
      this.handleSettingsUpdate(settings);
    });

    this.settingsManager.onAPAdded((ap) => {
      this.handleAPAdded(ap);
    });

    this.settingsManager.onAPRemoved((apId) => {
      this.handleAPRemoved(apId);
    });
  }

  /**
   * Starts the polling scheduler
   * Loads current settings and creates pollers for all enabled access points
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Scheduler is already running');
    }

    console.log('[SCHEDULER] Starting polling scheduler...');

    this.currentSettings = this.settingsManager.getDatabaseData();
    this.isRunning = true;
    this.isPaused = this.currentSettings.globalPause || false;

    await this.initializePollers();

    if (!this.isPaused) {
      await this.startAllPollers();
    }

    this.emit('scheduler-started', {
      totalAPs: this.currentSettings.accessPoints.length,
      enabledAPs: this.currentSettings.accessPoints.filter(
        (ap) => ap.enabled !== false
      ).length
    });

    console.log('[SCHEDULER] Polling scheduler started');
  }

  /**
   * Stops the polling scheduler and all active pollers
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[SCHEDULER] Stopping polling scheduler...');

    // Stop all pollers
    const stopPromises = Array.from(this.pollers.values()).map(
      (poller) =>
        poller
          .stop()
          .catch((error) =>
            console.error('[SCHEDULER] Error stopping poller:', error)
          )
    );

    await Promise.all(stopPromises);

    // Clear all pollers
    this.pollers.clear();
    this.isRunning = false;
    this.isPaused = false;

    this.emit('scheduler-stopped');
    console.log('[SCHEDULER] Polling scheduler stopped');
  }

  /**
   * Pauses all active pollers without destroying them
   */
  public async pause(): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    console.log('[SCHEDULER] Pausing all pollers...');
    this.isPaused = true;

    const pausePromises = Array.from(this.pollers.entries()).map(
      async ([id, poller]) => {
        if (poller.isRunning()) {
          try {
            await poller.stop();
            console.log(`[SCHEDULER] Paused poller for AP: ${id}`);
          } catch (error) {
            console.error(
              `[SCHEDULER] Error pausing poller ${id}:`,
              error
            );
          }
        }
      }
    );

    await Promise.all(pausePromises);
    this.emit('scheduler-paused');
    console.log('[SCHEDULER] All pollers paused');
  }

  /**
   * Resumes all paused pollers
   */
  public async resume(): Promise<void> {
    if (!this.isRunning || !this.isPaused) {
      return;
    }

    console.log('[SCHEDULER] Resuming all pollers...');
    this.isPaused = false;

    await this.startEnabledPollers();
    this.emit('scheduler-resumed');
    console.log('[SCHEDULER] All pollers resumed');
  }

  /**
   * Pauses polling for a specific access point
   */
  public async pauseAccessPoint(apId: string): Promise<void> {
    const poller = this.pollers.get(apId);
    if (!poller) {
      throw new Error(`Access point ${apId} not found`);
    }

    if (poller.isRunning()) {
      await poller.stop();
      this.emit('ap-paused', apId);
      console.log(`[SCHEDULER] Paused polling for AP: ${apId}`);
    }
  }

  /**
   * Resumes polling for a specific access point
   */
  public async resumeAccessPoint(apId: string): Promise<void> {
    const poller = this.pollers.get(apId);
    if (!poller) {
      throw new Error(`Access point ${apId} not found`);
    }

    const apConfig = this.getAccessPointConfig(apId);
    if (!apConfig || apConfig.enabled === false) {
      throw new Error(`Access point ${apId} is disabled`);
    }

    if (!this.isPaused && !poller.isRunning()) {
      poller.start();
      this.emit('ap-resumed', apId);
      console.log(`[SCHEDULER] Resumed polling for AP: ${apId}`);
    }
  }

  /**
   * Adds a new access point to the scheduler
   */
  public async addAccessPoint(
    config: AccessPointConfig
  ): Promise<void> {
    if (this.pollers.has(config.id)) {
      throw new Error(`Access point ${config.id} already exists`);
    }

    console.log(`[SCHEDULER] Adding new access point: ${config.id}`);

    // Update settings to include the new AP
    if (this.currentSettings) {
      const updatedSettings: DatabaseData = {
        ...this.currentSettings,
        accessPoints: [...this.currentSettings.accessPoints, config]
      };
      this.settingsManager.updateDatabaseData(updatedSettings);
    }

    // Create and start the poller if scheduler is running
    if (this.isRunning) {
      await this.createPoller(config);

      if (!this.isPaused && config.enabled !== false) {
        const poller = this.pollers.get(config.id);
        if (poller) {
          poller.start();
        }
      }
    }

    this.emit('ap-added', config.id);
  }

  /**
   * Removes an access point from the scheduler
   */
  public async removeAccessPoint(apId: string): Promise<void> {
    const poller = this.pollers.get(apId);
    if (!poller) {
      throw new Error(`Access point ${apId} not found`);
    }

    console.log(`[SCHEDULER] Removing access point: ${apId}`);

    // Stop the poller
    if (poller.isRunning()) {
      await poller.stop();
    }

    // Remove from our tracking
    this.pollers.delete(apId);

    // Update settings to remove the AP
    if (this.currentSettings) {
      const updatedSettings: DatabaseData = {
        ...this.currentSettings,
        accessPoints: this.currentSettings.accessPoints.filter(
          (ap) => ap.id !== apId
        )
      };
      this.settingsManager.updateDatabaseData(updatedSettings);
    }

    this.emit('ap-removed', apId);
  }

  /**
   * Gets comprehensive statistics for all managed access points
   */
  public getSchedulerStats(): SchedulerStats {
    const accessPointStats: AccessPointStats[] = [];
    let activePollers = 0;
    let pausedPollers = 0;
    let disabledAPs = 0;

    if (this.currentSettings) {
      for (const apConfig of this.currentSettings.accessPoints) {
        const poller = this.pollers.get(apConfig.id);
        const isRunning = poller ? poller.isRunning() : false;
        const isEnabled = apConfig.enabled !== false;

        if (isRunning) activePollers++;
        else if (poller && isEnabled) pausedPollers++;
        if (!isEnabled) disabledAPs++;

        accessPointStats.push({
          id: apConfig.id,
          name: apConfig.name,
          ipAddress: apConfig.ipAddress,
          isRunning,
          isEnabled,
          lastResult: poller?.getLastResult(),
          stats: poller?.getStats() || null
        });
      }
    }

    return {
      totalAccessPoints: this.pollers.size,
      activePollers,
      pausedPollers,
      disabledAPs,
      accessPointStats
    };
  }

  /**
   * Gets statistics for a specific access point
   */
  public getAccessPointStats(
    apId: string
  ): AccessPointStats | undefined {
    const config = this.getAccessPointConfig(apId);
    const poller = this.pollers.get(apId);

    if (!config) return undefined;

    return {
      id: apId,
      name: config.name,
      ipAddress: config.ipAddress,
      isRunning: poller ? poller.isRunning() : false,
      isEnabled: config.enabled !== false,
      lastResult: poller?.getLastResult(),
      stats: poller?.getStats() || null
    };
  }

  /**
   * Gets the current scheduler status
   */
  public getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    totalAPs: number;
    activePollers: number;
  } {
    const stats = this.getSchedulerStats();
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      totalAPs: stats.totalAccessPoints,
      activePollers: stats.activePollers
    };
  }

  /**
   * Handles settings changes from the settings manager
   */
  private async handleSettingsUpdate(
    newSettings: DatabaseData
  ): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('[SCHEDULER] Settings changed, updating pollers...');

    const oldSettings = this.currentSettings;
    this.currentSettings = newSettings;

    try {
      // Handle global pause state change
      if (oldSettings?.globalPause !== newSettings.globalPause) {
        if (newSettings.globalPause) {
          await this.pause();
        } else if (this.isPaused) {
          await this.resume();
        }
      }

      // Update existing pollers and create new ones
      await this.updatePollers(oldSettings, newSettings);

      this.emit('settings-updated', newSettings);
    } catch (error) {
      console.error('[SCHEDULER] Error updating settings:', error);
      this.emit('scheduler-error', error);
    }
  }

  /**
   * Updates pollers based on settings changes
   */
  private async updatePollers(
    oldSettings: DatabaseData | undefined,
    newSettings: DatabaseData
  ): Promise<void> {
    const oldAPMap = new Map(
      oldSettings?.accessPoints.map((ap) => [ap.id, ap]) || []
    );
    const newAPMap = new Map(
      newSettings.accessPoints.map((ap) => [ap.id, ap])
    );

    // Remove pollers for APs that no longer exist
    for (const [apId] of oldAPMap) {
      if (!newAPMap.has(apId)) {
        await this.removePollerInternal(apId);
      }
    }

    // Add or update pollers
    for (const [apId, apConfig] of newAPMap) {
      const oldConfig = oldAPMap.get(apId);
      const existingPoller = this.pollers.get(apId);

      if (!existingPoller) {
        // New AP - create poller
        await this.createPoller(apConfig);
        if (!this.isPaused && apConfig.enabled !== false) {
          this.pollers.get(apId)?.start();
        }
      } else {
        // Existing AP - check if configuration changed
        await this.updateExistingPoller(
          apId,
          oldConfig,
          apConfig,
          newSettings
        );
      }
    }
  }

  /**
   * Updates an existing poller if its configuration changed
   */
  private async updateExistingPoller(
    apId: string,
    oldConfig: AccessPointConfig | undefined,
    newConfig: AccessPointConfig,
    globalSettings: DatabaseData
  ): Promise<void> {
    const poller = this.pollers.get(apId);
    if (!poller) return;

    const wasRunning = poller.isRunning();

    // Check if any significant config changed
    const configChanged = this.hasConfigurationChanged(
      oldConfig,
      newConfig,
      globalSettings
    );

    if (configChanged) {
      console.log(
        `[SCHEDULER] Configuration changed for AP ${apId}, recreating poller`
      );

      // Stop the old poller
      if (wasRunning) {
        await poller.stop();
      }

      // Remove and recreate
      this.pollers.delete(apId);
      await this.createPoller(newConfig);

      // Start if it was running and should be running
      if (
        wasRunning &&
        !this.isPaused &&
        newConfig.enabled !== false
      ) {
        this.pollers.get(apId)?.start();
      }
    } else if (oldConfig?.enabled !== newConfig.enabled) {
      // Only enabled state changed
      if (newConfig.enabled === false && wasRunning) {
        await poller.stop();
        this.emit('ap-disabled', apId);
      } else if (
        newConfig.enabled !== false &&
        !wasRunning &&
        !this.isPaused
      ) {
        poller.start();
        this.emit('ap-enabled', apId);
      }
    }
  }

  /**
   * Checks if AP configuration has changed in a way that requires poller recreation
   */
  private hasConfigurationChanged(
    oldConfig: AccessPointConfig | undefined,
    newConfig: AccessPointConfig,
    globalSettings: DatabaseData
  ): boolean {
    if (!oldConfig) return true;

    const getEffectiveConfig = (config: AccessPointConfig) => ({
      ipAddress: config.ipAddress,
      frequency: config.frequency ?? globalSettings.defaultFrequency,
      timeout:
        config.timeout ?? globalSettings.defaultTimeout ?? 5000,
      maxRetries:
        config.maxRetries ?? globalSettings.defaultMaxRetries ?? 3,
      batchSize:
        config.batchSize ?? globalSettings.defaultBatchSize ?? 5
    });

    const oldEffective = getEffectiveConfig(oldConfig);
    const newEffective = getEffectiveConfig(newConfig);

    return (
      JSON.stringify(oldEffective) !== JSON.stringify(newEffective)
    );
  }

  /**
   * Initializes all pollers based on current settings
   */
  private async initializePollers(): Promise<void> {
    if (!this.currentSettings) return;

    console.log(
      `[SCHEDULER] Initializing ${this.currentSettings.accessPoints.length} access point pollers...`
    );

    const createPromises = this.currentSettings.accessPoints.map(
      (apConfig) => this.createPoller(apConfig)
    );

    await Promise.all(createPromises);
  }

  /**
   * Creates a new poller instance for an access point
   */
  private async createPoller(
    apConfig: AccessPointConfig
  ): Promise<void> {
    if (!this.currentSettings) return;

    const pollerOptions: PollerOptions = {
      ipAddress: apConfig.ipAddress,
      frequency:
        apConfig.frequency ?? this.currentSettings.defaultFrequency,
      timeout:
        apConfig.timeout ??
        this.currentSettings.defaultTimeout ??
        5000,
      maxRetries:
        apConfig.maxRetries ??
        this.currentSettings.defaultMaxRetries ??
        3,
      batchSize:
        apConfig.batchSize ??
        this.currentSettings.defaultBatchSize ??
        5,
      autoStart: false // We'll start manually
    };

    console.log(
      `[SCHEDULER] Creating poller for AP ${apConfig.id} (${apConfig.ipAddress})`
    );

    const poller = new AccessPointPoller(pollerOptions);

    // Set up event forwarding
    this.setupPollerEvents(poller, apConfig.id);

    this.pollers.set(apConfig.id, poller);
    this.emit('ap-poller-created', apConfig.id);
  }

  /**
   * Sets up event forwarding for a poller instance
   */
  private setupPollerEvents(
    poller: AccessPointPoller,
    apId: string
  ): void {
    poller.on('poll-result', (result: PollResult) => {
      this.emit('ap-poll-result', apId, result);
    });

    poller.on('poll-error', (error: Error) => {
      this.emit('ap-poll-error', apId, error);
    });

    poller.on('ping-success', (result: PollResult) => {
      this.emit('ap-ping-success', apId, result);
    });

    poller.on('ping-failure', (result: PollResult) => {
      this.emit('ap-ping-failure', apId, result);
    });

    poller.on('started', () => {
      this.emit('ap-started', apId);
    });

    poller.on('stopped', () => {
      this.emit('ap-stopped', apId);
    });
  }

  /**
   * Starts all enabled pollers
   */
  private async startAllPollers(): Promise<void> {
    await this.startEnabledPollers();
  }

  /**
   * Starts pollers for enabled access points
   */
  private async startEnabledPollers(): Promise<void> {
    if (!this.currentSettings) return;

    const startPromises = this.currentSettings.accessPoints
      .filter((ap) => ap.enabled !== false)
      .map(async (apConfig) => {
        const poller = this.pollers.get(apConfig.id);
        if (poller && !poller.isRunning()) {
          try {
            poller.start();
            console.log(
              `[SCHEDULER] Started poller for AP: ${apConfig.id}`
            );
          } catch (error) {
            console.error(
              `[SCHEDULER] Error starting poller ${apConfig.id}:`,
              error
            );
            this.emit('ap-start-error', apConfig.id, error);
          }
        }
      });

    await Promise.all(startPromises);
  }

  /**
   * Removes a poller internally (used during settings updates)
   */
  private async removePollerInternal(apId: string): Promise<void> {
    const poller = this.pollers.get(apId);
    if (!poller) return;

    console.log(`[SCHEDULER] Removing poller for AP: ${apId}`);

    if (poller.isRunning()) {
      await poller.stop();
    }

    this.pollers.delete(apId);
    this.emit('ap-poller-removed', apId);
  }

  /**
   * Gets access point configuration by ID
   */
  private getAccessPointConfig(
    apId: string
  ): AccessPointConfig | undefined {
    return this.currentSettings?.accessPoints.find(
      (ap) => ap.id === apId
    );
  }
}
