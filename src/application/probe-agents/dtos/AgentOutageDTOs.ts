export interface ListAgentOutagesRequestDTO {
  id: string;
  limit?: number;
  offset?: number;
}

export interface AgentOutageDTO {
  id: string;
  // Last contact before the silence: when the outage really began.
  silentSince: string;
  // When the agent was marked offline, 5 minutes of silence later (AGT-021).
  offlineSince: string;
  endedAt: string | null;
  endReason: 'RECONNECTED' | 'REVOKED' | null;
}

export interface AgentOutageListResponseDTO {
  outages: AgentOutageDTO[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
