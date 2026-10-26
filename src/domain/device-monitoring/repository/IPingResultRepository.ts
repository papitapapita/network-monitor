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
  sortBy?: 'checkedAt' | 'latencyMs';
  sortOrder?: 'ASC' | 'DESC';
  limit: number;
  offset: number;
}

export interface PingResultPage {
  records: PingResultRecord[];
  total: number;
}

export interface PingResultWindow {
  fromDate?: Date;
  toDate?: Date;
}

// Latency figures cover reachable results with a latency only; null when there
// are none.
export interface PingResultStats {
  total: number;
  reachable: number;
  averageLatencyMs: number | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
}

export interface IPingResultRepository {
  save(input: CreatePingResultInput): Promise<Result<void>>;
  // Stores a result that carries its source's id, once: resolves false when a
  // result with that id is already stored (ADR 0002, R8).
  saveOnce(
    input: CreatePingResultInput & { sourceResultId: string }
  ): Promise<Result<boolean>>;
  findLatestByDevice(
    deviceId: DeviceId,
    limit: number
  ): Promise<Result<PingResultRecord[]>>;
  findByDevice(
    deviceId: DeviceId,
    filters: PingResultFilters
  ): Promise<Result<PingResultPage>>;
  statsByDevice(
    deviceId: DeviceId,
    window: PingResultWindow
  ): Promise<Result<PingResultStats>>;
  deleteOlderThan(cutoff: Date): Promise<Result<number>>;
  deleteByDevice(
    deviceId: DeviceId,
    filters: { fromDate?: Date; toDate?: Date }
  ): Promise<Result<number>>;
}
