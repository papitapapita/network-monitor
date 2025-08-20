/**
 * Options for configuring a network poller.
 *
 * @property ipAddress - The IP address to poll.
 * @property frequency - Polling frequency in milliseconds.
 * @property timeout - Optional timeout for each poll in milliseconds.
 * @property maxRetries - Optional maximum number of retry attempts on failure.
 * @property autoStart - Optional flag to automatically start polling on initialization.
 * @property batchSize - Optional number of IP addresses to poll in a single batch.
 */
export interface PollerOptions {
  ipAddress: string;
  frequency: number;
  timeout?: number;
  maxRetries?: number;
  autoStart?: boolean;
  batchSize?: number;
}
