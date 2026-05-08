import { DeviceModelId, VendorId } from '../../shared/ids';
import { Result } from '../../shared/core';
import { DeviceModel } from '../aggregates';

export interface IDeviceModelRepository {
  save(deviceModel: DeviceModel): Promise<Result<DeviceModel>>;
  findById(id: DeviceModelId): Promise<Result<DeviceModel | null>>;
  findAll(limit?: number, offset?: number): Promise<Result<DeviceModel[]>>;
  findByVendor(vendorId: VendorId): Promise<Result<DeviceModel[]>>;
  delete(id: DeviceModelId): Promise<Result<void>>;
  exists(id: DeviceModelId): Promise<Result<boolean>>;
  existsByVendorAndModel(vendorId: VendorId, model: string): Promise<Result<boolean>>;
  count(): Promise<Result<number>>;
}
