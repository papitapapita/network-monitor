import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { RouterPortCounters } from '../aggregates';

export interface IRouterPortCountersRepository {
  // a router never checked has no entry
  listForDevices(
    deviceIds: DeviceId[]
  ): Promise<Result<RouterPortCounters[]>>;
  // Replaces each router's ports with the ones it holds.
  saveAll(counters: RouterPortCounters[]): Promise<Result<void>>;
}
