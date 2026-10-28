import { ValueObject, Result } from 'domain/shared/core';
import { RouterHealthThresholdsProps } from '../props/RouterHealthThresholdsProps';

const DEFAULTS: RouterHealthThresholdsProps = {
  cpuPercent: 90,
  minFreeMemoryPercent: 10,
  minFreeDiskPercent: 5,
  maxTemperatureC: 75,
  minVoltage: null,
  flapLinkDowns: 3,
  // the receive sensitivity of a common 1000BASE-LX module
  minSfpRxPowerDbm: -20
};

function wholeInRange(
  name: string,
  value: unknown,
  min: number,
  max: number
): string | null {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    return `${name} must be a whole number from ${min} to ${max}`;
  }
  return null;
}

// MON-172: one set for the whole install.
export class RouterHealthThresholds extends ValueObject<RouterHealthThresholdsProps> {
  private constructor(props: RouterHealthThresholdsProps) {
    super(props);
  }

  get values(): RouterHealthThresholdsProps {
    return { ...this._props };
  }
  get cpuPercent(): number {
    return this._props.cpuPercent;
  }
  get minFreeMemoryPercent(): number {
    return this._props.minFreeMemoryPercent;
  }
  get minFreeDiskPercent(): number {
    return this._props.minFreeDiskPercent;
  }
  get maxTemperatureC(): number {
    return this._props.maxTemperatureC;
  }
  get minVoltage(): number | null {
    return this._props.minVoltage;
  }
  get flapLinkDowns(): number {
    return this._props.flapLinkDowns;
  }
  get minSfpRxPowerDbm(): number | null {
    return this._props.minSfpRxPowerDbm;
  }

  public static defaults(): RouterHealthThresholds {
    return new RouterHealthThresholds({ ...DEFAULTS });
  }

  public static create(
    props: RouterHealthThresholdsProps
  ): Result<RouterHealthThresholds> {
    const error =
      wholeInRange('cpuPercent', props.cpuPercent, 50, 99) ??
      wholeInRange(
        'minFreeMemoryPercent',
        props.minFreeMemoryPercent,
        1,
        50
      ) ??
      wholeInRange(
        'minFreeDiskPercent',
        props.minFreeDiskPercent,
        1,
        50
      ) ??
      wholeInRange(
        'maxTemperatureC',
        props.maxTemperatureC,
        40,
        110
      ) ??
      RouterHealthThresholds.voltageError(props.minVoltage) ??
      wholeInRange('flapLinkDowns', props.flapLinkDowns, 1, 100) ??
      RouterHealthThresholds.sfpPowerError(props.minSfpRxPowerDbm);
    if (error) return Result.fail(error);
    return Result.ok(new RouterHealthThresholds({ ...props }));
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    props: RouterHealthThresholdsProps
  ): RouterHealthThresholds {
    return new RouterHealthThresholds({ ...props });
  }

  private static voltageError(value: unknown): string | null {
    if (value === null) return null;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 5 ||
      value > 60
    ) {
      return 'minVoltage must be null or a number from 5 to 60';
    }
    return null;
  }

  private static sfpPowerError(value: unknown): string | null {
    if (value === null) return null;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < -40 ||
      value > 0
    ) {
      return 'minSfpRxPowerDbm must be null or a number from -40 to 0';
    }
    return null;
  }
}
