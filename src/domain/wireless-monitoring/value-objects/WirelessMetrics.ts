import { ValueObject, Result, Guard } from 'domain/shared/core';
import { MACAddress } from 'domain/shared/value-objects';
import { WirelessMetricsProps } from '../props';

export class WirelessMetrics extends ValueObject<WirelessMetricsProps> {
  private constructor(props: WirelessMetricsProps) {
    super(props);
  }

  get signalRxDbm(): number | null {
    return this._props.signalRxDbm;
  }
  get signalTxDbm(): number | null {
    return this._props.signalTxDbm;
  }
  get noiseFloorDbm(): number | null {
    return this._props.noiseFloorDbm;
  }
  get snrDb(): number | null {
    return this._props.snrDb;
  }
  get ccqPercent(): number | null {
    return this._props.ccqPercent;
  }
  get txRateMbps(): number | null {
    return this._props.txRateMbps;
  }
  get rxRateMbps(): number | null {
    return this._props.rxRateMbps;
  }
  get frequencyMhz(): number | null {
    return this._props.frequencyMhz;
  }
  get channelWidthMhz(): number | null {
    return this._props.channelWidthMhz;
  }
  get txPowerDbm(): number | null {
    return this._props.txPowerDbm;
  }
  get throughputTxBps(): number | null {
    return this._props.throughputTxBps;
  }
  get throughputRxBps(): number | null {
    return this._props.throughputRxBps;
  }
  get lanStatus(): 'UP' | 'DOWN' | null {
    return this._props.lanStatus;
  }
  get lanSpeedMbps(): number | null {
    return this._props.lanSpeedMbps;
  }
  get lanDuplex(): 'FULL' | 'HALF' | null {
    return this._props.lanDuplex;
  }
  get uptimeSeconds(): number | null {
    return this._props.uptimeSeconds;
  }
  get cpuLoadPercent(): number | null {
    return this._props.cpuLoadPercent;
  }
  get memoryUsedPercent(): number | null {
    return this._props.memoryUsedPercent;
  }
  get clientsConnected(): number | null {
    return this._props.clientsConnected;
  }
  get clientsProvisioned(): number | null {
    return this._props.clientsProvisioned;
  }
  get throughputTxPps(): number | null {
    return this._props.throughputTxPps;
  }
  get throughputRxPps(): number | null {
    return this._props.throughputRxPps;
  }
  get firmwareVersion(): string | null {
    return this._props.firmwareVersion;
  }
  get deviceName(): string | null {
    return this._props.deviceName;
  }
  get remoteApMac(): string | null {
    return this._props.remoteApMac;
  }
  get remoteApName(): string | null {
    return this._props.remoteApName;
  }
  get distanceM(): number | null {
    return this._props.distanceM;
  }
  get latencyMs(): number | null {
    return this._props.latencyMs;
  }

  public isSignalDegraded(): boolean {
    return (
      this._props.signalRxDbm !== null &&
      this._props.signalRxDbm < -70
    );
  }

  /**
   * Returns the signal-to-noise ratio in dB.
   * Priority: stored snrDb → computed from signalRxDbm − noiseFloorDbm → null.
   */
  public getSnr(): number | null {
    if (this._props.snrDb !== null) {
      return this._props.snrDb;
    }
    if (
      this._props.signalRxDbm !== null &&
      this._props.noiseFloorDbm !== null
    ) {
      return this._props.signalRxDbm - this._props.noiseFloorDbm;
    }
    return null;
  }

  public getLinkUtilizationPercent(
    capacityBps: number
  ): number | null {
    if (capacityBps <= 0) {
      return null;
    }
    if (
      this._props.throughputTxBps !== null &&
      this._props.throughputRxBps !== null
    ) {
      return (
        ((this._props.throughputTxBps + this._props.throughputRxBps) /
          capacityBps) *
        100
      );
    }
    return null;
  }

  public static create(
    props: WirelessMetricsProps
  ): Result<WirelessMetrics> {
    const nullCheck = Guard.againstNullOrUndefined(
      props,
      'WirelessMetrics props'
    );
    if (!nullCheck.succeeded) {
      return Result.fail<WirelessMetrics>(nullCheck.message!);
    }

    if (props.ccqPercent !== null) {
      const guard = Guard.inRange(
        props.ccqPercent,
        0,
        100,
        'ccqPercent'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.cpuLoadPercent !== null) {
      const guard = Guard.inRange(
        props.cpuLoadPercent,
        0,
        100,
        'cpuLoadPercent'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.memoryUsedPercent !== null) {
      const guard = Guard.inRange(
        props.memoryUsedPercent,
        0,
        100,
        'memoryUsedPercent'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.signalRxDbm !== null) {
      const guard = Guard.isNumber(props.signalRxDbm, 'signalRxDbm');
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.signalTxDbm !== null) {
      const guard = Guard.isNumber(props.signalTxDbm, 'signalTxDbm');
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.noiseFloorDbm !== null) {
      const guard = Guard.isNumber(
        props.noiseFloorDbm,
        'noiseFloorDbm'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.txPowerDbm !== null) {
      const guard = Guard.isNumber(props.txPowerDbm, 'txPowerDbm');
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.frequencyMhz !== null) {
      const guard = Guard.greaterThan(
        0,
        props.frequencyMhz,
        'frequencyMhz'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.channelWidthMhz !== null) {
      const guard = Guard.greaterThan(
        0,
        props.channelWidthMhz,
        'channelWidthMhz'
      );
      if (!guard.succeeded)
        return Result.fail<WirelessMetrics>(guard.message!);
    }

    if (props.lanStatus !== null) {
      if (props.lanStatus !== 'UP' && props.lanStatus !== 'DOWN') {
        return Result.fail<WirelessMetrics>(
          `lanStatus must be 'UP' or 'DOWN', got: ${props.lanStatus}`
        );
      }
    }

    if (props.lanDuplex !== null) {
      if (props.lanDuplex !== 'FULL' && props.lanDuplex !== 'HALF') {
        return Result.fail<WirelessMetrics>(
          `lanDuplex must be 'FULL' or 'HALF', got: ${props.lanDuplex}`
        );
      }
    }

    let normalizedRemoteApMac: string | null = props.remoteApMac;
    if (props.remoteApMac !== null) {
      const macResult = MACAddress.create(props.remoteApMac);
      if (macResult.isFailure) {
        return Result.fail<WirelessMetrics>(macResult.error!);
      }
      normalizedRemoteApMac = macResult.value.value;
    }

    return Result.ok<WirelessMetrics>(
      new WirelessMetrics({ ...props, remoteApMac: normalizedRemoteApMac })
    );
  }

  public static reconstitute(
    props: WirelessMetricsProps
  ): WirelessMetrics {
    return new WirelessMetrics(props);
  }

  public toString(): string {
    return `signal=${this._props.signalRxDbm ?? 'n/a'}dBm ccq=${this._props.ccqPercent ?? 'n/a'}%`;
  }
}
