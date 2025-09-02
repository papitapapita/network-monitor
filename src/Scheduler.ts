import { EventEmitter } from 'events';
import { AccessPointPoller } from './Poller';
import { SettingsManager } from './services/settings.service';
import {
  AccessPointConfig,
  PollResult,
  GlobalSettings
} from './types/';

/**
 * Manages multiple AccessPointPoller instances based on settings from SettingsManager.
 * Handles scheduling, rescheduling, and lifecycle management of individual pollers.
 *
 * Events:
 * - 'scheduler-started': Emitted when scheduler starts
 * - 'scheduler-stopped': Emitted when scheduler stops
 * - 'scheduler-paused': Emitted when scheduler is paused
 * - 'scheduler-resumed': Emitted when scheduler is resumed
 * - 'poller-added': Emitted when a new poller is added
 * - 'poller-removed': Emitted when a poller is removed
 * - 'poller-updated': Emitted when a poller's configuration is updated
 * - 'poll-result': Forwarded from individual pollers
 * - 'poll-error': Forwarded from individual pollers
 * - 'settings-sync-error': Emitted when settings synchronization fails
 */
export class APPollingScheduler extends EventEmitter {
  private settingsManager: SettingsManager;
  private pollers: Map<string, AccessPointPoller> = new Map();
  private globalSettings: GlobalSettings;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private syncInterval?: NodeJS.Timeout;
  private syncFrequency: number = 30000; // Check for settings changes every 30 seconds

  constructor(
    settingsManager: SettingsManager,
    syncFrequency?: number
  ) {
    super();
    this.settingsManager = settingsManager;
    if (syncFrequency) this.syncFrequency = syncFrequency;
    this.globalSettings = this.settingsManager.getSettings();

    this.setupSettingsListeners();
  }

  /**
   * Sets up event listeners for the settings manager to handle real-time updates
   */
  private setupSettingsListeners(): void {
    // Handle individual AP settings updates
    this.settingsManager.onSettingsUpdated(async (data) => {
      if (this.isRunning && !this.isPaused) {
        try {
          await this.handleSettingsUpdate(data);
        } catch (error) {
          this.emit('settings-sync-error', error);
        }
      }
    });

    // Handle new APs being added
    this.settingsManager.onAPAdded(async (ap) => {
      if (this.isRunning && !this.isPaused && ap.enabled !== false) {
        try {
          await this.addPoller(ap);
        } catch (error) {
          this.emit('settings-sync-error', error);
        }
      }
    });

    // Handle APs being removed
    this.settingsManager.onAPRemoved(async (ipAddress) => {
      if (this.isRunning) {
        try {
          await this.removePoller(ipAddress);
        } catch (error) {
          this.emit('settings-sync-error', error);
        }
      }
    });

    // Handle complete data reloads
    this.settingsManager.onDataLoaded(async (data) => {
      if (this.isRunning) {
        try {
          this.globalSettings = data.globalSettings;
          await this.syncAllPollers();
        } catch (error) {
          this.emit('settings-sync-error', error);
        }
      }
    });
  }

  /**
   * Handles settings updates by determining the type of update and taking appropriate action
   */
  private async handleSettingsUpdate(data: any): Promise<void> {
    switch (data.type) {
      case 'global':
        this.globalSettings = data.changes.new;
        await this.updateAllPollersWithGlobalSettings();
        break;

      case 'individual':
        await this.updateIndividualPoller(data.changes);
        break;

      case 'batch':
        await this.updateBatchPollers(data.changes);
        break;
    }
  }

  /**
   * Updates all pollers when global settings change
   */
  private async updateAllPollersWithGlobalSettings(): Promise<void> {
    const apList = this.settingsManager.getAPList();

    for (const ap of apList) {
      if (this.pollers.has(ap.IPaddress)) {
        await this.updatePoller(ap);
      }
    }
  }

  /**
   * Updates a single poller when its individual settings change
   */
  private async updateIndividualPoller(changes: any): Promise<void> {
    const ipAddress = changes.IPaddress || changes.new?.IPaddress;
    if (!ipAddress) return;

    const newConfig = changes.new;

    if (newConfig.enabled === false) {
      // Remove poller if AP is disabled
      await this.removePoller(ipAddress);
    } else if (this.pollers.has(ipAddress)) {
      // Update existing poller
      await this.updatePoller(newConfig);
    } else {
      // Add new poller if AP was re-enabled
      await this.addPoller(newConfig);
    }
  }

  /**
   * Updates multiple pollers when batch settings change
   */
  private async updateBatchPollers(changes: any): Promise<void> {
    for (const [ipAddress, change] of Object.entries(changes)) {
      await this.updateIndividualPoller({
        IPaddress: ipAddress,
        new: (change as any).new
      });
    }
  }

