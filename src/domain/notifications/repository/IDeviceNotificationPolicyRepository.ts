import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { DeviceNotificationPolicy } from '../entities';

export interface IDeviceNotificationPolicyRepository {
  save(
    policy: DeviceNotificationPolicy
  ): Promise<Result<DeviceNotificationPolicy>>;
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<DeviceNotificationPolicy | null>>;
  delete(deviceId: DeviceId): Promise<Result<void>>;
}
