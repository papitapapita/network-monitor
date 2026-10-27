import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface DeviceHardware {
  // DEV-063: only a unit still in INVENTORY may have its model corrected in
  // place; once in service a different model means a different unit.
  inInventory: boolean;
  deviceModelId: string;
  modelName: string;
  vendorId: string;
}

export interface CatalogModel {
  id: string;
  model: string;
  vendorId: string;
}

export interface IDeviceHardwareLookup {
  findHardware(
    deviceId: DeviceId
  ): Promise<Result<DeviceHardware | null>>;
  findCatalogModels(): Promise<Result<CatalogModel[]>>;
}
