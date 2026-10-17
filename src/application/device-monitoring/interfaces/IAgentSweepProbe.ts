import type { PingCycleOutcome } from '../services/PingCycleProbe';
import type { AgentPingRefusal } from './IAgentPingProbe';

export type AgentSweepAnswer =
  // One outcome per address asked, in the same order.
  | { kind: 'measured'; outcomes: PingCycleOutcome[] }
  | { kind: 'refused'; reason: AgentPingRefusal; error: string };

// Pings a batch of devices from the on-site agent they sit behind, all at
// once and with the sweep's short wait (MON-084).
export interface IAgentSweepProbe {
  sweep(
    agentId: string,
    ipAddresses: string[],
    attempts: number
  ): Promise<AgentSweepAnswer>;
}
