import { GlobalSettings } from './';

export interface SettingsUpdatedData {
  type: 'global' | 'individual' | 'batch';
  changes: Partial<GlobalSettings>;
}
