import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  IPAddress,
  PollingInterval
} from 'domain/shared/value-objects';
import { WirelessDeviceConfigProps } from '../props';
import { WirelessDeviceConfigId } from 'domain/shared/ids';
import { WirelessDeviceConfigToggledEvent } from '../events';

const MIN_POLLING_SECONDS = 30;

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
  get targetFirmwareVersion(): string | null {
    return this.props.targetFirmwareVersion;
  }
  get maxLinkDistanceM(): number | null {
    return this.props.maxLinkDistanceM;
  }

  public static create(
    props: WirelessDeviceConfigProps
  ): Result<WirelessDeviceConfig> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.deviceId, 'deviceId'),
      Guard.againstNullOrUndefined(props.deviceType, 'deviceType'),
      Guard.againstNullOrUndefined(props.pollingInterval, 'pollingInterval')
    ]);
    if (!guardResult.succeeded) {
      return Result.fail(guardResult.message!);
    }
    if (props.pollingInterval.seconds < MIN_POLLING_SECONDS) {
      return Result.fail(
        `Wireless polling interval must be at least ${MIN_POLLING_SECONDS} seconds`
      );
    }
    if (props.maxLinkDistanceM !== null && props.maxLinkDistanceM < 0) {
      return Result.fail('maxLinkDistanceM must be a positive number');
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

  public updatePollingInterval(
    interval: PollingInterval
  ): Result<void> {
    if (interval.seconds < MIN_POLLING_SECONDS) {
      return Result.fail(
        `Wireless polling interval must be at least ${MIN_POLLING_SECONDS} seconds`
      );
    }
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

  public updateTargetFirmwareVersion(
    version: string | null
  ): Result<void> {
    this.props.targetFirmwareVersion = version;
    return Result.ok();
  }

  public updateMaxLinkDistanceM(
    distance: number | null
  ): Result<void> {
    if (distance !== null && distance < 0) {
      return Result.fail('maxLinkDistanceM must be a positive number');
    }
    this.props.maxLinkDistanceM = distance;
    return Result.ok();
  }
}
