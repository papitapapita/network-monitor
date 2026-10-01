export interface GetAgentUpdateOfferRequestDTO {
  agentId: string;
  // As the agent announced it in its hello; null for an agent too old to.
  platform: string | null;
  runningVersion: string;
}

// What the backend tells an agent to install (AGT-082).
export interface AgentUpdateOfferDTO {
  version: string;
  file: string;
  sha256: string;
  bytes: number;
  signature: string;
}

export interface RecordAgentUpdateOutcomeRequestDTO {
  agentId: string;
  version: string;
  outcome: 'INSTALLED' | 'ROLLED_BACK' | 'REJECTED';
  reason: string | null;
}

export interface OpenAgentReleaseFileRequestDTO {
  fileName: string;
}
