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
  // Set while an active agent is offline (R6); null otherwise.
  offlineSince: string | null;
  // Set while the PC's clock is off by more than a minute (R12).
  clockDriftSince: string | null;
  createdAt: string;
  updatedAt: string;
}
