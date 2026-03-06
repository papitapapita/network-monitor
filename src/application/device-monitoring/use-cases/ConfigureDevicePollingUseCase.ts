import {
  Result,
  NetworkDeviceId,
  PollingInterval,
  INetworkDeviceRepository
} from '../../../domain/device-inventory';
import { UseCase, ILogger, ConfigureDevicePollingDTO } from '../..';

/**
 * ConfigureDevicePollingUseCase
 *
 * Business Intent: Configure polling settings for a network device
 *
 * Flow:
 * 1. beforeExecute: Validate polling configuration parameters
 * 2. executeImpl: Orchestrate polling configuration update
 * 3. afterExecute: Domain events dispatched automatically by repository
 *
 * Business Rules:
 * - Device must exist and not be soft-deleted
 * - Polling interval must be between 1 second and 24 hours (86400 seconds)
 * - Ping count must be between 1 and 10 pings per poll
 * - Enabling/disabling polling does not change interval configuration
 * - Changing interval emits PollingIntervalChangedEvent
 * - Changing ping count emits PingCountChangedEvent
 * - Enabling/disabling emits PollingConfigurationChangedEvent
 * - Configuration changes are immediate (next poll uses new settings)
 *
 * Recommended Intervals by Device Type:
 * - ACCESS_POINT: 30 seconds (frequent monitoring)
 * - STATION: 300 seconds (5 minutes, less critical)
 * - ROUTER/SWITCH/FIREWALL: 60 seconds (standard monitoring)
 * - Others: 60 seconds (default)
 *
 * Requirements:
 * - Polling configuration must be persistent
 * - Changes must emit appropriate domain events
 * - System must support concurrent configuration updates
 *
 * Dependencies:
 * - INetworkDeviceRepository: Load and persist device aggregate
 * - ILogger: Log configuration changes
 *
 * Domain Events:
 * - PollingIntervalChangedEvent: Emitted when interval changes
 * - PingCountChangedEvent: Emitted when ping count changes
 * - PollingConfigurationChangedEvent: Emitted for enable/disable
 *
 * @example Enable polling with 60-second interval
 * ```typescript
 * const useCase = new ConfigureDevicePollingUseCase(repository, logger);
 * const result = await useCase.execute({
 *   networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
 *   intervalSeconds: 60,
 *   enabled: true,
 *   pingCount: 3
 * });
 * ```
 *
 * @example Disable polling without changing interval
 * ```typescript
 * const result = await useCase.execute({
 *   networkDeviceId: '550e8400-e29b-41d4-a716-446655440000',
 *   intervalSeconds: 60,
 *   enabled: false
 * });
 * ```
 */
export class ConfigureDevicePollingUseCase extends UseCase<
  ConfigureDevicePollingDTO,
  void
> {
  constructor(
    private readonly networkDeviceRepository: INetworkDeviceRepository,
    logger: ILogger
  ) {
    super(logger, 'ConfigureDevicePollingUseCase');
  }

  /**
   * Pre-execution validation.
   * Validates polling configuration parameters.
   */
  protected async beforeExecute(
    request: ConfigureDevicePollingDTO
  ): Promise<Result<void> | null> {
    if (
      !request.networkDeviceId ||
      request.networkDeviceId.trim() === ''
    ) {
      return Result.fail('Network device ID is required');
    }

    if (
      !Number.isInteger(request.intervalSeconds) ||
      request.intervalSeconds <= 0
    ) {
      return Result.fail('Interval must be a positive integer value');
    }

    if (request.pingCount !== undefined) {
      if (
        !Number.isInteger(request.pingCount) ||
        request.pingCount <= 0
      ) {
        return Result.fail(
          'Ping count must be a positive integer value'
        );
      }
    }

    if (typeof request.enabled !== 'boolean') {
      return Result.fail('Enabled must be a boolean value');
    }

    return null; // Validation passed
  }

  /**
   * Main execution: Orchestrate polling configuration update.
   *
   * Steps:
   * 1. Create device ID value object
   * 2. Load device aggregate from repository
   * 3. Create polling interval value object
   * 4. Update polling interval
   * 5. Update ping count if provided
   * 6. Enable or disable polling
   * 7. Persist updated aggregate
   */
  protected async executeImpl(
    request: ConfigureDevicePollingDTO
  ): Promise<Result<void>> {
    const deviceIdResult = NetworkDeviceId.create(
      request.networkDeviceId
    );
    if (deviceIdResult.isFailure) {
      return this.fail(`Invalid device ID: ${deviceIdResult.error}`);
    }

    const deviceId = deviceIdResult.value;

    const deviceResult =
      await this.networkDeviceRepository.findById(deviceId);

    if (deviceResult.isFailure) {
      return this.fail(
        `Failed to load device: ${deviceResult.error}`
      );
    }

    if (!deviceResult.value) {
      return this.fail(
        `Device with ID ${request.networkDeviceId} not found`
      );
    }

    const device = deviceResult.value;

    const intervalResult = PollingInterval.create(
      request.intervalSeconds
    );
    if (intervalResult.isFailure) {
      return this.fail(`Invalid interval: ${intervalResult.error}`);
    }

    const interval = intervalResult.value;

    const updateIntervalResult =
      device.configurePollingInterval(interval);
    if (updateIntervalResult.isFailure) {
      return this.fail(
        `Failed to update interval: ${updateIntervalResult.error}`
      );
    }

    if (request.pingCount !== undefined) {
      const updatePingCountResult = device.updatePingCount(
        request.pingCount
      );
      if (updatePingCountResult.isFailure) {
        return this.fail(
          `Failed to update ping count: ${updatePingCountResult.error}`
        );
      }
    }

    if (request.enabled) {
      const enableResult = device.enablePolling();
      if (enableResult.isFailure) {
        return this.fail(
          `Failed to enable polling: ${enableResult.error}`
        );
      }
    } else {
      const disableResult = device.disablePolling();
      if (disableResult.isFailure) {
        return this.fail(
          `Failed to disable polling: ${disableResult.error}`
        );
      }
    }

    const saveResult =
      await this.networkDeviceRepository.save(device);
    if (saveResult.isFailure) {
      return this.fail(`Failed to save device: ${saveResult.error}`);
    }

    // Repository dispatches domain events automatically

    // Log successful configuration
    this.logger.info(
      'Device polling configuration updated successfully',
      {
        deviceId: request.networkDeviceId,
        intervalSeconds: request.intervalSeconds,
        enabled: request.enabled,
        pingCount: request.pingCount
      }
    );

    return this.ok(undefined);
  }

  /**
   * Sanitize data for logging.
   * Remove sensitive information if needed.
   */
  protected sanitizeForLogging(data: any): any {
    if (!data) return data;

    // No sensitive data in polling configuration
    return data;
  }
}
