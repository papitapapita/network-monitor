import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { PollingInterval } from '../value-objects';
import { WirelessDeviceConfigProps } from '../props';
import { WirelessDeviceConfigId } from 'domain/shared/ids';
import { WirelessDeviceConfigToggledEvent } from '../events';

export class WirelessDeviceConfig extends AggregateRoot<
  WirelessDeviceConfigProps,
  WirelessDeviceConfigId
> {
  private constructor(
    props: WirelessDeviceConfigProps,
    id: WirelessDeviceConfigId
  ) {
    super(props, id);
  }

  get deviceId(): DeviceId {
    return this.props.deviceId;
  }
  get ipAddress(): IPAddress | null {
    return this.props.ipAddress;
  }
  get enabled(): boolean {
    return this.props.enabled;
  }
  get pollingInterval(): PollingInterval {
    return this.props.pollingInterval;
  }
  get deviceType(): 'STATION' | 'ACCESS_POINT' {
    return this.props.deviceType;
  }
  get linkCapacityKbps(): number | null {
    return this.props.linkCapacityKbps;
  }
  get clientsProvisionedLimit(): number | null {
    return this.props.clientsProvisionedLimit;
  }
  get provisionedLanSpeedMbps(): number | null {
    return this.props.provisionedLanSpeedMbps;
  }
  get lastPolledAt(): Date | null {
    return this.props.lastPolledAt;
  }
  get parentApDeviceId(): DeviceId | null {
    return this.props.parentApDeviceId;
  }

  public static create(
    props: WirelessDeviceConfigProps
  ): Result<WirelessDeviceConfig> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.deviceId, 'deviceId'),
      Guard.againstNullOrUndefined(props.deviceType, 'deviceType'),
      Guard.againstNullOrUndefined(
        props.pollingInterval,
        'pollingInterval'
      )
    ]);
    if (!guardResult.succeeded) {
      return Result.fail(guardResult.message!);
    }
    if (
      props.linkCapacityKbps !== null &&
      props.deviceType !== 'STATION'
    ) {
      return Result.fail(
        'linkCapacityKbps can only be set for STATION devices'
      );
    }
    if (
      props.clientsProvisionedLimit !== null &&
      props.deviceType !== 'ACCESS_POINT'
    ) {
      return Result.fail(
        'clientsProvisionedLimit can only be set for ACCESS_POINT devices'
      );
    }
    if (
      props.parentApDeviceId !== null &&
      props.deviceType !== 'STATION'
    ) {
      return Result.fail(
        'parentApDeviceId can only be set for STATION devices'
      );
    }
    if (
      props.parentApDeviceId !== null &&
      props.parentApDeviceId.equals(props.deviceId)
    ) {
      return Result.fail('parentApDeviceId cannot reference itself');
    }
    return Result.ok(
      new WirelessDeviceConfig(props, WirelessDeviceConfigId.create())
    );
  }

  public static reconstitute(
    id: WirelessDeviceConfigId,
    props: WirelessDeviceConfigProps
  ): WirelessDeviceConfig {
    return new WirelessDeviceConfig(props, id);
  }

  public markPolled(at: Date): Result<void> {
    this.props.lastPolledAt = at;
    return Result.ok();
  }

  public enable(): Result<void> {
    if (this.props.enabled) {
      return Result.ok();
    }
    this.props.enabled = true;
    this.addDomainEvent(
      new WirelessDeviceConfigToggledEvent({
        aggregateId: this.id,
        deviceId: this.props.deviceId,
        enabled: true,
        dateTimeOccurred: new Date()
      })
    );
    return Result.ok();
  }

  public disable(): Result<void> {
    if (!this.props.enabled) {
      return Result.ok();
    }
    this.props.enabled = false;
    this.addDomainEvent(
      new WirelessDeviceConfigToggledEvent({
        aggregateId: this.id,
        deviceId: this.props.deviceId,
        enabled: false,
        dateTimeOccurred: new Date()
      })
    );
    return Result.ok();
  }

  public updateIpAddress(ip: IPAddress | null): Result<void> {
    this.props.ipAddress = ip;
    return Result.ok();
  }

  public updatePollingInterval(
    interval: PollingInterval
  ): Result<void> {
    this.props.pollingInterval = interval;
    return Result.ok();
  }

  public updateLinkCapacityKbps(
    linkCapacityKbps: number | null
  ): Result<void> {
    if (
      linkCapacityKbps !== null &&
      this.props.deviceType !== 'STATION'
    ) {
      return Result.fail(
        'linkCapacityKbps can only be set for STATION devices'
      );
    }
    this.props.linkCapacityKbps = linkCapacityKbps;
    return Result.ok();
  }

  public updateClientsProvisionedLimit(
    limit: number | null
  ): Result<void> {
    if (limit !== null && this.props.deviceType !== 'ACCESS_POINT') {
      return Result.fail(
        'clientsProvisionedLimit can only be set for ACCESS_POINT devices'
      );
    }
    this.props.clientsProvisionedLimit = limit;
    return Result.ok();
  }

  public updateParentApDeviceId(
    parentApDeviceId: DeviceId | null
  ): Result<void> {
    if (
      parentApDeviceId !== null &&
      this.props.deviceType !== 'STATION'
    ) {
      return Result.fail(
        'parentApDeviceId can only be set for STATION devices'
      );
    }
    if (
      parentApDeviceId !== null &&
      parentApDeviceId.equals(this.props.deviceId)
    ) {
      return Result.fail('parentApDeviceId cannot reference itself');
    }
    this.props.parentApDeviceId = parentApDeviceId;
    return Result.ok();
  }

  public updateProvisionedLanSpeedMbps(
    speedMbps: number | null
  ): Result<void> {
    if (speedMbps !== null && speedMbps <= 0) {
      return Result.fail('provisionedLanSpeedMbps must be positive');
    }
    this.props.provisionedLanSpeedMbps = speedMbps;
    return Result.ok();
  }

  // Called once per device, the first time a poll reports a LAN speed.
  // A no-op once a baseline exists, whether auto-captured or manually set.
  public captureLanSpeedBaselineIfUnset(observedMbps: number): void {
    if (
      this.props.provisionedLanSpeedMbps === null &&
      observedMbps > 0
    ) {
      this.props.provisionedLanSpeedMbps = observedMbps;
    }
  }
}
