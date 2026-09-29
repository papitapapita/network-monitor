import { Result } from 'domain/shared/core';

// ADR 0002, R7: offline means unknown, not down. Read by device-monitoring
// and notifications, which must not import the probe-agents domain.
export interface IAgentStatusQuery {
  // Of the given devices, those placed behind an agent that is not reporting
  // right now: offline, never connected (pending) or revoked. Nobody is
  // measuring them, so their stored state is stale. Devices polled in-process
  // are never included.
  findUnmeasuredDevices(
    deviceIds: string[]
  ): Promise<Result<Set<string>>>;
}
