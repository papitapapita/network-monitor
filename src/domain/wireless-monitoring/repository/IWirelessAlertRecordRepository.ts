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

  // at most one active alert exists per device/metric/severity — a metric may
  // hold a WARNING and a CRITICAL record simultaneously when both thresholds breach
  findActiveByDeviceMetricAndSeverity(
    deviceId: DeviceId,
    metric: string,
    severity: 'WARNING' | 'CRITICAL'
  ): Promise<Result<WirelessAlertRecord | null>>;
  findAllActiveByDevice(
    deviceId: DeviceId
  ): Promise<Result<WirelessAlertRecord[]>>;
  // active alerts whose notification has not yet been delivered
  findActiveUnnotifiedByDevice(
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

  deleteClearedOlderThan(cutoff: Date): Promise<Result<number>>;
}
