import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  AlertThresholds,
  IAlertThresholdsRepository
} from 'domain/wireless-monitoring';

// Failing rather than falling back to the defaults: alerting a device at
// limits its operator widened on purpose would notify for nothing.
export async function resolveAlertThresholds(
  repository: IAlertThresholdsRepository,
  deviceId: DeviceId
): Promise<Result<AlertThresholds>> {
  const global = await repository.getGlobal();
  if (global.isFailure) return Result.fail(global.error!);
  const overrides = await repository.findOverrides(deviceId);
  if (overrides.isFailure) return Result.fail(overrides.error!);
  return Result.ok(
    global.value.withOverrides(overrides.value.values)
  );
}
