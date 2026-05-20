import { Result } from 'domain/shared/core';
import { DeviceId, WirelessPollingConfigId } from 'domain/shared/ids';
import { WirelessPollingConfig } from '../entities/WirelessPollingConfig';

export interface IWirelessPollingConfigRepository {
  save(
    config: WirelessPollingConfig
  ): Promise<Result<WirelessPollingConfig>>;
  findById(
    id: WirelessPollingConfigId
  ): Promise<Result<WirelessPollingConfig | null>>;
  delete(deviceId: DeviceId): Promise<Result<void>>;
  exists(id: WirelessPollingConfigId): Promise<Result<boolean>>;

  // at most one config exists per device
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<WirelessPollingConfig | null>>;
  // used by the polling scheduler to select devices due for a poll cycle
  findAllDue(now: Date): Promise<Result<WirelessPollingConfig[]>>;
}
