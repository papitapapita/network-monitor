import { DeviceId } from 'domain/shared';
import { Result } from '../../shared/core';
import { DeviceState } from '../aggregates/DeviceState';

export interface IDeviceStateRepository {
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceState | null>>;
  save(state: DeviceState): Promise<Result<DeviceState>>;
}
