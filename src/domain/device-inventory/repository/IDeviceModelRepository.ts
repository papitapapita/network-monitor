import { DeviceModelId } from '../../shared/ids';
import { Result } from '../../shared/core';

export interface DeviceModelRecord {
  id: string;
  manufacturer: string;
  model: string;
  deviceType: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDeviceModelRepository {
  findById(id: DeviceModelId): Promise<Result<DeviceModelRecord | null>>;
  findAll(
    limit?: number,
    offset?: number
  ): Promise<Result<DeviceModelRecord[]>>;
  count(): Promise<Result<number>>;
}
