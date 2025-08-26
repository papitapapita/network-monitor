import { exec } from 'child_process';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import { PollResult, PollerOptions } from './types';

const execAsync = promisify(exec);

/**
 * Monitors network connectivity to a specified access point by periodically executing ping operations.
 *
 * The `AccessPointPoller` class emits events for successful and failed ping attempts, supports configurable
 * polling frequency, timeout, batch size, and retry logic. It parses ping command output to extract statistics
 * such as response times and packet loss, and maintains a history of poll results.
 *
 * @remarks
 * - Emits events: `'ping-success'`, `'ping-failure'`, `'poll-result'`, `'poll-error'`, `'started'`, `'stopped'`, `'results-cleared'`.
 * - Supports both IPv4 and IPv6 addresses.
 * - Automatically starts polling if `autoStart` is enabled in the constructor options.
 * - Maintains up to 1000 recent poll results to prevent memory issues.
 *
 * @example
 * ```typescript
 * const poller = new AccessPointPoller({
 *   ipAddress: '192.168.1.1',
 *   frequency: 10000,
 *   timeout: 5000,
 *   maxRetries: 3,
 *   batchSize: 5,
 *   autoStart: true
 * });
 *
 * poller.on('poll-result', (result) => {
 *   console.log('Ping result:', result);
 * });
 * ```
 *
 * @see PollerOptions
 * @see PollResult
 */
export class AccessPointPoller extends EventEmitter {
  private ipAddress: string;
  private frequency: number;
  private timeout: number;
  private maxRetries: number;
  private batchSize: number;
  private isPolling: boolean = false;
  private pollInterval?: NodeJS.Timeout;
  private results: PollResult[] = [];
  private currentPingPromise?: Promise<void>;
  private abortController?: AbortController;

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

  /**
   * Performs a ping operation to the configured IP address, retrying up to the specified number of attempts.
   * Emits 'ping-success' on a successful ping, or 'ping-failure' if all attempts fail.
   * Handles polling state and aborts if polling is stopped.
   *
   * @param attempts - The number of ping attempts to perform (default is 1).
   * @returns A promise that resolves to a {@link PollResult} indicating the outcome of the ping operation.
   * @throws {Error} If the ping operation is aborted due to polling being stopped or an unexpected error occurs.
   */
  private async ping(attempts: number = 1): Promise<PollResult> {
    console.log(
      `[DEBUG] Starting ping for ${this.ipAddress} with ${attempts} attempts`
    );

    for (
      let attempt = 1;
      attempt <= Math.max(1, attempts);
      attempt++
    ) {
      if (!this.isPolling) {
        console.log('[DEBUG] Ping aborted - poller stopped');
        throw new Error('Ping aborted - poller stopped');
      }

      console.log(`[DEBUG] Attempt ${attempt} of ${attempts}`);

      try {
        const { stdout, stderr, commandError } =
          await this.runPingCommand();
        const result = this.buildResult(
          stdout,
          stderr,
          commandError,
          attempt
        );

        console.log(`[DEBUG] Ping result: ${JSON.stringify(result)}`);

        if (result.success) {
          this.emit('ping-success', result);
          return result;
        }

        if (attempt === attempts) {
          const failure = this.buildFailureResult(
            result.error ?? commandError,
            attempt
          );
          console.log(
            `[DEBUG] Final failure result: ${JSON.stringify(failure)}`
          );
          this.emit('ping-failure', failure);
          return failure;
        }

        console.log(
          `[DEBUG] No meaningful results on attempt ${attempt}, retrying...`
        );
        await this.delay(attempt * 1000);
      } catch (error) {
        if (
          !this.isPolling ||
          (error as Error).message.includes('poller stopped')
        ) {
          console.log('[DEBUG] Ping operation aborted');
          throw error;
        }

        console.error(
          `[DEBUG] Unexpected error on attempt ${attempt}:`,
          error
        );

        if (attempt === attempts) {
          const failure: PollResult = {
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
            `[DEBUG] Final unexpected failure result: ${JSON.stringify(failure)}`
          );
          this.emit('ping-failure', failure);
          return failure;
        }

        await this.delay(attempt * 1000);
      }
    }

    throw new Error('Unexpected end of ping method');
  }

