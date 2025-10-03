import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  GlobalSettings,
  SettingsUpdatedData,
  DatabaseData,
  AccessPointConfig,
  AccessPointStats
} from '../data/types';
import { SettingsService } from '../data/interfaces';

/**
 * Manages global and per-access-point settings for the ping monitoring system,
 * providing persistence, event-driven updates, and type-safe APIs for configuration.
 *
 * The `SettingsManager` class handles loading, saving, and updating settings for
 * access points (APs) and global system parameters. It emits events for changes,
 * errors, and data loading, allowing consumers to react to configuration updates.
 *
 * Features:
 * - Load and save settings to a persistent file (TypeScript module).
 * - Add, remove, and update individual or batch AP configurations.
 * - Update global settings and propagate changes to APs.
 * - Reset all settings to defaults.
 * - Query enabled APs, statistics, and current configuration.
 * - Emits events for settings updates, AP additions/removals, data loading, and errors.
 *
 * Usage:
 * - Instantiate with a file path and auto-save option.
 * - Call `initialize()` to load data before use.
 * - Register event listeners for reactive updates.
 * - Use provided methods to manage APs and settings.
 *
 * Events:
 * - `settings-updated`: Fired when settings are changed (global, batch, or individual).
 * - `ap-added`: Fired when a new AP is added.
 * - `ap-removed`: Fired when an AP is removed.
 * - `data-loaded`: Fired when data is loaded or reset.
 * - `error`: Fired on any error during operations.
 *
 * @example
 * const manager = new SettingsManager('./data.ts');
 * await manager.initialize();
 * manager.onSettingsUpdated((data) => { ... });
 * await manager.addAP({ IPaddress: '1.2.3.4', ... });
 */
