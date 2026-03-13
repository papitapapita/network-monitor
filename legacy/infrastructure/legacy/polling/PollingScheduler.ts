import { ILogger } from '@/application/interfaces/ILogger';
import { ExecutePollingCycleUseCase } from '@/application/use-cases';
import { INetworkDeviceRepository } from '@/domain/repository/INetworkDeviceRepository';

/**
 * Configuration for the polling scheduler.
 */
export interface PollingSchedulerConfig {
  /**
   * How often to check for devices that need polling (in milliseconds).
   * Default: 5000 (5 seconds)
   */
  checkIntervalMs?: number;

  /**
   * Maximum number of devices to poll concurrently.
   * Default: 10
   */
  maxConcurrentPolls?: number;

  /**
   * Whether to start the scheduler automatically on creation.
   * Default: false
   */
  autoStart?: boolean;
}

/**
 * Scheduler for continuous network device polling.
 *
 * Responsibilities:
 * - Periodically query for devices due for polling
 * - Execute polling cycles using ExecutePollingCycleUseCase
 * - Manage concurrent polling with worker pool
 * - Handle errors and retries
 * - Provide status and statistics
 *
 * Architecture:
 * - Uses interval-based polling (checks every N seconds)
 * - Respects device-specific schedules (nextScheduledAt)
 * - Limits concurrent polls to avoid overwhelming the network
 * - Graceful shutdown support
 *
 * @example
 * ```typescript
 * const scheduler = new PollingScheduler(
 *   deviceRepository,
 *   executePollingUseCase,
 *   logger,
 *   {
 *     checkIntervalMs: 5000,
 *     maxConcurrentPolls: 10
 *   }
 * );
 *
 * // Start polling
 * scheduler.start();
 *
 * // Get status
 * const status = scheduler.getStatus();
 * console.log(`Active polls: ${status.activePolls}, Completed: ${status.completedPolls}`);
 *
 * // Stop polling
 * await scheduler.stop();
 * ```
 */
export class PollingScheduler {
  private readonly config: Required<PollingSchedulerConfig>;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private activePolls: Set<string> = new Set();
  private statistics = {
    totalPolls: 0,
    successfulPolls: 0,
    failedPolls: 0,
    skippedPolls: 0,
  };

  /**
   * Default configuration values.
   */
  private static readonly DEFAULT_CONFIG: Required<PollingSchedulerConfig> = {
    checkIntervalMs: 5000, // 5 seconds
    maxConcurrentPolls: 10,
    autoStart: false,
  };

