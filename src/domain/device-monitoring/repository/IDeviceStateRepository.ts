import { DeviceId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { DeviceState } from '../aggregates';

export interface IDeviceStateRepository {
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceState | null>>;
  save(state: DeviceState): Promise<Result<DeviceState>>;
}
