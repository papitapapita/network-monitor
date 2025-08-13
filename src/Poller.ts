import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { PollResult, PollerOptions } from './types';

const execAsync = promisify(exec);

export class AccessPointPoller extends EventEmitter {
  private ipAddress: string;
  private frequency: number;
  private timeout: number;
  private maxRetries: number;
  private batchSize: number;
  private isPolling: boolean = false;
  private pollInterval?: NodeJS.Timeout;
  private results: PollResult[] = [];

  constructor(options: PollerOptions) {
    super();

    this.ipAddress = options.ipAddress;
    this.frequency = options.frequency;
    this.timeout = options.timeout ?? 5000;
    this.maxRetries = options.maxRetries ?? 3;
    this.batchSize = options.batchSize ?? 5;

    this.validateOptions();

    if (options.autoStart) {
      this.start();
    }
  }

  private validateOptions(): void {
    if (!this.ipAddress) {
      throw new Error('IP address is required');
    }

    if (!this.isValidIP(this.ipAddress)) {
      throw new Error('Invalid IP address format');
    }

    if (this.frequency <= 0) {
      throw new Error('Frequency must be greater than 0');
    }

    if (this.timeout <= 0) {
      throw new Error('Timeout must be greater than 0');
    }

    if (this.maxRetries < 0) {
      throw new Error('Max retries cannot be negative');
    }

    if (this.batchSize <= 0) {
      throw new Error('Batch size must be greater than 0');
    }
  }

  private isValidIP(ip: string): boolean {
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex =
      /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  private async ping(attempts: number = 1): Promise<PollResult> {
    console.log(
      `[DEBUG] Starting ping for ${this.ipAddress} with ${attempts} attempts`
    );
    for (
      let attempt = 1;
      attempt <= Math.max(1, attempts);
      attempt++
    ) {
      console.log(`[DEBUG] Attempt ${attempt} of ${attempts}`);
      try {
        const pingCommand =
          process.platform === 'win32'
            ? `ping -n ${this.batchSize} -w ${this.timeout} ${this.ipAddress}`
            : `ping -c ${this.batchSize} -W ${Math.ceil(this.timeout / 1000)} ${this.ipAddress}`;
        console.log(`[DEBUG] Executing command: ${pingCommand}`);

        const { stdout, stderr } = await execAsync(pingCommand);
        console.log(
          `[DEBUG] Ping output for ${this.ipAddress}:\n${stdout}`
        );
        if (stderr) {
          console.error(
            `[DEBUG] Ping error output for ${this.ipAddress}:\n[STDERR] ${stderr}`
          );
        }

        let pingTimes: number[] = [];
        if (process.platform === 'win32') {
          const matches = [...stdout.matchAll(/time[=<](\d+)ms/gi)];
          pingTimes = matches.map((m) => parseInt(m[1]));
        } else {
          const matches = [
            ...stdout.matchAll(/time=(\d+(?:\.\d+)?) ms/g)
          ];
          pingTimes = matches.map((m) => parseFloat(m[1]));
        }
        console.log(
          `[DEBUG] Extracted ping times: ${JSON.stringify(pingTimes)}`
        );

        const minTime = pingTimes.length
          ? Math.min(...pingTimes)
          : undefined;
        const maxTime = pingTimes.length
          ? Math.max(...pingTimes)
          : undefined;
        const avgTime = pingTimes.length
          ? pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length
          : undefined;
        const packetLoss = pingTimes.length / this.batchSize;

        const result: PollResult = {
          timestamp: new Date(),
          success: true,
          attempts: attempt,
          responseTimes: pingTimes,
          packetLoss,
          minTime,
          maxTime,
          avgTime
        };

        console.log(`[DEBUG] Ping result: ${JSON.stringify(result)}`);
        this.emit('ping-success', result);
        return result;
      } catch (error) {
        console.error(
          `[DEBUG] Ping error for ${this.ipAddress} on attempt ${attempt}:`,
          error
        );
        if (attempt === attempts) {
          const result: PollResult = {
            timestamp: new Date(),
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error',
            attempts: attempt
          };
          console.log(
            `[DEBUG] Final failure result: ${JSON.stringify(result)}`
          );
          this.emit('ping-failure', result);
          return result;
        }
        // Wait a bit before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 1000)
        );
      }
    }
    throw new Error('Unexpected end of ping method');
  }

  private async performPoll(): Promise<void> {
    try {
      const result = await this.ping(this.maxRetries + 1);
      this.results.push(result);
      this.emit('poll-result', result);

      // Keep only last 1000 results to prevent memory issues
      if (this.results.length > 1000) {
        this.results = this.results.slice(-1000);
      }
    } catch (error) {
      this.emit('poll-error', error);
    }
  }

  public start(): void {
    if (this.isPolling) {
      throw new Error('Poller is already running');
    }

    this.isPolling = true;
    this.emit('started');

    // Perform initial poll immediately
    this.performPoll();

    // Set up recurring polls
    this.pollInterval = setInterval(() => {
      this.performPoll();
    }, this.frequency);
  }

  public stop(): void {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
    }

    this.emit('stopped');
  }

  public getResults(): PollResult[] {
    return [...this.results]; // Return a copy to prevent external modification
  }

  public getLastResult(): PollResult | undefined {
    return this.results[this.results.length - 1];
  }

  public getStats() {
    if (this.results.length === 0) {
      return null;
    }

    const successfulPings = this.results.filter((r) => r.success);
    const failedPings = this.results.filter((r) => !r.success);

    const responseTimes = successfulPings
      .map((r) => r.avgTime)
      .filter((time): time is number => time !== undefined);

    return {
      totalPingsBatches: this.results.length,
      successfulPings: successfulPings.length,
      failedPings: failedPings.length,
      successRate:
        (successfulPings.length / this.results.length) * 100,
      averageResponseTime:
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) /
            responseTimes.length
          : undefined,
      minResponseTime:
        responseTimes.length > 0
          ? Math.min(...responseTimes)
          : undefined,
      maxResponseTime:
        responseTimes.length > 0
          ? Math.max(...responseTimes)
          : undefined
    };
  }

  public clearResults(): void {
    this.results = [];
    this.emit('results-cleared');
  }

  public isRunning(): boolean {
    return this.isPolling;
  }

  public getConfiguration() {
    return {
      ipAddress: this.ipAddress,
      frequency: this.frequency,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    };
  }
}

// Usage example:

const poller = new AccessPointPoller({
  ipAddress: '192.168.1.1',
  frequency: 5000, // Poll every 5 seconds
  timeout: 3000, // 3 second timeout
  maxRetries: 2, // Retry up to 2 times on failure
  autoStart: false,
  batchSize: 5
});

// Event listeners
poller.on('started', () => console.log('Polling started'));
poller.on('stopped', () => console.log('Polling stopped'));
poller.on('ping-success', (result) =>
  console.log('Ping successful:', result)
);
poller.on('ping-failure', (result) =>
  console.log('Ping failed:', result)
);
poller.on('poll-result', (result) =>
  console.log('Poll result:', result)
);

// Start polling
poller.start();

// Get results after some time
setTimeout(() => {
  console.log('Current stats:', poller.getStats());
  console.log('Last 5 results:', poller.getResults().slice(-5));

  // Stop polling
  poller.stop();
}, 30000);
