import { GlobalSettings, AccessPointConfig } from './';

export interface DatabaseData {
  globalSettings: GlobalSettings;
  apList: AccessPointConfig[];
  lastModified: Date;
  globalPause?: boolean;
}
