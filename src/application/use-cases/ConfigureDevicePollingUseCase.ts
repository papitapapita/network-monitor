import { UseCase } from '../core/UseCase';
import { Result } from '../../domain/shared/kernel/Result';
import { ILogger } from '../interfaces/ILogger';
import { INetworkDeviceRepository } from '../../domain/repository';
import { NetworkDeviceId } from '../../domain/entities/NetworkDeviceId';
import { PollingInterval } from '../../domain/value-objects';

/**
 * ConfigureDevicePollingCommand
 *
 * Command to configure polling settings for a network device.
 */
export interface ConfigureDevicePollingCommand {
  /**
   * ID of the network device to configure.
   */
  networkDeviceId: string;

  /**
   * Polling interval in seconds (1-86400).
   */
  intervalSeconds: number;

  /**
   * Whether polling should be enabled.
   */
  enabled: boolean;

  /**
   * Number of ICMP pings per poll (1-10).
   * Optional - if not provided, existing setting is kept.
   */
  pingCount?: number;
}

/**
 * ConfigureDevicePollingUseCase
 *
 * Use case for configuring polling settings for a network device.
 * This includes:
 * - Setting polling interval
 * - Enabling/disabling polling
 * - Configuring ping count for multi-ping statistics
 *
 * Emits domain events:
 * - PollingIntervalChangedEvent (if interval changes)
 * - PingCountChangedEvent (if ping count changes)
 * - PollingConfigurationChangedEvent (for other changes)
 */
export class ConfigureDevicePollingUseCase extends UseCase<
  ConfigureDevicePollingCommand,
  void
> {
  constructor(
    private readonly networkDeviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'ConfigureDevicePollingUseCase');
  }

  /**
   * Validates the command before execution.
   */
  protected async beforeExecute(
    command: ConfigureDevicePollingCommand
  ): Promise<Result<void> | null> {
    // Validate device ID
    if (!command.networkDeviceId || command.networkDeviceId.trim() === '') {
      return Result.fail<void>('Network device ID is required');
    }

    // Validate interval
    if (
      command.intervalSeconds < 1 ||
      command.intervalSeconds > 86400
    ) {
      return Result.fail<void>(
        'Interval must be between 1 and 86400 seconds (24 hours)'
      );
    }

    // Validate ping count if provided
    if (command.pingCount !== undefined) {
      if (command.pingCount < 1 || command.pingCount > 10) {
        return Result.fail<void>('Ping count must be between 1 and 10');
      }
    }

    return null; // Validation passed
  }

  /**
   * Main use case execution logic.
   */
  protected async executeImpl(
    command: ConfigureDevicePollingCommand
  ): Promise<Result<void>> {
    // 1. Load NetworkDevice aggregate
    const deviceId = new NetworkDeviceId(command.networkDeviceId);
    const deviceOrError = await this.networkDeviceRepository.findById(deviceId);

    if (deviceOrError.isFailure) {
      return this.fail(`Failed to load device: ${deviceOrError.error}`);
    }

    const device = deviceOrError.getValue();
    if (!device) {
      return this.fail(
        `Device with ID ${command.networkDeviceId} not found`
      );
    }

    // 2. Create PollingInterval value object
    const intervalOrError = PollingInterval.create(command.intervalSeconds);
    if (intervalOrError.isFailure) {
      return this.fail(`Invalid interval: ${intervalOrError.error}`);
    }

    const interval = intervalOrError.getValue();

    // 3. Update polling configuration
    // Use NetworkDevice aggregate methods to ensure events are emitted properly

    // Update interval
    const updateIntervalResult = device.configurePolling(interval);
    if (updateIntervalResult.isFailure) {
      return this.fail(
        `Failed to update interval: ${updateIntervalResult.error}`
      );
    }

    // Update ping count if provided
    if (command.pingCount !== undefined) {
      const updatePingCountResult = device.updatePingCount(
        command.pingCount
      );
      if (updatePingCountResult.isFailure) {
        return this.fail(
          `Failed to update ping count: ${updatePingCountResult.error}`
        );
      }
    }

    // Enable or disable polling
    if (command.enabled) {
      const enableResult = device.enablePolling();
      if (enableResult.isFailure) {
        return this.fail(`Failed to enable polling: ${enableResult.error}`);
      }
    } else {
      const disableResult = device.disablePolling();
      if (disableResult.isFailure) {
        return this.fail(`Failed to disable polling: ${disableResult.error}`);
      }
    }

    // 4. Persist aggregate
    const saveResult = await this.networkDeviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(`Failed to save device: ${saveResult.error}`);
    }

    this.logger.info('Device polling configuration updated successfully', {
      deviceId: command.networkDeviceId,
      intervalSeconds: command.intervalSeconds,
      enabled: command.enabled,
      pingCount: command.pingCount
    });

    return this.ok(undefined);
  }

  /**
   * Post-execution hook.
   * Domain events are automatically dispatched by the repository.
   */
  protected async afterExecute(
    command: ConfigureDevicePollingCommand,
    response: void
  ): Promise<Result<void> | null> {
    // Events (PollingIntervalChanged, PingCountChanged, PollingConfigurationChanged)
    // are emitted by the PollingConfiguration entity and will be dispatched
    // by the repository after persistence.
    return null;
  }
}
