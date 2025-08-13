export interface PollerOptions {
  ipAddress: string;
  frequency: number; // polling interval in milliseconds
  timeout?: number; // ping timeout in milliseconds (default: 5000)
  maxRetries?: number; // max retry attempts on failure (default: 3)
  autoStart?: boolean; // whether to start polling immediately (default: false)
  batchSize?: number; // number of pings to send in each batch (default: 5)
}
