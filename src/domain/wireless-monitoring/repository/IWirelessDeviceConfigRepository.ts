import { Result } from 'domain/shared/core';
import { DeviceId, WirelessDeviceConfigId } from 'domain/shared/ids';
import { WirelessDeviceConfig } from '../aggregates';

export interface IWirelessDeviceConfigRepository {
  save(
    config: WirelessDeviceConfig
  ): Promise<Result<WirelessDeviceConfig>>;
  findById(
    id: WirelessDeviceConfigId
  ): Promise<Result<WirelessDeviceConfig | null>>;
  delete(deviceId: DeviceId): Promise<Result<void>>;
  exists(id: WirelessDeviceConfigId): Promise<Result<boolean>>;

  // at most one config exists per device
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<WirelessDeviceConfig | null>>;
  // used by the polling scheduler to select devices due for a poll cycle
  findAllDue(now: Date): Promise<Result<WirelessDeviceConfig[]>>;
  findAll(): Promise<Result<WirelessDeviceConfig[]>>;
}
