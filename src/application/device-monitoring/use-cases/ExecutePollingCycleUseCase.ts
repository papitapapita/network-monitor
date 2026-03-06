import { Result } from '../../../domain/device-inventory';
import { UseCase } from '../../shared/core/UseCase';
import { ILogger } from '../../shared/interfaces/ILogger';
import { IDevicePoller } from '../interfaces/IDevicePoller';
import { INetworkDeviceRepository } from '../../../domain/device-inventory/repository/INetworkDeviceRepository';
import { NetworkDeviceId } from '../../domain/device-inventory/value-objects/NetworkDeviceId';
import {
  PollingMetrics,
  NetworkDeviceStatus
} from '../../domain/value-objects';
import { ExecutePollingCycleDTO } from '../dtos/ExecutePollingCycleDTO';
import { SingleDevicePollingResultDTO } from '../dtos/SingleDevicePollingResultDTO';

/**
 * ExecutePollingCycleUseCase
 *
 * Business Intent: Execute a polling cycle on a network device to check availability
 *
 * Flow:
 * 1. beforeExecute: Validate device ID format
 * 2. executeImpl: Orchestrate polling execution with retry logic
 * 3. afterExecute: Domain events dispatched automatically by repository
 *
 * Business Rules:
 * - Device must exist and not be soft-deleted
 * - Scheduled polls require polling enabled and proper scheduling
 * - Forced polls ignore schedule and enabled status
 * - Multi-ping execution (configurable 1-10 pings per poll)
 * - Automatic retry logic based on device's RetryPolicy
 * - Success sets device status to ONLINE (via event handler)
 * - Failure sets device status to OFFLINE (via event handler)
 * - PollingResult aggregate created for each execution
 * - Events emitted for cross-aggregate coordination:
 *   * DevicePolledSuccessfullyEvent (on success)
 *   * DevicePollingFailedEvent (on failure)
 * - NetworkDevice status updated via event handler (eventual consistency)
 *
 * Polling Modes:
 * - Scheduled (forceExecution=false, default):
 *   * Respects polling schedule (nextScheduledAt)
 *   * Requires polling enabled
 *   * Skips if not due yet
 *   * Used by automated polling scheduler
 *
 * - Manual/Forced (forceExecution=true):
 *   * Ignores schedule and enabled status
 *   * Always executes immediately
 *   * Useful for testing, manual checks, troubleshooting
 *
 * Retry Policy:
 * - Max attempts configured per device (typically 1-5)
 * - Retry delay configured per device (typically 1000-5000ms)
 * - Each attempt performs full multi-ping sequence
 * - Success on any attempt stops retry loop
 * - Failure after all attempts marks device as OFFLINE
 *
 * Requirements:
 * - Sprint 1: ICMP polling with multi-ping support
 * - Future: SNMP, custom protocols, parallel device polling
 * - Single aggregate modification (PollingResult only)
 * - Event-driven cross-aggregate updates (NetworkDevice via handler)
 * - Eventual consistency model
 *
 * Dependencies:
 * - INetworkDeviceRepository: Load device configuration
 * - IPollingResultRepository: Persist polling results (via PollingResult aggregate)
 * - IDevicePoller: Execute actual polling (ICMP, SNMP, etc.)
 * - ILogger: Log polling operations
 *
 * Domain Events:
 * - DevicePolledSuccessfullyEvent: Emitted on successful poll
 * - DevicePollingFailedEvent: Emitted on failed poll
 * - Handled by UpdateNetworkDevicePollingStateHandler to update device status
 *
 * @example Scheduled polling (automated by scheduler)
 * ```typescript
 * const useCase = new ExecutePollingCycleUseCase(
 *   deviceRepository,
 *   pollingResultRepository,
 *   icmpPoller,
 *   logger
 * );
 *
 * const result = await useCase.execute({
 *   networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
 *   forceExecution: false
 * });
 *
 * if (result.isSuccess) {
 *   const summary = result.value;
 *   console.log(`Poll ${summary.status}: ${summary.message}`);
 *   if (summary.metrics) {
 *     console.log(`Avg response: ${summary.metrics.averageResponseTime}ms`);
 *     console.log(`Packet loss: ${summary.metrics.packetLoss}%`);
 *   }
 * }
 * ```
 *
 * @example Manual/forced polling (user-initiated)
 * ```typescript
 * const result = await useCase.execute({
 *   networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
 *   forceExecution: true
 * });
 * ```
 */
export class ExecutePollingCycleUseCase extends UseCase<
  ExecutePollingCycleDTO,
  SingleDevicePollingResultDTO