  /**
   * Starts the scheduler and initializes all pollers from current settings
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Scheduler is already running');
    }

    try {
      // Ensure settings are loaded
      if (
        !this.settingsManager.getAPList().length &&
        !this.globalSettings
      ) {
        await this.settingsManager.initialize();
        this.globalSettings = this.settingsManager.getSettings();
      }

      this.isRunning = true;
      this.isPaused = false;

      // Initialize all enabled pollers
      await this.syncAllPollers();

      // Start periodic settings sync
      this.syncInterval = setInterval(async () => {
        if (this.isRunning && !this.isPaused) {
          try {
            await this.syncAllPollers();
          } catch (error) {
            this.emit('settings-sync-error', error);
          }
        }
      }, this.syncFrequency);

      this.emit('scheduler-started');
    } catch (error) {
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stops the scheduler and all running pollers
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    this.isPaused = false;

    // Clear sync interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    // Stop and remove all pollers
    const stopPromises = Array.from(this.pollers.values()).map(
      (poller) => poller.stop()
    );
    await Promise.all(stopPromises);
    this.pollers.clear();

    this.emit('scheduler-stopped');
  }

  /**
   * Pauses all running pollers without stopping the scheduler
   */
  public async pause(): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      return;
    }

    this.isPaused = true;

    // Stop all pollers but keep them in the map
    const pausePromises = Array.from(this.pollers.values()).map(
      (poller) => poller.stop()
    );
    await Promise.all(pausePromises);

    this.emit('scheduler-paused');
  }

  /**
   * Resumes all paused pollers
   */
  public async resume(): Promise<void> {
    if (!this.isRunning || !this.isPaused) {
      return;
    }

    this.isPaused = false;

    // Restart all pollers
    const resumePromises = Array.from(this.pollers.values()).map(
      (poller) => {
        if (!poller.isRunning()) {
          poller.start();
        }
        return Promise.resolve();
      }
    );
    await Promise.all(resumePromises);

    this.emit('scheduler-resumed');
  }

  /**
   * Synchronizes all pollers with current settings
   */
  private async syncAllPollers(): Promise<void> {
    const currentAPs = this.settingsManager.getEnabledAPs();
    const currentIPAddresses = new Set(
      currentAPs.map((ap) => ap.IPaddress)
    );
    const existingIPAddresses = new Set(this.pollers.keys());

    // Remove pollers for APs that are no longer enabled or don't exist
    for (const ipAddress of existingIPAddresses) {
      if (!currentIPAddresses.has(ipAddress)) {
        await this.removePoller(ipAddress);
      }
    }

    // Add or update pollers for current APs
    for (const ap of currentAPs) {
      if (existingIPAddresses.has(ap.IPaddress)) {
        await this.updatePoller(ap);
      } else {
        await this.addPoller(ap);
      }
    }
  }

  /**
   * Adds a new poller for the given AP configuration
   */
  private async addPoller(
    apConfig: AccessPointConfig
  ): Promise<void> {
    if (this.pollers.has(apConfig.IPaddress)) {
      return; // Already exists
    }

    const pollerOptions = {
      ipAddress: apConfig.IPaddress,
      frequency: apConfig.frequencyToPoll,
      timeout: apConfig.timeout || this.globalSettings.defaultTimeout,
      maxRetries: this.globalSettings.maxRetries,
      batchSize: this.globalSettings.batchSize,
      autoStart: !this.isPaused
    };

    const poller = new AccessPointPoller(pollerOptions);

    // Forward events from individual pollers
    poller.on('poll-result', (result: PollResult) => {
      this.emit('poll-result', {
        ipAddress: apConfig.IPaddress,
        name: apConfig.name,
        result
      });
    });

    poller.on('poll-error', (error: Error) => {
      this.emit('poll-error', {
        ipAddress: apConfig.IPaddress,
        name: apConfig.name,
        error
      });
    });

    poller.on('ping-success', (result: PollResult) => {
      this.emit('ping-success', {
        ipAddress: apConfig.IPaddress,
        name: apConfig.name,
        result
      });
    });

    poller.on('ping-failure', (result: PollResult) => {
      this.emit('ping-failure', {
        ipAddress: apConfig.IPaddress,
        name: apConfig.name,
        result
      });
    });

    this.pollers.set(apConfig.IPaddress, poller);
    this.emit('poller-added', {
      ipAddress: apConfig.IPaddress,
      config: apConfig
    });
  }

  /**
   * Removes and stops a poller for the given IP address
   */
  private async removePoller(ipAddress: string): Promise<void> {
    const poller = this.pollers.get(ipAddress);
    if (!poller) {
      return; // Doesn't exist
    }

    await poller.stop();
    this.pollers.delete(ipAddress);
    this.emit('poller-removed', { ipAddress });
  }

  /**
   * Updates an existing poller with new configuration
   */
  private async updatePoller(
    apConfig: AccessPointConfig
  ): Promise<void> {
    const poller = this.pollers.get(apConfig.IPaddress);
    if (!poller) {
      return; // Doesn't exist
    }

    const currentConfig = poller.getConfiguration();
    const newConfig = {
      ipAddress: apConfig.IPaddress,
      frequency: apConfig.frequencyToPoll,
      timeout: apConfig.timeout || this.globalSettings.defaultTimeout,
      maxRetries: this.globalSettings.maxRetries
    };

    // Check if configuration actually changed
    const configChanged =
      currentConfig.frequency !== newConfig.frequency ||
      currentConfig.timeout !== newConfig.timeout ||
      currentConfig.maxRetries !== newConfig.maxRetries;

    if (configChanged) {
      const wasRunning = poller.isRunning();

      // Stop the poller if it's running
      if (wasRunning) {
        await poller.stop();
      }

      // Update configuration
      poller.setConfiguration(newConfig);

      // Restart if it was running and not paused
      if (wasRunning && !this.isPaused) {
        poller.start();
      }

      this.emit('poller-updated', {
        ipAddress: apConfig.IPaddress,
        oldConfig: currentConfig,
        newConfig
      });
    }
  }

  /**
   * Gets the status of all managed pollers
   */
  public getPollerStatuses(): Array<{
    ipAddress: string;
    name?: string;
    isRunning: boolean;
    lastResult?: any;
    stats?: any;
  }> {
    const apList = this.settingsManager.getAPList();
    const apMap = new Map(apList.map((ap) => [ap.IPaddress, ap]));

    return Array.from(this.pollers.entries()).map(
      ([ipAddress, poller]) => {
        const apConfig = apMap.get(ipAddress);
        return {
          ipAddress,
          name: apConfig?.name,
          isRunning: poller.isRunning(),
          lastResult: poller.getLastResult(),
          stats: poller.getStats()
        };
      }
    );
  }

  /**
   * Gets a specific poller by IP address
   */
  public getPoller(ipAddress: string): AccessPointPoller | undefined {
    return this.pollers.get(ipAddress);
  }

  /**
   * Gets all managed pollers
   */
  public getAllPollers(): Map<string, AccessPointPoller> {
    return new Map(this.pollers);
  }

  /**
   * Gets scheduler status information
   */
  public getStatus(): {
    isRunning: boolean;
    isPaused: boolean;
    totalPollers: number;
    runningPollers: number;
    lastSyncTime?: Date;
  } {
    const runningPollers = Array.from(this.pollers.values()).filter(
      (p) => p.isRunning()
    ).length;

    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      totalPollers: this.pollers.size,
      runningPollers,
      lastSyncTime: new Date() // You might want to track this more precisely
    };
  }

  /**
   * Forces a manual sync of all pollers with current settings
   */
  public async forceSyncAll(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Scheduler is not running');
    }

    await this.settingsManager.loadData();
    this.globalSettings = this.settingsManager.getSettings();
    await this.syncAllPollers();
  }

  /**
   * Clears results for all pollers
   */
  public clearAllResults(): void {
    for (const poller of this.pollers.values()) {
      poller.clearResults();
    }
  }

  /**
   * Gets aggregated statistics from all pollers
   */
  public getAggregatedStats(): {
    totalPollers: number;
    runningPollers: number;
    totalPingBatches: number;
    successfulPings: number;
    failedPings: number;
    averagePacketLoss: number;
    averageResponseTime?: number;
  } {
    const pollers = Array.from(this.pollers.values());
    const runningPollers = pollers.filter((p) =>
      p.isRunning()
    ).length;

    let totalPingBatches = 0;
    let successfulPings = 0;
    let failedPings = 0;
    let totalPacketLoss = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const poller of pollers) {
      const stats = poller.getStats();
      if (stats) {
        totalPingBatches += stats.totalPingsBatches;
        successfulPings += stats.successfulPings;
        failedPings += stats.failedPings;
        totalPacketLoss += stats.avgPacketLoss;

        if (stats.averageResponseTime !== undefined) {
          totalResponseTime += stats.averageResponseTime;
          responseTimeCount++;
        }
      }
    }

    return {
      totalPollers: this.pollers.size,
      runningPollers,
      totalPingBatches,
      successfulPings,
      failedPings,
      averagePacketLoss:
        this.pollers.size > 0
          ? totalPacketLoss / this.pollers.size
          : 0,
      averageResponseTime:
        responseTimeCount > 0
          ? totalResponseTime / responseTimeCount
          : undefined
    };
  }
}
