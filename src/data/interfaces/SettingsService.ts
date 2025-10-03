import {
  SettingsUpdatedData,
  AccessPointConfig,
  DatabaseData,
  GlobalSettings,
  AccessPointStats
} from '../types';

/**
 * Interface for managing application settings and access point configurations.
 *
 * Provides methods for initializing the service, handling events related to settings and access points,
 * retrieving and updating settings, and persisting data. Supports batch and individual updates to access points,
 * as well as global settings modifications.
 *
 * @remarks
 * Implementations should ensure thread safety and proper error handling for asynchronous operations.
 *
 * @method initialize Initializes the settings service asynchronously.
 * @method onSettingsUpdated Registers a listener for settings update events.
 * @method onAPAdded Registers a listener for access point addition events.
 * @method onAPRemoved Registers a listener for access point removal events.
 * @method onDataLoaded Registers a listener for data load events.
 * @method onError Registers a listener for error events.
 * @method getSettings Retrieves the current global settings.
 * @method getAPList Retrieves the list of all configured access points.
 * @method getAP Retrieves the configuration for a specific access point by IP address.
 * @method updateBatchSettings Updates settings for multiple access points in a batch operation.
 * @method addAP Adds a new access point configuration.
 * @method removeAP Removes an access point by IP address.
 * @method getEnabledAPs Retrieves the list of enabled access points.
 * @method saveData Persists the current settings and access point data.
 * @method loadData Loads settings and access point data from persistent storage.
 * @method resetToDefaults Resets all settings and access point configurations to their default values.
 * @method getStats Retrieves statistics related to access points.
 * @method updateIndividualAPSettings Updates settings for a single access point.
 * @method updateGlobalAPSettings Updates global settings for all access points.
 */
export interface SettingsService {
  initialize(): Promise<void>;
  onSettingsUpdated(
    listener: (data: SettingsUpdatedData) => void
  ): this;
  onAPAdded(listener: (ap: AccessPointConfig) => void): this;
  onAPRemoved(listener: (IPaddress: string) => void): this;
  onDataLoaded(listener: (data: DatabaseData) => void): this;
  onError(listener: (error: Error) => void): this;
  getSettings(): GlobalSettings;
  getAPList(): AccessPointConfig[];
  getAP(IPaddress: string): AccessPointConfig | null;
  updateBatchSettings(
    IPaddresses: string[],
    options: Omit<AccessPointConfig, 'IPaddress'>
  ): Promise<void>;
  addAP(ap: Omit<AccessPointConfig, 'lastUpdated'>): Promise<void>;
  removeAP(IPaddress: string): Promise<boolean>;
  getEnabledAPs(): AccessPointConfig[];
  //getDisabledAPs(): AccessPointConfig[];
  saveData(): Promise<void>;
  loadData(): Promise<void>;
  resetToDefaults(): Promise<void>;
  getStats(): AccessPointStats;
  updateIndividualAPSettings(
    options: AccessPointConfig
  ): Promise<void>;
  updateGlobalAPSettings(
    options: Partial<GlobalSettings>
  ): Promise<void>;
}
