import { ValueObject, Result, Guard } from 'domain/shared/core';
import { MACAddress } from 'domain/shared/value-objects';
import { WirelessClientEntryProps } from '../props';

export class WirelessClientEntry extends ValueObject<WirelessClientEntryProps> {
  private constructor(props: WirelessClientEntryProps) {
    super(props);
  }

  get macAddress(): string {
    return this._props.macAddress;
  }
  get ipAddress(): string | null {
    return this._props.ipAddress;
  }
  get signalRxDbm(): number | null {
    return this._props.signalRxDbm;
  }
  get noiseFloorDbm(): number | null {
    return this._props.noiseFloorDbm;
  }
  get distanceM(): number | null {
    return this._props.distanceM;
  }
  get uptimeSeconds(): number | null {
    return this._props.uptimeSeconds;
  }
  get txLatencyMs(): number | null {
    return this._props.txLatencyMs;
  }
  get dlLinkScore(): number | null {
    return this._props.dlLinkScore;
  }
  get ulLinkScore(): number | null {
    return this._props.ulLinkScore;
  }
  get dlCapacityKbps(): number | null {
    return this._props.dlCapacityKbps;
  }
  get ulCapacityKbps(): number | null {
    return this._props.ulCapacityKbps;
  }
  get dlCinr(): number | null {
    return this._props.dlCinr;
  }
  get ulCinr(): number | null {
    return this._props.ulCinr;
  }
  get txBytesTotal(): bigint | null {
    return this._props.txBytesTotal;
  }
  get rxBytesTotal(): bigint | null {
    return this._props.rxBytesTotal;
  }
  get txPps(): number | null {
    return this._props.txPps;
  }
  get rxPps(): number | null {
    return this._props.rxPps;
  }
  get remoteHostname(): string | null {
    return this._props.remoteHostname;
  }
  get remotePlatform(): string | null {
    return this._props.remotePlatform;
  }
  get remoteVersion(): string | null {
    return this._props.remoteVersion;
  }
  get remoteCpuLoad(): number | null {
    return this._props.remoteCpuLoad;
  }
  get remoteTotalRam(): number | null {
    return this._props.remoteTotalRam;
  }
  get remoteFreeRam(): number | null {
    return this._props.remoteFreeRam;
  }
  get remoteSignal(): number | null {
    return this._props.remoteSignal;
  }
  get remoteNoiseFloor(): number | null {
    return this._props.remoteNoiseFloor;
  }
  get remoteTxPower(): number | null {
    return this._props.remoteTxPower;
  }
  get remoteTxThroughputKbps(): number | null {
    return this._props.remoteTxThroughputKbps;
  }
  get remoteRxThroughputKbps(): number | null {
    return this._props.remoteRxThroughputKbps;
  }
  get remoteIpAddresses(): string[] {
    return this._props.remoteIpAddresses;
  }
  get dlAirtimePercent(): number | null {
    return this._props.dlAirtimePercent;
  }
  get ulAirtimePercent(): number | null {
    return this._props.ulAirtimePercent;
  }

  public getSnr(): number | null {
    if (
      this._props.signalRxDbm !== null &&
      this._props.noiseFloorDbm !== null
    ) {
      return this._props.signalRxDbm - this._props.noiseFloorDbm;
    }
    return null;
  }

  public static create(
    props: WirelessClientEntryProps
  ): Result<WirelessClientEntry> {
    const nullCheck = Guard.againstNullOrUndefined(
      props,
      'WirelessClientEntry props'
    );
    if (!nullCheck.succeeded) {
      return Result.fail<WirelessClientEntry>(nullCheck.message!);
    }

    const macResult = MACAddress.create(props.macAddress);
    if (macResult.isFailure) {
      return Result.fail<WirelessClientEntry>(macResult.error!);
    }

    if (props.signalRxDbm !== null) {
      const guard = Guard.isNumber(props.signalRxDbm, 'signalRxDbm');
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    if (props.noiseFloorDbm !== null) {
      const guard = Guard.isNumber(props.noiseFloorDbm, 'noiseFloorDbm');
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    if (props.dlLinkScore !== null) {
      const guard = Guard.inRange(props.dlLinkScore, 0, 100, 'dlLinkScore');
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    if (props.ulLinkScore !== null) {
      const guard = Guard.inRange(props.ulLinkScore, 0, 100, 'ulLinkScore');
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    if (props.ipAddress !== null) {
      const ipGuards = Guard.combine([
        Guard.isString(props.ipAddress, 'ipAddress'),
        Guard.againstAtLeast(props.ipAddress.length, 1, 'ipAddress')
      ]);
      if (!ipGuards.succeeded)
        return Result.fail<WirelessClientEntry>(ipGuards.message!);
    }

    if (props.dlAirtimePercent !== null) {
      const guard = Guard.inRange(
        props.dlAirtimePercent,
        0,
        100,
        'dlAirtimePercent'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    if (props.ulAirtimePercent !== null) {
      const guard = Guard.inRange(
        props.ulAirtimePercent,
        0,
        100,
        'ulAirtimePercent'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    return Result.ok<WirelessClientEntry>(
      new WirelessClientEntry({
        ...props,
        macAddress: macResult.value.value
      })
    );
  }

  public override equals(
    vo?: ValueObject<WirelessClientEntryProps>
  ): boolean {
    if (vo == null) return false;
    if (!(vo instanceof WirelessClientEntry)) return false;
    const serialize = (p: WirelessClientEntryProps): string =>
      JSON.stringify({
        ...p,
        txBytesTotal: p.txBytesTotal?.toString() ?? null,
        rxBytesTotal: p.rxBytesTotal?.toString() ?? null
      });
    return serialize(this._props) === serialize(vo._props);
  }

  public static reconstitute(
    props: WirelessClientEntryProps
  ): WirelessClientEntry {
    return new WirelessClientEntry(props);
  }

  public toString(): string {
    return this._props.macAddress;
  }
}
