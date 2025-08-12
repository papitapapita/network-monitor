import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
// Interfaces
import {
  GlobalSettings,
  SettingsUpdatedData,
  SettingsUpdateOptions,
  DatabaseData,
  APEntry,
  APStatistics
} from '../types/';

// Events
export class SettingsManager extends EventEmitter {
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

  // Type-safe event methods
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
  public onAPAdded(listener: (ap: APEntry) => void): this {
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
   * @returns Array of APEntry objects.
   */
  public getAPList(): APEntry[] {
    return this.data.apList.map((ap) => ({ ...ap }));
  }

  /**
   * Gets a specific AP entry by its IP address.
   *
   * @param IPaddress - The IP address of the AP.
   * @returns The APEntry object or null if not found.
   */
  public getAP(IPaddress: string): APEntry | null {
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
    options: Omit<SettingsUpdateOptions, 'IPaddress'>
  ): Promise<void> {
    try {
      const changes: {
        [key: string]: { old: APEntry; new: APEntry };
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
          if (options.description !== undefined) {
            this.data.apList[apIndex].description =
              options.description;
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
   * @param ap - The APEntry data (without lastUpdated).
   * @returns Promise that resolves when AP is added.
   * @throws Error if the IP address already exists.
   */
  public async addAP(
    ap: Omit<APEntry, 'lastUpdated'>
  ): Promise<void> {
    try {
      // Check if IP already exists
      if (
        this.data.apList.some(
          (entry) => entry.IPaddress === ap.IPaddress
        )
      ) {
        throw new Error(`IP address ${ap.IPaddress} already exists`);
      }

      const newAP: APEntry = {
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
   * @returns Array of enabled APEntry objects.
   */
  public getEnabledAPs(): APEntry[] {
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
        // Create file with default data
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
        const module = await import(fileUrl + `?update=${Date.now()}`); // cache busting
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
  public getStats(): APStatistics {
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
    options: SettingsUpdateOptions
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
    if (options.description !== undefined) {
      this.data.apList[apIndex].description = options.description;
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
          description: 'Primary Google DNS server',
          lastUpdated: new Date()
        },
        {
          IPaddress: '8.8.4.4',
          frequencyToPoll: 5000,
          timeout: 3000,
          enabled: true,
          name: 'Google DNS Secondary',
          description: 'Secondary Google DNS server',
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

export default SettingsManager;