  /**
   * Executes a platform-specific ping command asynchronously and returns the output.
   *
   * On Windows, uses the `ping -n` and `-w` flags; on other platforms, uses `ping -c` and `-W`.
   * Handles errors gracefully, returning both stdout and stderr, and optionally an error object.
   * If polling has been stopped (`isPolling` is false), throws an error to abort the operation.
   *
   * @returns A promise that resolves with an object containing `stdout`, `stderr`, and optionally `commandError` if the ping command fails.
   */
  private async runPingCommand(): Promise<{
    stdout: string;
    stderr: string;
    commandError?: Error;
  }> {
    const pingCommand =
      process.platform === 'win32'
        ? `ping -n ${this.batchSize} -w ${this.timeout} ${this.ipAddress}`
        : `ping -c ${this.batchSize} -W ${Math.ceil(this.timeout / 1000)} ${this.ipAddress}`;

    console.log(`[DEBUG] Executing command: ${pingCommand}`);

    try {
      console.log('[DEBUG] Calling execAsync...');
      const result = await execAsync(pingCommand);
      console.log('[DEBUG] execAsync completed successfully');
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (execError: any) {
      if (!this.isPolling) {
        console.log(
          '[DEBUG] Ping aborted after execAsync - poller stopped'
        );
        throw new Error('Ping aborted - poller stopped');
      }

      const stdout = execError?.stdout || '';
      const stderr = execError?.stderr || '';
      console.log(
        `[DEBUG] Ping command exited with error, but parsing output: ${execError?.message}`
      );
      console.log(
        `[DEBUG] stdout length: ${stdout.length}, stderr length: ${stderr.length}`
      );
      return {
        stdout,
        stderr,
        commandError:
          execError instanceof Error
            ? execError
            : new Error('Unknown exec error')
      };
    }
  }

  /**
   * Builds a `PollResult` object based on the output of a ping command.
   *
   * @param stdout - The standard output from the ping command.
   * @param stderr - The standard error output from the ping command.
   * @param commandError - An optional error object if the ping command failed.
   * @param attempt - The current attempt number for the ping operation.
   * @returns A `PollResult` containing parsed ping statistics and error information.
   */
  private buildResult(
    stdout: string,
    stderr: string,
    commandError: Error | undefined,
    attempt: number
  ): PollResult {
    console.log(
      `[DEBUG] Ping output for ${this.ipAddress}:\n${stdout}`
    );
    if (stderr) {
      console.error(
        `[DEBUG] Ping error output for ${this.ipAddress}:\n[STDERR] ${stderr}`
      );
    }

    const parseResult = this.parsePingOutput(stdout, stderr);

    return {
      timestamp: new Date(),
      success: parseResult.success!,
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
  }

  /**
   * Constructs a failure result object for a polling attempt.
   *
   * @param commandError - The error encountered during the ping command, if any.
   * @param attempt - The current attempt number for the polling operation.
   * @returns A `PollResult` object indicating failure, including error details, attempt count,
   *          100% packet loss, and an empty array of response times.
   */
  private buildFailureResult(
    commandError: Error | string | undefined,
    attempt: number
  ): PollResult {
    if (typeof commandError === 'string') {
      commandError = new Error(commandError);
    }
    return {
      timestamp: new Date(),
      success: false,
      error: commandError
        ? commandError.message
        : 'Unknown ping error',
      attempts: attempt,
      packetLoss: 100,
      responseTimes: []
    };
  }

  /** Utility for retry backoff delay */
  private async delay(ms: number): Promise<void> {
    if (!this.isPolling) {
      console.log(
        '[DEBUG] Ping aborted during retry wait - poller stopped'
      );
      throw new Error('Ping aborted - poller stopped');
    }
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Parses the output from a ping command and extracts relevant statistics.
   *
   * Depending on the operating system, it delegates parsing to either
   * `parseWindowsPing` or `parseUnixPing`. It calculates response times,
   * packet loss, and basic statistics (min, max, average) from the ping results.
   * Handles cases where no output is received or parsing fails.
   *
   * @param stdout - The standard output from the ping command.
   * @param stderr - The standard error output from the ping command.
   * @returns A partial {@link PollResult} object containing:
   *   - `success`: Whether the ping was successful.
   *   - `responseTimes`: Array of response times in milliseconds.
   *   - `packetLoss`: Percentage of packet loss.
   *   - `minTime`, `maxTime`, `avgTime`: Calculated statistics for response times.
   *   - `error`: Error message if parsing failed or no output was received.
   */
  private parsePingOutput(
    stdout: string,
    stderr: string
  ): Partial<PollResult> {
    try {
      if (!stdout && !stderr) {
        return {
          success: false,
          responseTimes: [],
          packetLoss: 100,
          error: 'No ping output received'
        };
      }

      const { pingTimes, packetLoss, error } =
        process.platform === 'win32'
          ? this.parseWindowsPing(stdout)
          : this.parseUnixPing(stdout, stderr);

      console.log(
        `[DEBUG] Extracted ping times: ${JSON.stringify(pingTimes)}`
      );
      console.log(`[DEBUG] Calculated packet loss: ${packetLoss}%`);

      const { minTime, maxTime, avgTime } =
        this.calculateStats(pingTimes);

      const success = pingTimes.length > 0 && packetLoss < 100;

      console.log(`[DEBUG] Ping success: ${success}`);
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

  /**
   * Parses the output of the Windows `ping` command to extract ping times, packet loss percentage, and any error messages.
   *
   * @param stdout - The standard output string from the Windows `ping` command.
   * @returns An object containing:
   * - `pingTimes`: An array of ping times in milliseconds.
   * - `packetLoss`: The percentage of packet loss.
   * - `error`: An optional error message if a known error pattern is detected in the output.
   */
  private parseWindowsPing(stdout: string): {
    pingTimes: number[];
    packetLoss: number;
    error?: string;
  } {
    const timeMatches = [...stdout.matchAll(/time[=<](\d+)ms/gi)];
    const pingTimes = timeMatches.map((m) => parseInt(m[1]));

    const packetLoss = Math.round(
      ((this.batchSize - pingTimes.length) / this.batchSize) * 100
    );

    let error: string | undefined;
    if (
      stdout.includes('Request timed out') ||
      stdout.includes('Destination host unreachable') ||
      stdout.includes('could not find host')
    ) {
      error = this.extractWindowsError(stdout);
    }

    return { pingTimes, packetLoss, error };
  }

  /**
   * Parses the output of a Unix `ping` command to extract ping times, packet loss percentage, and potential errors.
   *
   * @param stdout - The standard output string from the `ping` command.
   * @param stderr - The standard error string from the `ping` command.
   * @returns An object containing:
   *   - `pingTimes`: An array of ping times in milliseconds.
   *   - `packetLoss`: The percentage of packet loss.
   *   - `error` (optional): An error message if a known network error is detected.
   */
  private parseUnixPing(
    stdout: string,
    stderr: string
  ): { pingTimes: number[]; packetLoss: number; error?: string } {
    const timeMatches = [
      ...stdout.matchAll(/time=(\d+(?:\.\d+)?) ms/g)
    ];
    const pingTimes = timeMatches.map((m) => parseFloat(m[1]));

    const lossMatch = stdout.match(/(\d+(?:\.\d+)?)% packet loss/);
    const packetLoss = lossMatch
      ? Math.round(parseFloat(lossMatch[1]))
      : Math.round(
          ((this.batchSize - pingTimes.length) / this.batchSize) * 100
        );

    console.log(
      `[DEBUG] Found packet loss in output: ${packetLoss}%`
    );

    let error: string | undefined;
    if (
      stderr.includes('Name or service not known') ||
      stderr.includes('No route to host') ||
      stdout.includes('Destination Host Unreachable') ||
      stdout.includes('Network is unreachable')
    ) {
      error = stderr.trim() || this.extractUnixError(stdout);
    }

    return { pingTimes, packetLoss, error };
  }

  /**
   * Calculates statistical metrics (minimum, maximum, and average) from an array of ping times.
   *
   * @param pingTimes - An array of numbers representing ping times in milliseconds.
   * @returns An object containing:
   *   - `minTime`: The minimum ping time, if the array is not empty.
   *   - `maxTime`: The maximum ping time, if the array is not empty.
   *   - `avgTime`: The average ping time (rounded to two decimal places), if the array is not empty.
   *   If the input array is empty, returns an empty object.
   */
  private calculateStats(pingTimes: number[]): {
    minTime?: number;
    maxTime?: number;
    avgTime?: number;
  } {
    if (!pingTimes.length) return {};

    const minTime = Math.min(...pingTimes);
    const maxTime = Math.max(...pingTimes);
    const avgTime =
      Math.round(
        (pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length) *
          100
      ) / 100;

    return { minTime, maxTime, avgTime };
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

  /**
   * Performs a single polling operation to execute a ping.
   * Ensures that only one poll runs at a time by checking if a previous poll is still in progress.
   * If a poll is already running, the method logs a debug message and skips execution.
   * Handles errors by emitting a 'poll-error' event if polling is active.
   * Resets the current ping promise after completion or error.
   *
   * @returns {Promise<void>} A promise that resolves when the poll operation is complete.
   */
  private async performPoll(): Promise<void> {
    if (this.currentPingPromise) {
      console.log(
        '[DEBUG] Skipping poll - previous poll still running'
      );
      return;
    }

    try {
      this.currentPingPromise = this.executePing();
      await this.currentPingPromise;
    } catch (error) {
      if (this.isPolling) {
        this.emit('poll-error', error);
      }
    } finally {
      this.currentPingPromise = undefined;
    }
  }

  /**
   * Executes a ping operation with a specified number of retries and processes the result.
   *
   * - Calls the `ping` method with `maxRetries + 1` attempts.
   * - If polling is active (`isPolling` is true), appends the result to the `results` array,
   *   emits a `'poll-result'` event, and ensures the results array does not exceed 1000 entries.
   * - If an error occurs and polling is still active, the error is thrown.
   *
   * @returns {Promise<void>} A promise that resolves when the ping operation is complete.
   * @throws Will throw an error if the ping operation fails while polling is active.
   */
  private async executePing(): Promise<void> {
    try {
      const result = await this.ping(this.maxRetries + 1);

      if (this.isPolling) {
        this.results.push(result);
        this.emit('poll-result', result);

        if (this.results.length > 1000) {
          this.results = this.results.slice(-1000);
        }
      }
    } catch (error) {
      if (this.isPolling) {
        throw error;
      }
    }
  }

  /**
   * Starts the polling process. If the poller is already running, an error is thrown.
   * Initializes the polling state, sets up an abort controller, emits a 'started' event,
   * and schedules recurring polls at the specified frequency.
   *
   * @throws {Error} If the poller is already running.
   */
  public start(): void {
    if (this.isPolling) {
      throw new Error('Poller is already running');
    }

    this.isPolling = true;
    this.abortController = new AbortController();
    this.emit('started');

    console.log('[DEBUG] Starting poller - performing initial poll');

    this.performPoll().catch((error) => {
      if (this.isPolling) {
        console.error('[DEBUG] Initial poll error:', error);
      }
    });

    this.pollInterval = setInterval(() => {
      if (this.isPolling) {
        this.performPoll().catch((error) => {
          if (this.isPolling) {
            console.error('[DEBUG] Scheduled poll error:', error);
          }
        });
      }
    }, this.frequency);

    console.log(
      `[DEBUG] Poll interval set for every ${this.frequency}ms`
    );
  }

  /**
   * Stops the polling process gracefully.
   *
   * This method halts the polling loop, clears any active intervals,
   * aborts any ongoing ping operations, and waits for the current ping
   * promise to resolve or reject before completing. Emits a 'stopped' event
   * when the poller has fully stopped.
   *
   * @returns {Promise<void>} Resolves when the poller has stopped.
   */
  public async stop(): Promise<void> {
    if (!this.isPolling) {
      return;
    }

    console.log('[DEBUG] Stopping poller...');

    this.isPolling = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = undefined;
      console.log('[DEBUG] Poll interval cleared');
    }

    if (this.abortController) {
      this.abortController.abort();
    }

    if (this.currentPingPromise) {
      console.log('[DEBUG] Waiting for current ping to complete...');
      try {
        await this.currentPingPromise;
      } catch {
        console.log(
          '[DEBUG] Current ping completed with error (expected during stop)'
        );
      }
    }

    console.log('[DEBUG] Poller stopped');
    this.emit('stopped');
  }

  /**
   * Returns a shallow copy of the current poll results.
   *
   * @returns {PollResult[]} An array containing the poll results.
   */
  public getResults(): PollResult[] {
    return [...this.results];
  }

  /**
   * Returns the most recent polling result.
   *
   * @returns The last {@link PollResult} in the results array, or `undefined` if there are no results.
   */
  public getLastResult(): PollResult | undefined {
    return this.results[this.results.length - 1];
  }

  /**
   * Calculates and returns statistics based on the collected ping results.
   *
   * @returns An object containing the following statistics:
   * - `totalPingsBatches`: Total number of ping result batches.
   * - `successfulPings`: Number of successful ping batches.
   * - `failedPings`: Number of failed ping batches.
   * - `avgPacketLoss`: Average packet loss percentage across all batches.
   * - `averageResponseTime`: Average response time (ms) for successful pings, or `undefined` if none.
   * - `minResponseTime`: Minimum response time (ms) for successful pings, or `undefined` if none.
   * - `maxResponseTime`: Maximum response time (ms) for successful pings, or `undefined` if none.
   *
   * Returns `null` if there are no results.
   */
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

  /**
   * Clears all stored ping results and emits a 'results-cleared' event.
   *
   * This method resets the `results` array to an empty state and notifies listeners
   * that the results have been cleared.
   */
  public clearResults(): void {
    this.results = [];
    this.emit('results-cleared');
  }

  /**
   * Indicates whether the polling process is currently active.
   *
   * @returns `true` if polling is in progress; otherwise, `false`.
   */
  public isRunning(): boolean {
    return this.isPolling;
  }

  /**
   * Retrieves the current poller configuration.
   *
   * @returns An object containing the IP address, polling frequency, timeout, and maximum retries.
   */
  public getConfiguration() {
    return {
      ipAddress: this.ipAddress,
      frequency: this.frequency,
      timeout: this.timeout,
      maxRetries: this.maxRetries
    };
  }

  public setConfiguration(config: {
    ipAddress?: string;
    frequency?: number;
    timeout?: number;
    maxRetries?: number;
  }): void {
    this.ipAddress = config.ipAddress ?? this.ipAddress;
    this.frequency = config.frequency ?? this.frequency;
    this.timeout = config.timeout ?? this.timeout;
    this.maxRetries = config.maxRetries ?? this.maxRetries;
  }
}

// Usage example:

const poller = new AccessPointPoller({
  ipAddress: '8.8.8.8',
  frequency: 15000, // Poll every 5 seconds
  timeout: 1000, // 1 second timeout
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
