import type {
  RouterConnection,
  SuspensionQueue
} from 'application/service-enforcement/interfaces';
import { AgentProbeFailure } from './IAgentProbeChannel';

export type AgentEnforceRequest =
  | { action: 'list' }
  | { action: 'add'; queue: SuspensionQueue }
  | { action: 'remove'; name: string };

export type AgentEnforceOutcome =
  // The router's suspension queues for a list; null for add and remove.
  { ok: true; queues: SuspensionQueue[] | null } | AgentProbeFailure;

// Asks the agent beside the enforcement router to read or change its
// suspension queues (AGT-110, AGT-111). An agent that does not announce
// `enforce` answers PROBE_UNSUPPORTED without being asked.
export interface IAgentEnforceChannel {
  enforce(
    agentId: string,
    router: RouterConnection,
    request: AgentEnforceRequest
  ): Promise<AgentEnforceOutcome>;
}
