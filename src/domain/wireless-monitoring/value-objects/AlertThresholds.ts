import { ValueObject, Result } from 'domain/shared/core';
import {
  AlertThresholdsProps,
  AlertThresholdOverridesProps,
  ChannelWidthThresholds,
  SeverityThresholds
} from '../props';

// Widths AirOS and other airMax/AC radios can be set to.
export const ALLOWED_CHANNEL_WIDTHS_MHZ = [
  5, 10, 20, 30, 40, 50, 60, 80, 160
];

const DEFAULTS: AlertThresholdsProps = {
  signalDbm: { warning: -70, critical: -80 },
  snrDb: { warning: 15, critical: 10 },
  ccqPercent: { warning: 75, critical: 50 },
  latencyMs: { warning: 50, critical: 150 },
  cpuPercent: 80,
  memoryPercent: 85,
  clockDriftSeconds: 300,
  saturationPercent: 80,
  clientDropPercent: 50,
  minCapacityMbps: { 20: 50, 40: 100, 80: 200 },
  maxDistanceKm: { 20: 15, 40: 10, 80: 5 }
};

type GroupValidators = {
  [K in keyof AlertThresholdsProps]: (
    value: AlertThresholdsProps[K]
  ) => string | null;
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

// Ranges leave room for each rule's clear margin (WLS-081): a CCQ warning
// of 99 % would need 102 % to clear, so it could never close.
function pair(
  name: string,
  value: SeverityThresholds,
  min: number,
  max: number,
  warningAbove: boolean
): string | null {
  if (typeof value !== 'object' || value === null) {
    return `${name} must have a warning and a critical value`;
  }
  const error =
    wholeInRange(`${name}.warning`, value.warning, min, max) ??
    wholeInRange(`${name}.critical`, value.critical, min, max);
  if (error) return error;
  if (warningAbove && value.warning <= value.critical) {
    return `${name}.warning must be higher than ${name}.critical`;
  }
  if (!warningAbove && value.warning >= value.critical) {
    return `${name}.warning must be lower than ${name}.critical`;
  }
  return null;
}

function widthTable(
  name: string,
  value: ChannelWidthThresholds,
  min: number,
  max: number,
  wholeOnly: boolean
): string | null {
  if (typeof value !== 'object' || value === null) {
    return `${name} must map channel widths to values`;
  }
  for (const [width, limit] of Object.entries(value)) {
    if (!ALLOWED_CHANNEL_WIDTHS_MHZ.includes(Number(width))) {
      return `${name} channel width must be one of ${ALLOWED_CHANNEL_WIDTHS_MHZ.join(', ')} MHz`;
    }
    if (wholeOnly) {
      const error = wholeInRange(`${name}.${width}`, limit, min, max);
      if (error) return error;
    } else if (
      typeof limit !== 'number' ||
      !Number.isFinite(limit) ||
      limit < min ||
      limit > max
    ) {
      return `${name}.${width} must be from ${min} to ${max}`;
    }
  }
  return null;
}

const VALIDATORS: GroupValidators = {
  signalDbm: (v) => pair('signalDbm', v, -100, -40, true),
  snrDb: (v) => pair('snrDb', v, 1, 60, true),
  ccqPercent: (v) => pair('ccqPercent', v, 1, 95, true),
  latencyMs: (v) => pair('latencyMs', v, 1, 10_000, false),
  cpuPercent: (v) => wholeInRange('cpuPercent', v, 10, 99),
  memoryPercent: (v) => wholeInRange('memoryPercent', v, 10, 99),
  clockDriftSeconds: (v) =>
    wholeInRange('clockDriftSeconds', v, 10, 86_400),
  saturationPercent: (v) =>
    wholeInRange('saturationPercent', v, 10, 100),
  clientDropPercent: (v) =>
    wholeInRange('clientDropPercent', v, 10, 90),
  minCapacityMbps: (v) =>
    widthTable('minCapacityMbps', v, 1, 10_000, true),
  maxDistanceKm: (v) =>
    widthTable('maxDistanceKm', v, 0.1, 200, false)
};

export const ALERT_THRESHOLD_KEYS = Object.keys(
  VALIDATORS
) as (keyof AlertThresholdsProps)[];

export function validateAlertThresholdGroup<
  K extends keyof AlertThresholdsProps
>(key: K, value: AlertThresholdsProps[K]): string | null {
  return VALIDATORS[key](value);
}

// The limits the wireless alert rules open at (WLS-200). One set for the
// whole install, which a device can partly override (WLS-201).
export class AlertThresholds extends ValueObject<AlertThresholdsProps> {
  private constructor(props: AlertThresholdsProps) {
    super(props);
  }

  get values(): AlertThresholdsProps {
    return this._props;
  }
  get signalDbm(): SeverityThresholds {
    return this._props.signalDbm;
  }
  get snrDb(): SeverityThresholds {
    return this._props.snrDb;
  }
  get ccqPercent(): SeverityThresholds {
    return this._props.ccqPercent;
  }
  get latencyMs(): SeverityThresholds {
    return this._props.latencyMs;
  }
  get cpuPercent(): number {
    return this._props.cpuPercent;
  }
  get memoryPercent(): number {
    return this._props.memoryPercent;
  }
  get clockDriftSeconds(): number {
    return this._props.clockDriftSeconds;
  }
  get saturationPercent(): number {
    return this._props.saturationPercent;
  }
  get clientDropPercent(): number {
    return this._props.clientDropPercent;
  }
  get minCapacityMbps(): ChannelWidthThresholds {
    return this._props.minCapacityMbps;
  }
  get maxDistanceKm(): ChannelWidthThresholds {
    return this._props.maxDistanceKm;
  }

  minCapacityKbpsFor(channelWidthMhz: number): number | null {
    const mbps = this._props.minCapacityMbps[channelWidthMhz];
    return mbps === undefined ? null : mbps * 1000;
  }

  maxDistanceMFor(channelWidthMhz: number): number | null {
    const km = this._props.maxDistanceKm[channelWidthMhz];
    return km === undefined ? null : Math.round(km * 1000);
  }

  public static defaults(): AlertThresholds {
    return new AlertThresholds(DEFAULTS);
  }

  public static create(
    props: AlertThresholdsProps
  ): Result<AlertThresholds> {
    for (const key of ALERT_THRESHOLD_KEYS) {
      const error = validateAlertThresholdGroup(key, props[key]);
      if (error) return Result.fail(error);
    }
    return Result.ok(new AlertThresholds(props));
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    props: AlertThresholdsProps
  ): AlertThresholds {
    return new AlertThresholds(props);
  }

  // Each group is replaced whole, so a valid override on a valid base stays
  // valid; channel-width tables merge per width instead.
  public withOverrides(
    overrides: AlertThresholdOverridesProps
  ): AlertThresholds {
    const merged: Record<string, unknown> = { ...this._props };
    for (const key of ALERT_THRESHOLD_KEYS) {
      const value = overrides[key];
      if (value === undefined) continue;
      merged[key] =
        key === 'minCapacityMbps' || key === 'maxDistanceKm'
          ? {
              ...this._props[key],
              ...(value as ChannelWidthThresholds)
            }
          : value;
    }
    return new AlertThresholds(
      merged as unknown as AlertThresholdsProps
    );
  }
}