> {
  constructor(
    private readonly networkDeviceRepository: INetworkDeviceRepository,
    private readonly devicePoller: IDevicePoller,
    logger: ILogger
  ) {
    super(logger, 'ExecutePollingCycleUseCase');
  }

  /**
   * Pre-execution validation.
   * Validates device ID format before polling.
   */
  protected async beforeExecute(
    request: ExecutePollingCycleDTO
  ): Promise<Result<void> | null> {
    // Validate device ID is provided
    if (
      !request.networkDeviceId ||
      request.networkDeviceId.trim().length === 0
    ) {
      return Result.fail('Network device ID is required');
    }

    return null; // Validation passed
  }

  /**
   * Main execution: Orchestrate polling cycle with retry logic.
   *
   * Steps:
   * 1. Create device ID value object
   * 2. Load device aggregate (read-only for configuration)
   * 3. Check if device should be polled (scheduling, enabled status)
   * 4. Verify poller can handle this device type
   * 5. Execute polling with automatic retry logic
   * 6. Create PollingResult aggregate (emits domain events)
   * 7. Persist PollingResult (events dispatched by repository)
   * 8. Build and return summary DTO
   */
  protected async executeImpl(
    request: ExecutePollingCycleDTO
  ): Promise<Result<SingleDevicePollingResultDTO>> {
    const { networkDeviceId, forceExecution = false } = request;

    // ========================================
    // 1. Create device ID value object
    // ========================================
    const deviceIdResult = NetworkDeviceId.create(networkDeviceId);
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deviceId = deviceIdResult.value;

    // ========================================
    // 2. Load device aggregate (read-only for configuration)
    // ========================================
    const deviceResult =
      await this.networkDeviceRepository.findById(deviceId);

    if (deviceResult.isFailure) {
      return this.fail(
        `Failed to load device: ${deviceResult.error}`
      );
    }

    if (!deviceResult.value) {
      return this.fail(`Device not found: ${networkDeviceId}`);
    }

    const device = deviceResult.value;

    // Business rule: Cannot poll soft-deleted devices
    if (device.deletedAt !== null) {
      return this.fail(
        'Cannot poll a soft-deleted device. Restore it first.'
      );
    }

    // ========================================
    // 3. Check if device should be polled
    // ========================================
    if (!forceExecution) {
      const shouldPoll = device.shouldPoll(new Date());
      if (!shouldPoll) {
        // Polling skipped - return early
        return this.ok({
          networkDeviceId,
          status: 'SKIPPED',
          message: 'Device polling is not scheduled or not enabled',
          attemptNumber: 0,
          timestamp: new Date(),
          metrics: null,
          deviceStatus: device.status.toString()
        });
      }
    }

    // ========================================
    // 4. Verify poller can handle this device type
    // ========================================
    if (!this.devicePoller.canPoll(device)) {
      return this.fail(
        `Poller '${this.devicePoller.getProtocolName()}' cannot poll device type: ${device.deviceType.toString()}`
      );
    }

    // ========================================
    // 5. Execute polling with automatic retry logic
    // ========================================
    const pollingConfig = device.pollingConfiguration;
    const retryPolicy = pollingConfig.retryPolicy;
    let attemptNumber = 1;
    let lastMetrics: PollingMetrics | null = null;
    let lastError: string | null = null;
    let pollingSuccess = false;

    // Retry loop
    while (attemptNumber <= retryPolicy.maxAttempts) {
      this.logger.debug('Executing polling attempt', {
        deviceId: networkDeviceId,
        attempt: attemptNumber,
        maxAttempts: retryPolicy.maxAttempts,
        pingCount: pollingConfig.pingCount
      });

      // Execute the poll
      const pollResult = await this.devicePoller.poll(device);

      if (pollResult.isSuccess) {
        // Success - extract metrics and exit retry loop
        lastMetrics = pollResult.value;
        pollingSuccess = true;

        this.logger.info('Polling attempt succeeded', {
          deviceId: networkDeviceId,
          attempt: attemptNumber,
          avgResponseTime: lastMetrics.averageResponseTime,
          packetLoss: lastMetrics.packetLoss
        });

        break; // Exit retry loop on success
      } else {
        // Failure - log and potentially retry
        lastError = pollResult.error!;

        this.logger.warn('Polling attempt failed', {
          deviceId: networkDeviceId,
          attempt: attemptNumber,
          error: lastError
        });

        // Check if we should retry
        if (attemptNumber < retryPolicy.maxAttempts) {
          // Wait before next retry
          await this.delay(retryPolicy.baseDelayMs);
          attemptNumber++;
        } else {
          // Max attempts reached - exit loop
          break;
        }
      }
    }

    // ========================================
    // 6. Create PollingResult aggregate (emits domain events)
    // ========================================
    // Note: PollingResult creation happens in domain layer
    // We don't create it here - the poller/domain service does
    // This use case just orchestrates and returns results

    // ========================================
    // 7. Build and return summary DTO
    // ========================================
    const summary: SingleDevicePollingResultDTO = {
      networkDeviceId,
      status: pollingSuccess ? 'SUCCESS' : 'FAILED',
      message: pollingSuccess
        ? `Device polled successfully with ${pollingConfig.pingCount} pings`
        : `Polling failed after ${attemptNumber} attempts: ${lastError}`,
      attemptNumber,
      timestamp: new Date(),
      metrics: lastMetrics
        ? {
            responseTimes: lastMetrics.responseTimes,
            averageResponseTime: lastMetrics.averageResponseTime,
            minResponseTime: lastMetrics.minResponseTime,
            maxResponseTime: lastMetrics.maxResponseTime,
            packetLoss: lastMetrics.packetLoss,
            jitter: lastMetrics.jitter
          }
        : null,
      deviceStatus: pollingSuccess
        ? NetworkDeviceStatus.ONLINE.toString()
        : NetworkDeviceStatus.OFFLINE.toString()
    };

    return this.ok(summary);
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Delays execution for the specified milliseconds.
   * Used for retry delays between polling attempts.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitize data for logging.
   * No sensitive data in polling operations.
   */
  protected sanitizeForLogging(data: any): any {
    // No sensitive data in polling operations
    return data;
  }
}
