export interface GlobalSettings {
  defaultTimeout: number;
  defaultFrequency: number;
  maxRetries: number;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  alertThreshold: number; // in milliseconds
  batchSize: number;
}
