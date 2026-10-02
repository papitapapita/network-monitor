import type { PingCycleOutcome } from '../services/PingCycleProbe';

export type AgentPingRefusal =
  | 'AGENT_OFFLINE'
  | 'PROBE_UNSUPPORTED'
  | 'TIMEOUT'
  | 'AGENT_ERROR';

export type AgentPingAnswer =
  | { kind: 'measured'; outcome: PingCycleOutcome; measuredAt: Date }
  | { kind: 'refused'; reason: AgentPingRefusal; error: string };

// Pings a device from the on-site agent it sits behind (MON-022). The answer
// is already timed on this server's clock.
export interface IAgentPingProbe {
  ping(
    agentId: string,
    ipAddress: string,
    attempts: number
  ): Promise<AgentPingAnswer>;
}

export const NoAgentPingProbe: IAgentPingProbe = {
  ping: async () => ({
    kind: 'refused',
    reason: 'AGENT_OFFLINE',
    error: 'No agent is connected to this server'
  })
};
