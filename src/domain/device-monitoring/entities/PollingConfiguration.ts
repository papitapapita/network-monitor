import { Entity, Result, Guard } from 'domain/shared/core';
import { DeviceId, PollingConfigurationId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { PollingInterval, FailureThreshold } from '../value-objects';
import { PollingConfigurationProps } from '../props';

/**
 * PollingConfiguration Entity
 *
 * Owns all invariants for how a device should be polled:
 * interval, failure threshold, and enabled state.
 *
 * Belongs to the device-monitoring bounded context.
 * Created/updated in response to DeviceCreatedEvent and
 * DeviceMonitoringToggledEvent from device-inventory.
 */
export class PollingConfiguration extends Entity<
  PollingConfigurationProps,
  PollingConfigurationId
> {
  private constructor(
    props: PollingConfigurationProps,
    id: PollingConfigurationId
  ) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }

  get ipAddress(): IPAddress | null {
    return this.props.ipAddress;
  }

  get interval(): PollingInterval {
    return this.props.interval;
  }

  get failuresBeforeDown(): FailureThreshold {
    return this.props.failuresBeforeDown;
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  public static create(
    props: PollingConfigurationProps,
    id: PollingConfigurationId
  ): Result<PollingConfiguration> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.deviceId, 'deviceId'),
      Guard.againstNullOrUndefined(props.interval, 'interval'),
      Guard.againstNullOrUndefined(
        props.failuresBeforeDown,
        'failuresBeforeDown'
      )
    ]);

    if (!guardResult.succeeded) {
      return Result.fail<PollingConfiguration>(guardResult.message!);
    }

    return Result.ok<PollingConfiguration>(
      new PollingConfiguration(props, id)
    );
  }

  /**
   * Reconstitutes a PollingConfiguration from a trusted persistence source.
   * Bypasses validation — use only in repository implementations.
   */
  public static reconstitute(
    props: PollingConfigurationProps,
    id: PollingConfigurationId
  ): PollingConfiguration {
    return new PollingConfiguration(props, id);
  }

  // ============================================================================
  // Command Methods
  // ============================================================================

  /**
   * Updates the polling interval.
   * The interval value object already enforces the 1–86400s range.
   */
  public updateInterval(interval: PollingInterval): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      interval,
      'interval'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    this.props.interval = interval;
    return Result.ok<void>();
  }

  /**
   * Updates the consecutive-failure threshold.
   * The value object enforces that it must be a positive integer.
   */
  public updateFailureThreshold(
    threshold: FailureThreshold
  ): Result<void> {
    const guardResult = Guard.againstNullOrUndefined(
      threshold,
      'failuresBeforeDown'
    );
    if (!guardResult.succeeded) {
      return Result.fail<void>(guardResult.message!);
    }

    this.props.failuresBeforeDown = threshold;
    return Result.ok<void>();
  }

  /**
   * Updates the IP address used for pinging.
   * Null means the device has no IP yet — polling will be skipped.
   */
  public updateIpAddress(ipAddress: IPAddress | null): void {
    this.props.ipAddress = ipAddress;
  }

  /**
   * Enables polling. No-op if already enabled.
   */
  public enable(): Result<void> {
    this.props.enabled = true;
    return Result.ok<void>();
  }

  /**
   * Disables polling. No-op if already disabled.
   */
  public disable(): Result<void> {
    this.props.enabled = false;
    return Result.ok<void>();
  }
}
