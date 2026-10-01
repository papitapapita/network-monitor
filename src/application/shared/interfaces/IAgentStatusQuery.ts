import { Result } from 'domain/shared/core';

// ADR 0002, R7: offline means unknown, not down. Read by device-monitoring
// and notifications, which must not import the probe-agents domain.
export interface IAgentStatusQuery {
  // Of the given devices, those nobody is measuring right now, so their
  // stored state is stale: placed behind an agent that is not reporting
  // (offline, never connected or revoked), or — on a server hosted off site,
  // which pings nothing — placed behind no agent (MON-006, MON-023).
  findUnmeasuredDevices(
    deviceIds: string[]
  ): Promise<Result<Set<string>>>;
}
