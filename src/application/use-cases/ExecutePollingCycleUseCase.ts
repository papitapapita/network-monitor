import { Result } from '@/core/Result';
import { UseCase } from '@/application/core/UseCase';
import { ILogger } from '@/application/interfaces/ILogger';
import { IDevicePoller } from '@/application/interfaces/IDevicePoller';
import { INetworkDeviceRepository } from '@/domain/repository/INetworkDeviceRepository';
import { IPollingResultRepository } from '@/domain/repository/IPollingResultRepository';
import { NetworkDeviceId } from '@/domain/entities/NetworkDeviceId';
import { NetworkDevice } from '@/domain/entities/NetworkDevice';
import { PollingResult } from '@/domain/entities/PollingResult';
import { PollingStatus, NetworkDeviceStatus, PollingMetrics } from '@/domain/value-objects';
import { PollingCycleSummaryDTO } from '@/application/dtos/PollingDTO';
import { PollingMapper } from '@/application/mappers/PollingMapper';

/**
 * Request for executing a polling cycle.
 */
export interface ExecutePollingCycleCommand {
  /**
   * ID of the network device to poll.
   */
  networkDeviceId: string;

  /**
   * Whether this is a manual poll (ignores scheduling).
   * Default: false (respects polling schedule)
   */
  forceExecution?: boolean;
}

/**
 * Use Case: Execute Polling Cycle
 *
 * This is the core polling execution use case that:
 * 1. Validates device is ready to be polled
 * 2. Executes multi-ping ICMP polling (4 pings default, configurable 1-10)
 * 3. Handles retries based on RetryPolicy
 * 4. Updates device status based on results
 * 5. Persists polling results to TimescaleDB
 * 6. Raises domain events for monitoring
 *
 * Workflow:
 * 1. Load NetworkDevice aggregate
 * 2. Check if device should be polled (scheduling, enabled status)
 * 3. Execute polling using IDevicePoller (multi-ping)
 * 4. Handle success/failure with retry logic
 * 5. Create PollingResult aggregate
 * 6. Update device status if needed
 * 7. Persist both aggregates
 * 8. Return summary
 *
 * Sprint 1: ICMP polling with multi-ping support
 * Future: SNMP, custom protocols, parallel device polling
 *
 * @example
 * ```typescript
 * const useCase = new ExecutePollingCycleUseCase(
 *   deviceRepository,
 *   pollingResultRepository,
 *   icmpPoller,
 *   logger
 * );
 *
 * // Scheduled polling
 * const result = await useCase.execute({
 *   networkDeviceId: 'device-123'
 * });
 *
 * // Manual/forced polling
 * const forcedResult = await useCase.execute({
 *   networkDeviceId: 'device-123',
 *   forceExecution: true
 * });
 *
 * if (result.isSuccess) {
 *   const summary = result.getValue();
 *   console.log(`Poll ${summary.status}: ${summary.message}`);
 *   console.log(`Response times: ${summary.metrics?.responseTimes.join(', ')}ms`);
 * }
 * ```
 */
export class ExecutePollingCycleUseCase extends UseCase<
  ExecutePollingCycleCommand,
  PollingCycleSummaryDTO
