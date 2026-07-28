import { Result } from 'domain/shared/core';
import { AlertId, DeviceId } from 'domain/shared/ids';
import { Alert } from '../aggregates';

export interface IAlertRepository {
  save(alert: Alert): Promise<Result<Alert>>;
  findById(id: AlertId): Promise<Result<Alert | null>>;
  findOpenByDeviceAndType(
    deviceId: DeviceId,
    type: string
  ): Promise<Result<Alert | null>>;
  findAllByDeviceId(
    deviceId: DeviceId,
    limit?: number,
    offset?: number
  ): Promise<Result<Alert[]>>;
  findAll(limit?: number, offset?: number): Promise<Result<Alert[]>>;
  deleteById(id: AlertId): Promise<Result<void>>;
  deleteResolvedOlderThan(cutoff: Date): Promise<Result<number>>;
}
