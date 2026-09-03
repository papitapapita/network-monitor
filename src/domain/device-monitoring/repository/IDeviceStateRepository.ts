import { DeviceId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { DeviceState } from '../aggregates';

export interface IDeviceStateRepository {
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceState | null>>;
  // Devices continuously DOWN since at or before cutoff — the candidates for
  // a delayed down-alert.
  findOverdueDown(cutoff: Date): Promise<Result<DeviceState[]>>;
  save(state: DeviceState): Promise<Result<DeviceState>>;
}
