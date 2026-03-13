import { DomainEvents } from '../../domain/shared/core/DomainEvents';
import {
  DevicePolledSuccessfullyEvent,
  DevicePollingFailedEvent
} from '../../domain/device-inventory/events';
import { INetworkDeviceRepository } from '../../domain/device-inventory/repository/INetworkDeviceRepository';
import { PollingResult } from '../../domain/device-monitoring/aggregates/PollingResult';
import {
  NetworkDeviceStatus,
  PollingStatus
} from '../../domain/value-objects';
import { ILogger } from '../interfaces/ILogger';

/**
 * UpdateNetworkDevicePollingStateHandler
 *
 * Purpose:
 * - Updates NetworkDevice polling state based on polling results
 * - Handles both successful and failed polling events
 * - Maintains eventual consistency between PollingResult and NetworkDevice
 *
 * Triggered By:
 * - PollingResult.createSuccess() emits DevicePolledSuccessfullyEvent
 * - PollingResult.createFailure() emits DevicePollingFailedEvent
 *
 * Dependencies:
 * - INetworkDeviceRepository: For loading and saving NetworkDevice aggregates
 * - ILogger: For logging operations and errors
 *
 * Side Effects:
 * - Updates NetworkDevice.lastPollingResult
 * - Updates NetworkDevice.status based on polling outcome
 * - Schedules next polling cycle
 * - Persists NetworkDevice changes
 *
 * Error Handling:
 * - Logs errors but doesn't throw (resilient handler)
 * - Returns gracefully on repository failures
 * - Idempotent (safe to retry)
 *
 * Event-Driven Pattern:
 * This handler implements the event-driven approach for cross-aggregate operations:
 * 1. ExecutePollingCycleUseCase creates PollingResult (emits events)
 * 2. This handler receives polling events
 * 3. Handler loads and updates NetworkDevice aggregate
 * 4. Eventual consistency maintained across aggregates
 *
 * @example
 * ```typescript
 * const handler = new UpdateNetworkDevicePollingStateHandler(deviceRepo, logger);
 * handler.subscribe();
 * ```
 */
export class UpdateNetworkDevicePollingStateHandler {
  private subscriptionHandles: Array<() => void> = [];

  constructor(
    private readonly networkDeviceRepository: INetworkDeviceRepository,
    private readonly logger: ILogger
  ) {}

  /**
   * Subscribes to polling domain events.
   *
   * Should be called once at application startup.
   */
  public subscribe(): void {
    // Subscribe to DevicePolledSuccessfullyEvent
    const successHandle = DomainEvents.register(
      (event: DevicePolledSuccessfullyEvent) =>
        this.handlePollingSuccess(event),
      DevicePolledSuccessfullyEvent.name
    );
    this.subscriptionHandles.push(successHandle);

    // Subscribe to DevicePollingFailedEvent
    const failureHandle = DomainEvents.register(
      (event: DevicePollingFailedEvent) =>
        this.handlePollingFailure(event),
      DevicePollingFailedEvent.name
    );
    this.subscriptionHandles.push(failureHandle);

    this.logger.info(
      'UpdateNetworkDevicePollingStateHandler subscribed to polling events'
    );
  }

  /**
   * Unsubscribes from all domain events.
   * Called during graceful shutdown.
   */
  public unsubscribe(): void {
    this.subscriptionHandles.forEach((unsubscribe) => unsubscribe());
    this.subscriptionHandles = [];

    this.logger.info(
      'UpdateNetworkDevicePollingStateHandler unsubscribed from polling events'
    );
  }

  /**
   * Handles DevicePolledSuccessfullyEvent.
   *
   * Updates NetworkDevice with successful polling result:
   * - Reconstitutes PollingResult from event data
   * - Calls NetworkDevice.updatePollingState()
   * - Schedules next polling cycle
   * - Persists changes
   *
   * @private
   */
  private async handlePollingSuccess(
    event: DevicePolledSuccessfullyEvent
  ): Promise<void> {
    try {
      this.logger.debug('Processing DevicePolledSuccessfullyEvent', {
        deviceId: event.networkDeviceId.toString(),
        deviceName: event.deviceName,
        wasOffline: event.wasOffline
      });

      // 1. Load NetworkDevice aggregate
      const deviceResult =
        await this.networkDeviceRepository.findById(
          event.networkDeviceId
        );

      if (deviceResult.isFailure) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Failed to load device for polling success',
          {
            deviceId: event.networkDeviceId.toString(),
            error: deviceResult.error
          }
        );
        return;
      }