> {
  constructor(
    private readonly networkDeviceRepository: INetworkDeviceRepository,
    private readonly pollingResultRepository: IPollingResultRepository,
    private readonly devicePoller: IDevicePoller,
    logger: ILogger
  ) {
    super(logger, 'ExecutePollingCycleUseCase');
  }

  /**
   * Validates the command before execution.
   */
  protected async beforeExecute(
    command: ExecutePollingCycleCommand
  ): Promise<Result<void> | null> {
    // Validate device ID format
    if (!command.networkDeviceId || command.networkDeviceId.trim().length === 0) {
      return this.fail<void>('Network device ID is required');
    }

    return null; // No validation errors
  }

  /**
   * Executes the polling cycle.
   */
  protected async executeImpl(
    command: ExecutePollingCycleCommand
  ): Promise<Result<PollingCycleSummaryDTO>> {
    const { networkDeviceId, forceExecution = false } = command;

    // Step 1: Load NetworkDevice aggregate
    const deviceId = NetworkDeviceId.create(networkDeviceId);
    const deviceResult = await this.networkDeviceRepository.findById(deviceId);

    if (deviceResult.isFailure) {
      return this.fail<PollingCycleSummaryDTO>(
        `Failed to load device: ${deviceResult.getErrorValue()}`
      );
    }

    const device = deviceResult.getValue();
    if (!device) {
      return this.fail<PollingCycleSummaryDTO>(
        `Device not found: ${networkDeviceId}`
      );
    }

    // Step 2: Check if device should be polled
    if (!forceExecution) {
      const shouldPoll = device.shouldPoll(new Date());
      if (!shouldPoll) {
        return this.ok<PollingCycleSummaryDTO>({
          networkDeviceId,
          status: 'SKIPPED',
          message: 'Device polling is not scheduled or not enabled',
          attemptNumber: 0,
          timestamp: new Date(),
          metrics: null,
          deviceStatus: device.status,
        });
      }
    }

    // Step 3: Check if poller can handle this device
    if (!this.devicePoller.canPoll(device)) {
      return this.fail<PollingCycleSummaryDTO>(
        `Poller '${this.devicePoller.getProtocolName()}' cannot poll device type: ${device.deviceType}`
      );
    }

    // Step 4: Execute polling with retry logic
    const pollingConfig = device.getPollingConfiguration();
    const retryPolicy = pollingConfig.retryPolicy;
    let attemptNumber = 1;
    let lastMetrics: PollingMetrics | null = null;
    let lastError: string | null = null;
    let pollingSuccess = false;

    while (attemptNumber <= retryPolicy.maxAttempts) {
      this.logger.debug('Executing polling attempt', {
        deviceId: networkDeviceId,
        attempt: attemptNumber,
        maxAttempts: retryPolicy.maxAttempts,
        pingCount: pollingConfig.pingCount,
      });

      // Execute the poll
      const pollResult = await this.devicePoller.poll(device);

      if (pollResult.isSuccess) {
        lastMetrics = pollResult.getValue();
        pollingSuccess = true;
        this.logger.info('Polling attempt succeeded', {
          deviceId: networkDeviceId,
          attempt: attemptNumber,
          avgResponseTime: lastMetrics.averageResponseTime,
          packetLoss: lastMetrics.packetLoss,
        });
        break; // Success, exit retry loop
      } else {
        lastError = pollResult.getErrorValue();
        this.logger.warn('Polling attempt failed', {
          deviceId: networkDeviceId,
          attempt: attemptNumber,
          error: lastError,
        });

        // Check if we should retry
        if (attemptNumber < retryPolicy.maxAttempts) {
          // Wait before retry
          await this.delay(retryPolicy.retryDelayMs);
          attemptNumber++;
        } else {
          // Max attempts reached
          break;
        }
      }
    }

    // Step 5: Create PollingResult aggregate
    let pollingResult: PollingResult;

    if (pollingSuccess && lastMetrics) {
      // Success case
      const resultOrError = PollingResult.createSuccess({
        networkDeviceId: deviceId,
        timestamp: new Date(),
        metrics: lastMetrics,
        attemptNumber,
        deviceStatus: NetworkDeviceStatus.ONLINE,
      });

      if (resultOrError.isFailure) {
        return this.fail<PollingCycleSummaryDTO>(
          `Failed to create polling result: ${resultOrError.getErrorValue()}`
        );
      }

      pollingResult = resultOrError.getValue();
    } else {
      // Failure case (all retries exhausted)
      const resultOrError = PollingResult.createFailure({
        networkDeviceId: deviceId,
        timestamp: new Date(),
        attemptNumber,
        errorMessage: lastError || 'Polling failed after all retry attempts',
        deviceStatus: NetworkDeviceStatus.OFFLINE,
      });

      if (resultOrError.isFailure) {
        return this.fail<PollingCycleSummaryDTO>(
          `Failed to create polling result: ${resultOrError.getErrorValue()}`
        );
      }

      pollingResult = resultOrError.getValue();
    }

    // Step 6: Update device status based on polling result
    const updateStatusResult = device.updatePollingState(pollingResult);
    if (updateStatusResult.isFailure) {
      this.logger.error('Failed to update device polling state', {
        deviceId: networkDeviceId,
        error: updateStatusResult.getErrorValue(),
      });
      // Continue anyway, this is not critical
    }

    // Step 7: Schedule next poll
    pollingConfig.scheduleNext(new Date());

    // Step 8: Persist aggregates
    const saveDeviceResult = await this.networkDeviceRepository.save(device);
    if (saveDeviceResult.isFailure) {
      return this.fail<PollingCycleSummaryDTO>(
        `Failed to save device: ${saveDeviceResult.getErrorValue()}`
      );
    }

    const saveResultResult = await this.pollingResultRepository.save(pollingResult);
    if (saveResultResult.isFailure) {
      return this.fail<PollingCycleSummaryDTO>(
        `Failed to save polling result: ${saveResultResult.getErrorValue()}`
      );
    }

    // Step 9: Build summary DTO
    const summary: PollingCycleSummaryDTO = {
      networkDeviceId,
      status: pollingSuccess ? 'SUCCESS' : 'FAILED',
      message: pollingSuccess
        ? `Device polled successfully with ${pollingConfig.pingCount} pings`
        : `Polling failed after ${attemptNumber} attempts: ${lastError}`,
      attemptNumber,
      timestamp: pollingResult.timestamp,
      metrics: lastMetrics ? PollingMapper.toPollingMetricsDTO(lastMetrics) : null,
      deviceStatus: pollingResult.deviceStatus,
    };

    return this.ok<PollingCycleSummaryDTO>(summary);
  }

  /**
   * Delays execution for the specified milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sanitizes command for logging (removes sensitive data if any).
   */
  protected sanitizeForLogging(data: any): any {
    // No sensitive data in this command, return as-is
    return data;
  }
}
