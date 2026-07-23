import { Entity, Result, Guard } from 'domain/shared/core';
import { DeviceId, PollingConfigurationId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { PollingInterval, FailureThreshold } from '../value-objects';
import { PollingConfigurationProps } from '../props';

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

  get lastPolledAt(): Date | null {
    return this.props.lastPolledAt ?? null;
  }

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

    const validationResult = PollingConfiguration.validate({
      ipAddress: props.ipAddress,
      enabled: props.enabled
    });

    if (validationResult.isFailure) {
      return Result.fail<PollingConfiguration>(
        validationResult.error
      );
    }

    return Result.ok<PollingConfiguration>(
      new PollingConfiguration(props, id)
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    id: PollingConfigurationId,
    props: PollingConfigurationProps
  ): PollingConfiguration {
    return new PollingConfiguration(props, id);
  }

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

  // null = no IP yet; only allowed while polling is disabled
  public updateIpAddress(ipAddress: IPAddress | null): Result<void> {
    const validationResult = PollingConfiguration.validate({
      ipAddress,
      enabled: this.props.enabled
    });

    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props.ipAddress = ipAddress;
    return Result.ok<void>();
  }

  public enable(): Result<void> {
    const validationResult = PollingConfiguration.validate({
      ipAddress: this.props.ipAddress,
      enabled: true
    });

    if (validationResult.isFailure) {
      return Result.fail<void>(validationResult.error);
    }

    this.props.enabled = true;
    return Result.ok<void>();
  }

  public disable(): Result<void> {
    this.props.enabled = false;
    return Result.ok<void>();
  }

  public markPolled(at: Date): void {
    this.props.lastPolledAt = at;
  }

  // Single source of truth for the enabled/IP invariant — every mutator
  // that can change either must route its prospective (not-yet-committed)
  // state through this method.
  private static validate(state: {
    ipAddress: IPAddress | null;
    enabled: boolean;
  }): Result<void> {
    if (state.enabled && !state.ipAddress) {
      return Result.fail<void>(
        'Polling cannot be enabled without an IP address'
      );
    }

    return Result.ok<void>();
  }
}
