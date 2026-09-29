export interface AgentResponseDTO {
  id: string;
  name: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  pairingExpiresAt: string | null;
  enrolledAt: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
  agentVersion: string | null;
  clockOffsetMs: number | null;
  createdAt: string;
  updatedAt: string;
}
