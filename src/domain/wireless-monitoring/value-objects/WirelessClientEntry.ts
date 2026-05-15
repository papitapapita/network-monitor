import { ValueObject, Result, Guard } from 'domain/shared/core';
import {
  isValidMacAddress,
  normalizeMacAddress
} from 'domain/shared/utils/macAddress';
import { WirelessClientEntryProps } from '../props/WirelessClientEntryProps';

export class WirelessClientEntry extends ValueObject<WirelessClientEntryProps> {
  private constructor(props: WirelessClientEntryProps) {
    super(props);
  }

  get macAddress(): string {
    return this._props.macAddress;
  }
  get signalRxDbm(): number | null {
    return this._props.signalRxDbm;
  }
  get signalTxDbm(): number | null {
    return this._props.signalTxDbm;
  }
  get snrDb(): number | null {
    return this._props.snrDb;
  }
  get txRateMbps(): number | null {
    return this._props.txRateMbps;
  }
  get rxRateMbps(): number | null {
    return this._props.rxRateMbps;
  }
  get throughputTxBps(): number | null {
    return this._props.throughputTxBps;
  }
  get throughputRxBps(): number | null {
    return this._props.throughputRxBps;
  }
  get ccqPercent(): number | null {
    return this._props.ccqPercent;
  }
  get uptimeSeconds(): number | null {
    return this._props.uptimeSeconds;
  }
  get ipAddress(): string | null {
    return this._props.ipAddress;
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

    const macGuards = Guard.combine([
      Guard.againstNullOrUndefined(props.macAddress, 'macAddress'),
      Guard.isString(props.macAddress, 'macAddress')
    ]);
    if (!macGuards.succeeded) {
      return Result.fail<WirelessClientEntry>(macGuards.message!);
    }

    if (!isValidMacAddress(props.macAddress)) {
      return Result.fail<WirelessClientEntry>(
        `macAddress has invalid MAC address format: ${props.macAddress}. Must be AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF.`
      );
    }

    if (props.ccqPercent !== null) {
      const guard = Guard.inRange(
        props.ccqPercent,
        0,
        100,
        'ccqPercent'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    if (props.signalRxDbm !== null) {
      const guard = Guard.isNumber(props.signalRxDbm, 'signalRxDbm');
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    if (props.signalTxDbm !== null) {
      const guard = Guard.isNumber(props.signalTxDbm, 'signalTxDbm');
      if (!guard.succeeded)
        return Result.fail<WirelessClientEntry>(guard.message!);
    }

    if (props.snrDb !== null) {
      const guard = Guard.isNumber(props.snrDb, 'snrDb');
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

    const normalizedMac = normalizeMacAddress(props.macAddress);

    return Result.ok<WirelessClientEntry>(
      new WirelessClientEntry({ ...props, macAddress: normalizedMac })
    );
  }

  public static reconstitute(
    props: WirelessClientEntryProps
  ): WirelessClientEntry {
    return new WirelessClientEntry(props);
  }
}
