import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { WirelessPollingConfigProps } from '../props/WirelessPollingConfigProps';
import { WirelessPollingConfigId } from 'domain/shared/ids';
import { WirelessPollingConfigToggledEvent } from '../events/WirelessPollingConfigToggled';

export class WirelessPollingConfig extends AggregateRoot<
  WirelessPollingConfigProps,
  WirelessPollingConfigId
> {
  private constructor(
    props: WirelessPollingConfigProps,
    id: WirelessPollingConfigId
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
  get intervalSecs(): number {
    return this.props.intervalSecs;
  }
  get deviceType(): 'CPE' | 'ACCESS_POINT' {
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
    props: WirelessPollingConfigProps,
    id?: WirelessPollingConfigId
  ): Result<WirelessPollingConfig> {
    const guardResult = Guard.combine([
      Guard.againstNullOrUndefined(props.deviceId, 'deviceId'),
      Guard.againstNullOrUndefined(props.deviceType, 'deviceType'),
    ]);
    if (!guardResult.succeeded) {
      return Result.fail(guardResult.message!);
    }
    if (props.intervalSecs <= 0) {
      return Result.fail('intervalSecs must be greater than 0');
    }
    const configId = id ?? WirelessPollingConfigId.create();
    return Result.ok(new WirelessPollingConfig(props, configId));
  }

  /**
   * Reconstitutes a WirelessPollingConfig from a trusted persistence source,
   * bypassing validation. Use only in repository mappers when loading data
   * that was already validated at creation time.
   *
   * @param id - The persisted WirelessPollingConfigId
   * @param props - Full config properties from persistence
   * @returns WirelessPollingConfig instance
   */
  public static reconstitute(
    id: WirelessPollingConfigId,
    props: WirelessPollingConfigProps
  ): WirelessPollingConfig {
    return new WirelessPollingConfig(props, id);
  }

  public isDue(now: Date): boolean {
    if (!this.props.enabled) return false;
    if (this.props.lastPolledAt === null) return true;
    return (
      this.props.lastPolledAt.getTime() + this.props.intervalSecs * 1000 <=
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
      new WirelessPollingConfigToggledEvent({
        aggregateId: this.id,
        deviceId: this.props.deviceId,
        enabled: true,
        dateTimeOccurred: new Date(),
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
      new WirelessPollingConfigToggledEvent({
        aggregateId: this.id,
        deviceId: this.props.deviceId,
        enabled: false,
        dateTimeOccurred: new Date(),
      })
    );
    return Result.ok();
  }

  public updateIpAddress(ip: IPAddress | null): Result<void> {
    this.props.ipAddress = ip;
    return Result.ok();
  }
}