      if (!deviceResult.value) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Device not found for polling success',
          {
            deviceId: event.networkDeviceId.toString()
          }
        );
        return;
      }

      const device = deviceResult.value;

      // 2. Reconstitute PollingResult from event data
      // Event contains all necessary data to rebuild the aggregate without loading from DB
      const pollingResultOrError = PollingResult.reconstitute(
        {
          networkDeviceId: event.networkDeviceId,
          timestamp: event.dateTimeOccurred,
          status: PollingStatus.createSuccess().value,
          metrics: event.metrics,
          attemptNumber: 1, // Successful polls are typically first attempt
          errorMessage: null,
          deviceStatus: NetworkDeviceStatus.ONLINE
        },
        event.aggregateId // PollingResultId from event
      );

      if (pollingResultOrError.isFailure) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Failed to reconstitute polling result',
          {
            pollingResultId: event.aggregateId.toString(),
            error: pollingResultOrError.error
          }
        );
        return;
      }

      const pollingResult = pollingResultOrError.value;

      // 3. Update device polling state using domain method
      const updateResult = device.updatePollingState(pollingResult);
      if (updateResult.isFailure) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Failed to update device polling state',
          {
            deviceId: event.networkDeviceId.toString(),
            error: updateResult.error
          }
        );
        return;
      }

      // 4. Schedule next poll
      const pollingConfig = device.getPollingConfiguration();
      pollingConfig.scheduleNext(new Date());

      // 5. Persist updated device
      const saveResult =
        await this.networkDeviceRepository.save(device);
      if (saveResult.isFailure) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Failed to save device after polling success',
          {
            deviceId: event.networkDeviceId.toString(),
            error: saveResult.error
          }
        );
        return;
      }

      this.logger.info(
        'Device polling state updated successfully after successful poll',
        {
          deviceId: event.networkDeviceId.toString(),
          deviceName: event.deviceName,
          wasOffline: event.wasOffline,
          status: device.status
        }
      );
    } catch (error) {
      this.logger.error(
        '[UpdateNetworkDevicePollingStateHandler] Unexpected error handling polling success',
        {
          error:
            error instanceof Error ? error.message : String(error),
          deviceId: event.networkDeviceId.toString()
        }
      );
    }
  }

  /**
   * Handles DevicePollingFailedEvent.
   *
   * Updates NetworkDevice with failed polling result:
   * - Reconstitutes PollingResult from event data
   * - Calls NetworkDevice.updatePollingState()
   * - Schedules next polling cycle (with retry logic)
   * - Persists changes
   *
   * @private
   */
  private async handlePollingFailure(
    event: DevicePollingFailedEvent
  ): Promise<void> {
    try {
      this.logger.debug('Processing DevicePollingFailedEvent', {
        deviceId: event.networkDeviceId.toString(),
        deviceName: event.deviceName,
        errorMessage: event.errorMessage,
        wasOnline: event.wasOnline
      });

      // 1. Load NetworkDevice aggregate
      const deviceResult =
        await this.networkDeviceRepository.findById(
          event.networkDeviceId
        );

      if (deviceResult.isFailure) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Failed to load device for polling failure',
          {
            deviceId: event.networkDeviceId.toString(),
            error: deviceResult.error
          }
        );
        return;
      }

      if (!deviceResult.value) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Device not found for polling failure',
          {
            deviceId: event.networkDeviceId.toString()
          }
        );
        return;
      }

      const device = deviceResult.value;

      // 2. Reconstitute PollingResult from event data
      // Event contains all necessary data to rebuild the aggregate without loading from DB
      const pollingResultOrError = PollingResult.reconstitute(
        {
          networkDeviceId: event.networkDeviceId,
          timestamp: event.dateTimeOccurred,
          status: event.status,
          metrics: null, // Failed polls don't have metrics
          attemptNumber: event.attemptNumber,
          errorMessage: event.errorMessage,
          deviceStatus: NetworkDeviceStatus.OFFLINE
        },
        event.aggregateId // PollingResultId from event
      );

      if (pollingResultOrError.isFailure) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Failed to reconstitute polling result',
          {
            pollingResultId: event.aggregateId.toString(),
            error: pollingResultOrError.error
          }
        );
        return;
      }

      const pollingResult = pollingResultOrError.value;

      // 3. Update device polling state using domain method
      const updateResult = device.updatePollingState(pollingResult);
      if (updateResult.isFailure) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Failed to update device polling state',
          {
            deviceId: event.networkDeviceId.toString(),
            error: updateResult.error
          }
        );
        return;
      }

      // 4. Schedule next poll (retry logic handled by PollingConfiguration)
      const pollingConfig = device.getPollingConfiguration();
      pollingConfig.scheduleNext(new Date());

      // 5. Persist updated device
      const saveResult =
        await this.networkDeviceRepository.save(device);
      if (saveResult.isFailure) {
        this.logger.error(
          '[UpdateNetworkDevicePollingStateHandler] Failed to save device after polling failure',
          {
            deviceId: event.networkDeviceId.toString(),
            error: saveResult.error
          }
        );
        return;
      }

      this.logger.info(
        'Device polling state updated successfully after failed poll',
        {
          deviceId: event.networkDeviceId.toString(),
          deviceName: event.deviceName,
          errorMessage: event.errorMessage,
          wasOnline: event.wasOnline,
          attemptNumber: event.attemptNumber,
          status: device.status
        }
      );
    } catch (error) {
      this.logger.error(
        '[UpdateNetworkDevicePollingStateHandler] Unexpected error handling polling failure',
        {
          error:
            error instanceof Error ? error.message : String(error),
          deviceId: event.networkDeviceId.toString()
        }
      );
    }
  }
}
