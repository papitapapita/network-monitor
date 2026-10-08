import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  AlertThresholds,
  AlertThresholdOverrides
} from '../value-objects';

export interface IAlertThresholdsRepository {
  // Always answers: the saved thresholds, or the defaults when none were
  // ever saved (WLS-200).
  getGlobal(): Promise<Result<AlertThresholds>>;
  saveGlobal(thresholds: AlertThresholds): Promise<Result<void>>;
  // None when the device has no overrides.
  findOverrides(
    deviceId: DeviceId
  ): Promise<Result<AlertThresholdOverrides>>;
  // Saving empty overrides removes them.
  saveOverrides(
    deviceId: DeviceId,
    overrides: AlertThresholdOverrides
  ): Promise<Result<void>>;
}
