import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';

export interface DeviceHardware {
  deviceId: string;
  name: string;
  macAddress: string | null;
  serialNumber: string | null;
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

export interface DeviceBySerial {
  deviceId: string;
  name: string;
  serialNumber: string;
}

// RADIO: a polled radio's latest snapshot (WLS-154). ROUTER: what a MikroTik
// last said about itself (DEV-215).
export type HardwareReportSource = 'RADIO' | 'ROUTER';

// What a device reports about itself next to its inventory record. A field
// the box does not report is null: radios report no serial or identity.
export interface ReportedHardware {
  hardware: DeviceHardware;
  source: HardwareReportSource;
  reportedAt: Date;
  macAddress: string | null;
  deviceModel: string | null;
  serialNumber: string | null;
  identity: string | null;
}

export interface CatalogModel {
  id: string;
  model: string;
  vendorId: string;
}

// A model name a box reported while its MAC (a radio) or serial (a MikroTik)
// matched the one on file — the same box, so that name and that catalog
// model are the same hardware.
export interface ConfirmedModelName {
  reportedModel: string;
  deviceModelId: string;
}

// Read-only view of device-inventory's hardware records. Deleted devices are
// never returned.
export interface IDeviceHardwareQuery {
  findHardware(
    deviceId: DeviceId
  ): Promise<Result<DeviceHardware | null>>;
  // Every polled radio with its latest snapshot, and every MikroTik in
  // service with its last reading. A device never read is left out.
  findReportedHardware(): Promise<Result<ReportedHardware[]>>;
  findDevicesByMac(macs: string[]): Promise<Result<DeviceByMac[]>>;
  // Serials compared without case or surrounding spaces.
  findDevicesBySerial(
    serials: string[]
  ): Promise<Result<DeviceBySerial[]>>;
  findCatalogModels(): Promise<Result<CatalogModel[]>>;
  // From each live radio's latest snapshot and each router's last reading.
  findConfirmedModelNames(): Promise<Result<ConfirmedModelName[]>>;
}
