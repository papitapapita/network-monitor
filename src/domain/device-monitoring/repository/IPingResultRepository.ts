import { DeviceId } from 'domain/shared';
import { Result } from 'domain/shared/core';

export interface PingResultRecord {
  id: string;
  deviceId: DeviceId;
  isReachable: boolean;
  latencyMs: number | null;
  checkedAt: Date;
}

export interface CreatePingResultInput {
  deviceId: DeviceId;
  isReachable: boolean;
  latencyMs: number | null;
  checkedAt: Date;
}

export interface PingResultFilters {
  isReachable?: boolean;
  fromDate?: Date;
  toDate?: Date;
  limit: number;
  offset: number;
}

export interface PingResultPage {
  records: PingResultRecord[];
  total: number;
}

export interface IPingResultRepository {
  save(input: CreatePingResultInput): Promise<Result<void>>;
  findLatestByDevice(
    deviceId: DeviceId,
    limit: number
  ): Promise<Result<PingResultRecord[]>>;
  findByDevice(
    deviceId: DeviceId,
    filters: PingResultFilters
  ): Promise<Result<PingResultPage>>;
}
