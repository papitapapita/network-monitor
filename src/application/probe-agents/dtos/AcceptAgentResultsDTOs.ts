import { AgentPingOutcome } from '../interfaces';

export interface AgentResultDTO {
  id: string;
  deviceIndex: number;
  measuredAt: Date;
  outcome: AgentPingOutcome;
}

export interface AcceptAgentResultsRequestDTO {
  agentId: string;
  results: AgentResultDTO[];
}

export interface AcceptAgentResultsResponseDTO {
  // Results the agent may forget: stored, or knowingly dropped.
  acknowledged: string[];
}
