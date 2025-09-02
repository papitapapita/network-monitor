import {
  SettingsUpdatedData,
  AccessPointConfig,
  DatabaseData,
  GlobalSettings,
  AccessPointStats
} from '../types';

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
