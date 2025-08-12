export interface SettingsUpdateOptions {
  IPaddress?: string; // If not provided, applies globally
  frequencyToPoll?: number;
  timeout?: number;
  enabled?: boolean;
  name?: string;
  description?: string;
}