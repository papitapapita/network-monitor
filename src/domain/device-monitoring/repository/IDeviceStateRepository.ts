import { DeviceId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { DeviceState } from '../aggregates';

export interface IDeviceStateRepository {
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceState | null>>;
  // Every device currently in a DOWN streak — the candidates for a delayed
  // down-alert. Unfiltered by how long: the alert delay is per-device (see
  // IDeviceNotificationPolicyRepository), so the cutoff is applied by the
  // caller instead of in this query.
  findAllDown(): Promise<Result<DeviceState[]>>;
  save(state: DeviceState): Promise<Result<DeviceState>>;
}
