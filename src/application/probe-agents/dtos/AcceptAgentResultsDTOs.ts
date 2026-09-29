import { AgentPingOutcome } from '../interfaces';

export interface AgentResultDTO {
  id: string;
  deviceIndex: number;
  // On the agent's clock, as sent.
  measuredAt: Date;
  outcome: AgentPingOutcome;
}

export interface AcceptAgentResultsRequestDTO {
  agentId: string;
  results: AgentResultDTO[];
  // When the batch arrived, on the backend's clock.
  receivedAt: Date;
}

export interface AcceptAgentResultsResponseDTO {
  // Results the agent may forget: stored, or knowingly dropped.
  acknowledged: string[];
}
