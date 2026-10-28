import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface DeviceHardware {
  deviceId: string;
  name: string;
  macAddress: string | null;
  // DEV-063: only a unit still in INVENTORY may have its model corrected in
  // place; once in service a different model means a different unit.
  inInventory: boolean;
  deviceModelId: string;
  modelName: string;
  vendorId: string;
}

export interface DeviceByMac {
  deviceId: string;
  name: string;
  macAddress: string;
}

export interface CatalogModel {
  id: string;
  model: string;
  vendorId: string;
}

// Read-only view of device-inventory's hardware records. Deleted devices are
// never returned.
export interface IDeviceHardwareQuery {
  findHardware(
    deviceId: DeviceId
  ): Promise<Result<DeviceHardware | null>>;
  // Every device with an enabled wireless config — the radios being polled.
  findPolledHardware(): Promise<Result<DeviceHardware[]>>;
  findDevicesByMac(macs: string[]): Promise<Result<DeviceByMac[]>>;
  findCatalogModels(): Promise<Result<CatalogModel[]>>;
}
