import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface IDeviceRepository {
  findIdByMacAddress(mac: string): Promise<Result<DeviceId | null>>;
}
