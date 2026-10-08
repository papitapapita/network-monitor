import { ValueObject, Result } from 'domain/shared/core';
import { AlertThresholdOverridesProps } from '../props';
import {
  ALERT_THRESHOLD_KEYS,
  validateAlertThresholdGroup
} from './AlertThresholds';

// One device's departures from the install's thresholds (WLS-201), e.g. a
// long backhaul allowed further than the global maximum distance. Only the
// groups set here differ; everything else follows the install.
export class AlertThresholdOverrides extends ValueObject<AlertThresholdOverridesProps> {
  private constructor(props: AlertThresholdOverridesProps) {
    super(props);
  }

  get values(): AlertThresholdOverridesProps {
    return this._props;
  }

  get isEmpty(): boolean {
    return ALERT_THRESHOLD_KEYS.every(
      (key) => this._props[key] === undefined
    );
  }

  public static none(): AlertThresholdOverrides {
    return new AlertThresholdOverrides({});
  }

  public static create(
    props: AlertThresholdOverridesProps
  ): Result<AlertThresholdOverrides> {
    const kept: Record<string, unknown> = {};
    for (const key of ALERT_THRESHOLD_KEYS) {
      const value = props[key];
      if (value === undefined || value === null) continue;
      const error = validateAlertThresholdGroup(key, value);
      if (error) return Result.fail(error);
      kept[key] = value;
    }
    return Result.ok(
      new AlertThresholdOverrides(
        kept as AlertThresholdOverridesProps
      )
    );
  }

  // bypasses validation — for repository use only
  public static reconstitute(
    props: AlertThresholdOverridesProps
  ): AlertThresholdOverrides {
    return new AlertThresholdOverrides(props);
  }
}
