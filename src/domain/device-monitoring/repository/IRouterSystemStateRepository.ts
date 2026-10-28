import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { RouterSystemState } from '../aggregates';

export interface IRouterSystemStateRepository {
  listForDevices(
    deviceIds: DeviceId[]
  ): Promise<Result<RouterSystemState[]>>;
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<RouterSystemState | null>>;
  // Inserts, or replaces the row of the same device.
  saveAll(states: RouterSystemState[]): Promise<Result<void>>;
}
