import { DeviceId, PollingConfigurationId } from 'domain/shared';
import { Result } from '../../shared/core';
import { PollingConfiguration } from '../entities';

export interface IPollingConfigurationRepository {
  save(
    entity: PollingConfiguration
  ): Promise<Result<PollingConfiguration>>;
  findById(
    id: PollingConfigurationId
  ): Promise<Result<PollingConfiguration | null>>;
  findByDeviceId(
    deviceId: DeviceId
  ): Promise<Result<PollingConfiguration | null>>;
  findAllDue(now: Date): Promise<Result<PollingConfiguration[]>>;
  delete(deviceId: DeviceId): Promise<Result<void>>;
}