  constructor(
    private readonly networkDeviceRepository: INetworkDeviceRepository,
    private readonly executePollingUseCase: ExecutePollingCycleUseCase,
    private readonly logger: ILogger,
    config?: PollingSchedulerConfig
  ) {
    this.config = {
      ...PollingScheduler.DEFAULT_CONFIG,
      ...config,
    };

    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Starts the polling scheduler.
   */
  public start(): void {
    if (this.isRunning) {
      this.logger.warn('Polling scheduler is already running');
      return;
    }

    this.logger.info('Starting polling scheduler', {
      checkIntervalMs: this.config.checkIntervalMs,
      maxConcurrentPolls: this.config.maxConcurrentPolls,
    });

    this.isRunning = true;
    this.intervalId = setInterval(
      () => this.pollDevices(),
      this.config.checkIntervalMs
    );

    // Execute first poll immediately
    this.pollDevices();
  }

  /**
   * Stops the polling scheduler.
   *
   * Waits for active polls to complete before stopping.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      this.logger.warn('Polling scheduler is not running');
      return;
    }

    this.logger.info('Stopping polling scheduler...');
    this.isRunning = false;

    // Clear interval
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Wait for active polls to complete
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    while (this.activePolls.size > 0 && Date.now() - startTime < maxWaitTime) {
      this.logger.debug('Waiting for active polls to complete', {
        activePolls: this.activePolls.size,
      });
      await this.delay(1000);
    }

    if (this.activePolls.size > 0) {
      this.logger.warn('Stopped with active polls still running', {
        activePolls: this.activePolls.size,
      });
    }

    this.logger.info('Polling scheduler stopped', this.statistics);
  }

  /**
   * Checks if the scheduler is running.
   */
  public isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Gets current scheduler status and statistics.
   */
  public getStatus(): {
    isRunning: boolean;
    activePolls: number;
    totalPolls: number;
    successfulPolls: number;
    failedPolls: number;
    skippedPolls: number;
    successRate: number;
  } {
    const successRate =
      this.statistics.totalPolls > 0
        ? (this.statistics.successfulPolls / this.statistics.totalPolls) * 100
        : 0;

    return {
      isRunning: this.isRunning,
      activePolls: this.activePolls.size,
      ...this.statistics,
      successRate: Number(successRate.toFixed(2)),
    };
  }

  /**
   * Resets statistics counters.
   */
  public resetStatistics(): void {
    this.statistics = {
      totalPolls: 0,
      successfulPolls: 0,
      failedPolls: 0,
      skippedPolls: 0,
    };
    this.logger.info('Polling statistics reset');
  }

  /**
   * Main polling loop - checks for devices due for polling.
   */
  private async pollDevices(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Check if we have capacity for more polls
      if (this.activePolls.size >= this.config.maxConcurrentPolls) {
        this.logger.debug('Max concurrent polls reached, skipping this cycle', {
          activePolls: this.activePolls.size,
          maxConcurrent: this.config.maxConcurrentPolls,
        });
        return;
      }

      // Get devices that need polling
      const devicesResult = await this.getDevicesDueForPolling();
      if (devicesResult.isFailure) {
        this.logger.error('Failed to get devices for polling', {
          error: devicesResult.getErrorValue(),
        });
        return;
      }

      const devices = devicesResult.getValue();
      if (devices.length === 0) {
        this.logger.debug('No devices due for polling');
        return;
      }

      this.logger.info('Found devices due for polling', {
        count: devices.length,
        availableSlots: this.config.maxConcurrentPolls - this.activePolls.size,
      });

      // Poll devices up to the concurrent limit
      const devicesToPoll = devices.slice(
        0,
        this.config.maxConcurrentPolls - this.activePolls.size
      );

      for (const device of devicesToPoll) {
        this.pollDevice(device.id.toString()).catch((error) => {
          this.logger.error('Unexpected error in pollDevice', {
            deviceId: device.id.toString(),
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    } catch (error) {
      this.logger.error('Unexpected error in pollDevices', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Polls a single device.
   */
  private async pollDevice(deviceId: string): Promise<void> {
    // Track this as an active poll
    this.activePolls.add(deviceId);
    this.statistics.totalPolls++;

    try {
      this.logger.debug('Starting poll for device', { deviceId });

      const result = await this.executePollingUseCase.execute({
        networkDeviceId: deviceId,
        forceExecution: false,
      });

      if (result.isSuccess) {
        const summary = result.getValue();

        if (summary.status === 'SUCCESS') {
          this.statistics.successfulPolls++;
          this.logger.info('Device polled successfully', {
            deviceId,
            avgResponseTime: summary.metrics?.averageResponseTime,
            packetLoss: summary.metrics?.packetLoss,
          });
        } else if (summary.status === 'SKIPPED') {
          this.statistics.skippedPolls++;
          this.logger.debug('Device poll skipped', {
            deviceId,
            reason: summary.message,
          });
        } else {
          this.statistics.failedPolls++;
          this.logger.warn('Device poll failed', {
            deviceId,
            reason: summary.message,
          });
        }
      } else {
        this.statistics.failedPolls++;
        this.logger.error('Polling use case failed', {
          deviceId,
          error: result.getErrorValue(),
        });
      }
    } catch (error) {
      this.statistics.failedPolls++;
      this.logger.error('Error polling device', {
        deviceId,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      // Remove from active polls
      this.activePolls.delete(deviceId);
    }
  }

  /**
   * Gets devices that are due for polling.
   *
   * Queries devices where:
   * - Polling is enabled
   * - nextScheduledAt is in the past or null
   */
  private async getDevicesDueForPolling(): Promise<Result<any[]>> {
    try {
      // This would typically use a custom repository method
      // For now, we'll use findAll and filter in-memory
      // TODO: Add findDevicesDueForPolling to INetworkDeviceRepository

      const devicesResult = await this.networkDeviceRepository.findAll();
      if (devicesResult.isFailure) {
        return devicesResult;
      }

      const allDevices = devicesResult.getValue();
      const now = new Date();

      const devicesDue = allDevices.filter((device) => {
        return device.shouldPoll(now);
      });

      return Result.ok(devicesDue);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Result.fail(`Failed to get devices due for polling: ${errorMessage}`);
    }
  }

  /**
   * Delays execution for the specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Import Result after the class definition to avoid circular dependencies
import { Result } from '@/core/Result';
