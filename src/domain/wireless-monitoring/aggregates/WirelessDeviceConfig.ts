import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPAddress, PollingInterval } from 'domain/shared/value-objects';
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
  get linkCapacityBps(): number | null {
    return this.props.linkCapacityBps;
  }
  get clientsProvisionedLimit(): number | null {
    return this.props.clientsProvisionedLimit;
  }
  get lastPolledAt(): Date | null {
    return this.props.lastPolledAt;
  }

  public static create(
    props: WirelessDeviceConfigProps,
    id?: WirelessDeviceConfigId
  ): Result<WirelessDeviceConfig> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.deviceId, 'deviceId'),
      Guard.againstNullOrUndefined(props.deviceType, 'deviceType'),
      Guard.againstNullOrUndefined(props.pollingInterval, 'pollingInterval')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail(guardResult.message!);
    }
    const configId = id ?? WirelessDeviceConfigId.create();
    return Result.ok(new WirelessDeviceConfig(props, configId));
  }

  public static reconstitute(
    id: WirelessDeviceConfigId,
    props: WirelessDeviceConfigProps
  ): WirelessDeviceConfig {
    return new WirelessDeviceConfig(props, id);
  }

  public isDue(now: Date): boolean {
    if (!this.props.enabled) return false;
    if (this.props.lastPolledAt === null) return true;
    return (
      this.props.lastPolledAt.getTime() +
        this.props.pollingInterval.seconds * 1000 <=
      now.getTime()
    );
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

  public updatePollingInterval(interval: PollingInterval): Result<void> {
    this.props.pollingInterval = interval;
    return Result.ok();
  }

  public updateLinkCapacityBps(
    linkCapacityBps: number | null
  ): Result<void> {
    this.props.linkCapacityBps = linkCapacityBps;
    return Result.ok();
  }

  public updateClientsProvisionedLimit(
    limit: number | null
  ): Result<void> {
    this.props.clientsProvisionedLimit = limit;
    return Result.ok();
  }
}
