import { AggregateRoot, Result, Guard } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IPAddress } from 'domain/shared/value-objects';
import { PollingInterval } from '../value-objects';
import { WirelessDeviceConfigProps } from '../props';
import { WirelessDeviceConfigId } from 'domain/shared/ids';
import { WirelessDeviceConfigToggledEvent } from '../events';

// Standard Ethernet negotiated speeds; AirOS/UISP LAN ports report one of these.
const ALLOWED_LAN_SPEEDS_MBPS = [10, 100, 1000, 2500, 10000];

export type LinkCapacitySource = 'CONTRACT' | 'MANUAL';

export interface ResolvedLinkCapacity {
  kbps: number;
  source: LinkCapacitySource;
}

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
  get parentApMismatchPolls(): number {
    return this.props.parentApMismatchPolls;
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
    if (
      props.provisionedLanSpeedMbps !== null &&
      !ALLOWED_LAN_SPEEDS_MBPS.includes(props.provisionedLanSpeedMbps)
    ) {
      return Result.fail(
        `provisionedLanSpeedMbps must be one of ${ALLOWED_LAN_SPEEDS_MBPS.join(', ')}`
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

  // The contracted plan wins over the manual value: it is what the customer
  // is sold, and it follows plan changes without anyone editing this config.
  // The manual value remains for links with no contract, such as backhauls.
  public resolveLinkCapacity(
    contractedKbps: number | null
  ): ResolvedLinkCapacity | null {
    if (this.props.deviceType !== 'STATION') return null;
    if (contractedKbps !== null) {
      return { kbps: contractedKbps, source: 'CONTRACT' };
    }
    if (this.props.linkCapacityKbps !== null) {
      return { kbps: this.props.linkCapacityKbps, source: 'MANUAL' };
    }
    return null;
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
    if (
      !sameDeviceId(this.props.parentApDeviceId, parentApDeviceId)
    ) {
      this.props.parentApMismatchPolls = 0;
    }
    this.props.parentApDeviceId = parentApDeviceId;
    return Result.ok();
  }

  public updateProvisionedLanSpeedMbps(
    speedMbps: number | null
  ): Result<void> {
    if (
      speedMbps !== null &&
      !ALLOWED_LAN_SPEEDS_MBPS.includes(speedMbps)
    ) {
      return Result.fail(
        `provisionedLanSpeedMbps must be one of ${ALLOWED_LAN_SPEEDS_MBPS.join(', ')}`
      );
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

  // Fills an undeclared parent AP from the one the radio reports. Never
  // overwrites a declaration: a mismatch is drift for the operator to
  // resolve, not something a poll decides.
  public declareParentApIfUnset(reportedApDeviceId: DeviceId): void {
    if (
      this.props.deviceType === 'STATION' &&
      this.props.parentApDeviceId === null &&
      !reportedApDeviceId.equals(this.props.deviceId)
    ) {
      this.props.parentApDeviceId = reportedApDeviceId;
      this.props.parentApMismatchPolls = 0;
    }
  }

  // A poll whose radio reported no AP, or one not in inventory, is no
  // evidence either way and leaves the streak where it was.
  public recordReportedParentAp(
    reportedApDeviceId: DeviceId | null
  ): void {
    if (reportedApDeviceId === null) return;
    const declared = this.props.parentApDeviceId;
    const mismatched =
      this.props.deviceType === 'STATION' &&
      declared !== null &&
      !reportedApDeviceId.equals(declared) &&
      !reportedApDeviceId.equals(this.props.deviceId);
    this.props.parentApMismatchPolls = mismatched
      ? this.props.parentApMismatchPolls + 1
      : 0;
  }
}

function sameDeviceId(
  a: DeviceId | null,
  b: DeviceId | null
): boolean {
  return a === null || b === null ? a === b : a.equals(b);
}
