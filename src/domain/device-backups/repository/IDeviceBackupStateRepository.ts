import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceBackupState } from '../aggregates';

export interface IDeviceBackupStateRepository {
  findByDevice(
    deviceId: DeviceId
  ): Promise<Result<DeviceBackupState | null>>;
  save(state: DeviceBackupState): Promise<Result<void>>;
}