export class SettingsManager
  extends EventEmitter
  implements SettingsService
{
  private dataFilePath: string;
  private data: DatabaseData;
  private autoSave: boolean;

  /**
   * Creates a new SettingsManager instance.
   *
   * @param dataFilePath - Path to the data file for persistence.
   * @param autoSave - Whether to automatically save after changes.
   */
  constructor(
    dataFilePath: string = './src/data/data.ts',
    autoSave: boolean = true
  ) {
    super();
    this.dataFilePath = path.resolve(dataFilePath);
    this.autoSave = autoSave;
    this.data = this.getDefaultData();
  }

  /**
   * Initializes the settings service by loading the necessary data.
   * Emits a 'data-loaded' event with the loaded data upon successful completion.
   * If an error occurs during initialization, emits an 'error' event and rethrows the error.
   *
   * @returns {Promise<void>} A promise that resolves when initialization is complete.
   * @throws Will rethrow any error encountered during data loading.
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadData();
      this.emit('data-loaded', this.data);
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Registers a listener for the `settings-updated` event.
   *
   * @param listener - Callback for settings update events.
   * @returns This instance for chaining.
   */
  public onSettingsUpdated(
    listener: (data: SettingsUpdatedData) => void
  ): this {
    return this.on('settings-updated', listener);
  }

  /**
   * Registers a listener for the `ap-added` event.
   *
   * @param listener - Callback for AP added events.
   * @returns This instance for chaining.
   */
  public onAPAdded(listener: (ap: AccessPointConfig) => void): this {
    return this.on('ap-added', listener);
  }

  /**
   * Registers a listener for the `ap-removed` event.
   *
   * @param listener - Callback for AP removed events.
   * @returns This instance for chaining.
   */
  public onAPRemoved(listener: (IPaddress: string) => void): this {
    return this.on('ap-removed', listener);
  }

  /**
   * Registers a listener for the `data-loaded` event.
   *
   * @param listener - Callback for data loaded events.
   * @returns This instance for chaining.
   */
  public onDataLoaded(listener: (data: DatabaseData) => void): this {
    return this.on('data-loaded', listener);
  }

  /**
   * Registers a listener for the `error` event.
   *
   * @param listener - Callback for error events.
   * @returns This instance for chaining.
   */
  public onError(listener: (error: Error) => void): this {
    return this.on('error', listener);
  }

  /**
   * Gets a copy of the global settings.
   *
   * @returns The global settings object.
   */
  public getSettings(): GlobalSettings {
    return { ...this.data.globalSettings };
  }

  /**
   * Gets a list of all AP entries with their polling settings.
   *
   * @returns Array of AccessPointConfig objects.
   */
  public getAPList(): AccessPointConfig[] {
    return this.data.apList.map((ap) => ({ ...ap }));
  }

  /**
   * Gets a specific AP entry by its IP address.
   *
   * @param IPaddress - The IP address of the AP.
   * @returns The AccessPointConfig object or null if not found.
   */
  public getAP(IPaddress: string): AccessPointConfig | null {
    const ap = this.data.apList.find(
      (entry) => entry.IPaddress === IPaddress
    );
    return ap ? { ...ap } : null;
  }

  /**
   * Updates settings for multiple APs in batch.
   *
   * @param IPaddresses - Array of IP addresses to update.
   * @param options - Settings to apply (excluding IPaddress).
   * @returns Promise that resolves when batch update is complete.
   */
  public async updateBatchSettings(
    IPaddresses: string[],
    options: Omit<AccessPointConfig, 'IPaddress'>
  ): Promise<void> {
    try {
      const changes: {
        [key: string]: {
          old: AccessPointConfig;
          new: AccessPointConfig;
        };
      } = {};

      for (const IPaddress of IPaddresses) {
        const apIndex = this.data.apList.findIndex(
          (ap) => ap.IPaddress === IPaddress
        );
        if (apIndex !== -1) {
          const oldSettings = { ...this.data.apList[apIndex] };

          if (options.frequencyToPoll !== undefined) {
            this.data.apList[apIndex].frequencyToPoll =
              options.frequencyToPoll;
          }
          if (options.timeout !== undefined) {
            this.data.apList[apIndex].timeout = options.timeout;
          }
          if (options.enabled !== undefined) {
            this.data.apList[apIndex].enabled = options.enabled;
          }
          if (options.name !== undefined) {
            this.data.apList[apIndex].name = options.name;
          }

          this.data.apList[apIndex].lastUpdated = new Date();
          changes[IPaddress] = {
            old: oldSettings,
            new: { ...this.data.apList[apIndex] }
          };
        }
      }

      this.data.lastModified = new Date();
      this.emit('settings-updated', { type: 'batch', changes });

      if (this.autoSave) {
        await this.saveData();
      }
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Adds a new AP entry to the system.
   *
   * @param ap - The AccessPointConfig data (without lastUpdated).
   * @returns Promise that resolves when AP is added.
   * @throws Error if the IP address already exists.
   */
  public async addAP(
    ap: Omit<AccessPointConfig, 'lastUpdated'>
  ): Promise<void> {
    try {
      if (
        this.data.apList.some(
          (entry) => entry.IPaddress === ap.IPaddress
        )
      ) {
        throw new Error(`IP address ${ap.IPaddress} already exists`);
      }

      const newAP: AccessPointConfig = {
        ...ap,
        timeout:
          ap.timeout || this.data.globalSettings.defaultTimeout,
        enabled: ap.enabled !== undefined ? ap.enabled : true,
        lastUpdated: new Date()
      };

      this.data.apList.push(newAP);
      this.data.lastModified = new Date();

      this.emit('ap-added', newAP);

      if (this.autoSave) {
        await this.saveData();
      }
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Removes an AP entry by its IP address.
   *
   * @param IPaddress - The IP address to remove.
   * @returns Promise resolving to true if removed, false if not found.
   */
  public async removeAP(IPaddress: string): Promise<boolean> {
    try {
      const index = this.data.apList.findIndex(
        (ap) => ap.IPaddress === IPaddress
      );
      if (index === -1) {
        return false;
      }

      this.data.apList.splice(index, 1);
      this.data.lastModified = new Date();

      this.emit('ap-removed', IPaddress);

      if (this.autoSave) {
        await this.saveData();
      }

      return true;
    } catch (error) {
      this.emit('error', error as Error);
      throw error;
    }
  }

  /**
   * Gets all enabled AP entries.
   *
   * @returns Array of enabled AccessPointConfig objects.
   */
  public getEnabledAPs(): AccessPointConfig[] {
    return this.data.apList
      .filter((ap) => ap.enabled !== false)
      .map((ap) => ({ ...ap }));
  }

  /**
   * Saves the current data to the data file.
   *
   * @returns Promise that resolves when data is saved.
   * @throws Error if saving fails.
   */
  public async saveData(): Promise<void> {
    try {
      this.data.lastModified = new Date();
      const dataContent = this.generateDataFileContent();
      await fs.writeFile(this.dataFilePath, dataContent, 'utf8');
    } catch (error) {
      this.emit('error', error as Error);
      throw new Error(
        `Failed to save data: ${(error as Error).message}`
      );
    }
  }

  /**
   * Loads data from the data file, or creates it if missing.
   *
   * @returns Promise that resolves when data is loaded.
   * @throws Error if loading fails.
   */
  public async loadData(): Promise<void> {
    try {
      const exists = await fs
        .access(this.dataFilePath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        await this.saveData();
        return;
      }

      // For this example, we'll read the TypeScript file and parse it
      // In a real scenario, you might use JSON or connect to a real database
      const content = await fs.readFile(this.dataFilePath, 'utf8');

      // Simple parsing - in production you might want more robust parsing
      if (content.includes('export const databaseData')) {
        // Use dynamic import to load the module (ESM compatible)
        const fileUrl = pathToFileURL(this.dataFilePath).href;
        const module = await import(
          fileUrl + `?update=${Date.now()}`
        ); // cache busting
        if (module.databaseData) {
          this.data = {
            ...module.databaseData,
            lastModified: new Date(module.databaseData.lastModified)
          };
        }
      }
    } catch (error) {
      this.emit('error', error as Error);
      throw new Error(
        `Failed to load data: ${(error as Error).message}`
      );
    }
  }

  /**
   * Resets all settings and APs to default values.
   *
   * @returns Promise that resolves when reset is complete.
   */
  public async resetToDefaults(): Promise<void> {
    this.data = this.getDefaultData();

    if (this.autoSave) {
      await this.saveData();
    }

    this.emit('data-loaded', this.data);
  }

  /**
   * Gets statistics about the current AP configuration.
   *
   * @returns Object with total, enabled, disabled APs, average frequency, and last modified date.
   */
  public getStats(): AccessPointStats {
    const totalAPs = this.data.apList.length;
    const enabledAPs = this.data.apList.filter(
      (ap) => ap.enabled !== false
    ).length;
    const disabledAPs = totalAPs - enabledAPs;

    return {
      total: totalAPs,
      enabled: enabledAPs,
      disabled: disabledAPs,
      lastModified: this.data.lastModified
    };
  }

  /**
   * Update settings for a specific AP
   * @param IPaddress The IP address of the AP
   * @param options The settings to update
   */
  public async updateIndividualAPSettings(
    options: AccessPointConfig
  ): Promise<void> {
    const apIndex = this.data.apList.findIndex(
      (ap) => ap.IPaddress === options.IPaddress
    );

    if (apIndex === -1) {
      throw new Error(`IP address ${options.IPaddress} not found`);
    }

    const oldSettings = { ...this.data.apList[apIndex] };

    if (options.frequencyToPoll !== undefined) {
      this.data.apList[apIndex].frequencyToPoll =
        options.frequencyToPoll;
    }
    if (options.timeout !== undefined) {
      this.data.apList[apIndex].timeout = options.timeout;
    }
    if (options.enabled !== undefined) {
      this.data.apList[apIndex].enabled = options.enabled;
    }
    if (options.name !== undefined) {
      this.data.apList[apIndex].name = options.name;
    }

    this.data.apList[apIndex].lastUpdated = new Date();
    this.data.lastModified = new Date();

    this.emit('settings-updated', {
      type: 'individual',
      changes: {
        IPaddress: options.IPaddress,
        old: oldSettings,
        new: { ...this.data.apList[apIndex] }
      }
    });
  }

  /**
   * Update global settings
   * @param options The settings to update
   */
  public async updateGlobalAPSettings(
    options: Partial<GlobalSettings>
  ): Promise<void> {
    const oldSettings = { ...this.data.globalSettings };

    // Update global defaults
    if (options.defaultFrequency !== undefined) {
      this.data.globalSettings.defaultFrequency =
        options.defaultFrequency;
      // Optionally apply to all APs that don't have individual settings
      this.data.apList.forEach((ap) => {
        ap.frequencyToPoll = options.defaultFrequency!;
        ap.lastUpdated = new Date();
      });
    }

    if (options.defaultTimeout !== undefined) {
      this.data.globalSettings.defaultTimeout =
        options.defaultTimeout;
      // Apply to APs that don't have individual timeout settings
      this.data.apList.forEach((ap) => {
        if (!ap.timeout) {
          ap.timeout = options.defaultTimeout;
          ap.lastUpdated = new Date();
        }
      });
    }

    if (options.maxRetries !== undefined) {
      this.data.globalSettings.maxRetries = options.maxRetries;
    }

    if (options.enableLogging !== undefined) {
      this.data.globalSettings.enableLogging = options.enableLogging;
    }

    if (options.logLevel !== undefined) {
      this.data.globalSettings.logLevel = options.logLevel;
    }

    if (options.alertThreshold !== undefined) {
      this.data.globalSettings.alertThreshold =
        options.alertThreshold;
    }

    if (options.batchSize !== undefined) {
      this.data.globalSettings.batchSize = options.batchSize;
    }

    this.data.lastModified = new Date();

    this.emit('settings-updated', {
      type: 'global',
      changes: {
        old: oldSettings,
        new: { ...this.data.globalSettings }
      }
    });
  }

  /**
   * Get default database data
   * @returns Default database data
   */
  private getDefaultData(): DatabaseData {
    return {
      globalSettings: {
        defaultTimeout: 3000,
        defaultFrequency: 5000,
        maxRetries: 3,
        enableLogging: true,
        logLevel: 'info',
        alertThreshold: 1000,
        batchSize: 10
      },
      apList: [
        {
          IPaddress: '8.8.8.8',
          frequencyToPoll: 5000,
          timeout: 3000,
          enabled: true,
          name: 'Google DNS',
          lastUpdated: new Date()
        },
        {
          IPaddress: '8.8.4.4',
          frequencyToPoll: 5000,
          timeout: 3000,
          enabled: true,
          name: 'Google DNS Secondary',
          lastUpdated: new Date()
        }
      ],
      lastModified: new Date()
    };
  }

  private generateDataFileContent(): string {
    return `// Auto-generated data file - ${new Date().toISOString()}
import { DatabaseData } from '../types/';

export const databaseData: DatabaseData = ${JSON.stringify(this.data, null, 2)};
`;
  }
}
