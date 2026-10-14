import { Result } from 'domain/shared/core';
import { PollingConfiguration } from 'domain/device-monitoring/entities';
import { DeviceState } from 'domain/device-monitoring/aggregates';
import { PingResultRecord } from 'domain/device-monitoring/repository';

export interface PollingStatusRow {
  config: PollingConfiguration;
  state: DeviceState | null;
  lastPing: PingResultRecord | null;
}

/**
 * Read side of the dashboard: every non-deleted device's polling config,
 * state and latest ping in one round trip, instead of one status read per
 * device.
 */
export interface IPollingStatusListQuery {
  listAll(): Promise<Result<PollingStatusRow[]>>;
}
