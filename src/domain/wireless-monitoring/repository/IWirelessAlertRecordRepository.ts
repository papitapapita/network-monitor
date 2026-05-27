import { Result } from 'domain/shared/core';
import { DeviceId, WirelessAlertRecordId } from 'domain/shared/ids';
import { WirelessAlertRecord } from '../aggregates';

export interface IWirelessAlertRecordRepository {
  save(
    record: WirelessAlertRecord
  ): Promise<Result<WirelessAlertRecord>>;
  findById(
    id: WirelessAlertRecordId
  ): Promise<Result<WirelessAlertRecord | null>>;
  exists(id: WirelessAlertRecordId): Promise<Result<boolean>>;

  // at most one active alert exists per device per metric at any time
  findActiveByDeviceAndMetric(
    deviceId: DeviceId,
    metric: string
  ): Promise<Result<WirelessAlertRecord | null>>;
  findAllActiveByDevice(
    deviceId: DeviceId
  ): Promise<Result<WirelessAlertRecord[]>>;
  findAllActive(): Promise<Result<WirelessAlertRecord[]>>;
  // range is inclusive: [from, to]
  findHistoryByDevice(
    deviceId: DeviceId,
    from: Date,
    to: Date,
    limit?: number
  ): Promise<Result<WirelessAlertRecord[]>>;
}
