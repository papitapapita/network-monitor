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

  /**
   * Creates a new instance of the Poller class.
   *
   * @param options - Configuration options for the poller.
   *   - `ipAddress`: The IP address to be monitored.
   *   - `frequency`: The polling frequency in milliseconds.
   *   - `timeout`: Optional. The timeout for each poll in milliseconds. Defaults to 5000.
   *   - `maxRetries`: Optional. The maximum number of retry attempts for failed polls. Defaults to 3.
   *   - `batchSize`: Optional. The number of concurrent polls to run in a batch. Defaults to 5.
   *   - `autoStart`: Optional. If true, polling starts automatically after instantiation.
   *
   * @remarks
   * Validates the provided options and starts polling automatically if `autoStart` is enabled.
   */
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

  /**
   * Validates the configuration options for the poller instance.
   *
   * Throws an error if any of the following conditions are met:
   * - `ipAddress` is missing or not provided.
   * - `ipAddress` does not match a valid IP address format.
   * - `frequency` is less than or equal to 0.
   * - `timeout` is less than or equal to 0.
   * - `maxRetries` is negative.
   * - `batchSize` is less than or equal to 0.
   *
   * @throws {Error} If any validation check fails.
   */
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

  /**
   * Checks whether a given string is a valid IPv4 or IPv6 address.
   *
   * This method uses regular expressions to validate the format of the IP address.
   * It supports standard IPv4 addresses (e.g., "192.168.1.1") and IPv6 addresses
   * (e.g., "2001:0db8:85a3:0000:0000:8a2e:0370:7334", "::1", "::").
   *
   * @param ip - The IP address string to validate.
   * @returns `true` if the input is a valid IPv4 or IPv6 address, otherwise `false`.
   */
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

        let stdout = '';
        let stderr = '';
        let commandError: any = null;

        try {
          const result = await execAsync(pingCommand);
          stdout = result.stdout;
          stderr = result.stderr;
        } catch (execError: any) {
          // Ping command failed, but we might still have useful output
          commandError = execError;
          stdout = execError.stdout || '';
          stderr = execError.stderr || '';
          console.log(
            `[DEBUG] Ping command exited with error, but parsing output: ${execError.message}`
          );
        }

        console.log(
          `[DEBUG] Ping output for ${this.ipAddress}:\n${stdout}`
        );
        if (stderr) {
          console.error(
            `[DEBUG] Ping error output for ${this.ipAddress}:\n[STDERR] ${stderr}`
          );
        }

        // Parse ping results from stdout/stderr even if command failed
        const parseResult = this.parsePingOutput(stdout, stderr);

        // If we have parsing results, use them; otherwise fall back to command error
        const result: PollResult = {
          timestamp: new Date(),
          success: parseResult.success,
          attempts: attempt,
          responseTimes: parseResult.responseTimes || [],
          packetLoss: parseResult.packetLoss,
          minTime: parseResult.minTime,
          maxTime: parseResult.maxTime,
          avgTime: parseResult.avgTime,
          error:
            parseResult.error ||
            (commandError
              ? `Command failed: ${commandError.message}`
              : undefined)
        };

        console.log(`[DEBUG] Ping result: ${JSON.stringify(result)}`);

        // Determine if we should retry based on the result
        if (result.success || parseResult.packetLoss !== undefined) {
          // We got meaningful results (even if all packets failed)
          if (result.success) {
            this.emit('ping-success', result);
          } else {
            this.emit('ping-failure', result);
          }
          return result;
        } else if (attempt === attempts) {
          // No meaningful results and this was the last attempt
          const fallbackResult: PollResult = {
            timestamp: new Date(),
            success: false,
            error: commandError
              ? commandError.message
              : 'Unknown ping error',
            attempts: attempt,
            packetLoss: 100,
            responseTimes: []
          };

          console.log(
            `[DEBUG] Final failure result: ${JSON.stringify(fallbackResult)}`
          );
          this.emit('ping-failure', fallbackResult);
          return fallbackResult;
        }

        // If we reach here, we should retry
        console.log(
          `[DEBUG] No meaningful results on attempt ${attempt}, retrying...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 1000)
        );
      } catch (error) {
        // This should rarely happen now, but keep as fallback
        console.error(
          `[DEBUG] Unexpected error on attempt ${attempt}:`,
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
            attempts: attempt,
            packetLoss: 100,
            responseTimes: []
          };

          console.log(
            `[DEBUG] Final unexpected failure result: ${JSON.stringify(result)}`
          );
          this.emit('ping-failure', result);
          return result;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 1000)
        );
      }
    }

    throw new Error('Unexpected end of ping method');
  }

  private parsePingOutput(
    stdout: string,
    stderr: string
  ): {
    success: boolean;
    responseTimes: number[];
    packetLoss: number;
    minTime?: number;
    maxTime?: number;
    avgTime?: number;
    error?: string;
  } {
    let pingTimes: number[] = [];
    let packetLoss = 100; // Default to 100% loss
    let error: string | undefined;

    try {
      // If we have no output at all, return early
      if (!stdout && !stderr) {
        return {
          success: false,
          responseTimes: [],
          packetLoss: 100,
          error: 'No ping output received'
        };
      }

      if (process.platform === 'win32') {
        // Windows ping parsing
        const timeMatches = [...stdout.matchAll(/time[=<](\d+)ms/gi)];
        pingTimes = timeMatches.map((m) => parseInt(m[1]));

        // Parse packet loss from Windows output
        const lossMatch = stdout.match(/\((\d+)% loss\)/i);
        if (lossMatch) {
          packetLoss = parseInt(lossMatch[1]);
        } else {
          // Calculate based on successful pings vs batch size
          packetLoss = Math.round(
            ((this.batchSize - pingTimes.length) / this.batchSize) *
              100
          );
        }

        // Check for Windows-specific errors
        if (
          stdout.includes('Request timed out') ||
          stdout.includes('Destination host unreachable') ||
          stdout.includes('could not find host')
        ) {
          error = this.extractWindowsError(stdout);
        }
      } else {
        // Unix/Linux/macOS ping parsing
        const timeMatches = [
          ...stdout.matchAll(/time=(\d+(?:\.\d+)?) ms/g)
        ];
        pingTimes = timeMatches.map((m) => parseFloat(m[1]));

        // Parse packet loss from Unix output - look for the standard format
        const lossMatch = stdout.match(
          /(\d+(?:\.\d+)?)% packet loss/
        );
        if (lossMatch) {
          packetLoss = Math.round(parseFloat(lossMatch[1]));
          console.log(
            `[DEBUG] Found packet loss in output: ${packetLoss}%`
          );
        } else {
          // Fallback: calculate based on successful pings vs batch size
          packetLoss = Math.round(
            ((this.batchSize - pingTimes.length) / this.batchSize) *
              100
          );
          console.log(
            `[DEBUG] Calculated packet loss from ping count: ${packetLoss}%`
          );
        }

        // Check for Unix-specific errors in stderr or stdout
        if (
          stderr.includes('Name or service not known') ||
          stderr.includes('No route to host') ||
          stdout.includes('Destination Host Unreachable') ||
          stdout.includes('Network is unreachable')
        ) {
          error = stderr.trim() || this.extractUnixError(stdout);
        }

        // If we found "Destination Host Unreachable" messages, that's still useful info
        if (stdout.includes('Destination Host Unreachable')) {
          error = 'Destination Host Unreachable';
        }
      }

      console.log(
        `[DEBUG] Extracted ping times: ${JSON.stringify(pingTimes)}`
      );
      console.log(`[DEBUG] Calculated packet loss: ${packetLoss}%`);

      const minTime = pingTimes.length
        ? Math.min(...pingTimes)
        : undefined;
      const maxTime = pingTimes.length
        ? Math.max(...pingTimes)
        : undefined;
      const avgTime = pingTimes.length
        ? Math.round(
            (pingTimes.reduce((a, b) => a + b, 0) /
              pingTimes.length) *
              100
          ) / 100
        : undefined;

      // Determine overall success
      // Consider successful if we got at least some responses and packet loss < 100%
      const success = pingTimes.length > 0 && packetLoss < 100;

      return {
        success,
        responseTimes: pingTimes,
        packetLoss,
        minTime,
        maxTime,
        avgTime,
        error
      };
    } catch (parseError) {
      console.error(`[DEBUG] Error parsing ping output:`, parseError);
      return {
        success: false,
        responseTimes: [],
        packetLoss: 100,
        error: `Parse error: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`
      };
    }
  }

  private extractWindowsError(stdout: string): string {
    if (stdout.includes('Request timed out')) {
      return 'Request timed out';
    }
    if (stdout.includes('Destination host unreachable')) {
      return 'Destination host unreachable';
    }
    if (stdout.includes('could not find host')) {
      return 'Could not find host';
    }
    return 'Windows ping failed';
  }

  private extractUnixError(stdout: string): string {
    if (stdout.includes('Destination Host Unreachable')) {
      return 'Destination Host Unreachable';
    }
    if (stdout.includes('Network is unreachable')) {
      return 'Network is unreachable';
    }
    return 'Unix ping failed';
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
    //this.performPoll();

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

    const avgPacketLoss =
      this.results.length > 0
        ? this.results.reduce(
            (sum, r) =>
              sum +
              (typeof r.packetLoss === 'number' ? r.packetLoss : 100),
            0
          ) / this.results.length
        : 100;

    return {
      totalPingsBatches: this.results.length,
      successfulPings: successfulPings.length,
      failedPings: failedPings.length,
      avgPacketLoss,
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
  batchSize: 10
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
