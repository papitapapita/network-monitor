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
  get lastPolledAt(): Date | null {
    return this.props.lastPolledAt;
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

  public updateLinkCapacityBps(
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
}
