import { AgentStatus, AgentUpdateOutcome } from '../enums';
import { AgentName } from '../value-objects';

export interface AgentProps {
  name: AgentName;
  status: AgentStatus;
  // Only hashes are held: the pairing code and the token are shown once and
  // never stored in a form that could be replayed.
  pairingCodeHash: string | null;
  pairingExpiresAt: Date | null;
  tokenHash: string | null;
  enrolledAt: Date | null;
  revokedAt: Date | null;
  lastSeenAt: Date | null;
  agentVersion: string | null;
  clockOffsetMs: number | null;
  // Null while online (R6). Only an active agent can be offline.
  offlineSince: Date | null;
  // Set while the agent's clock is off by more than a minute (R12).
  clockDriftSince: Date | null;
  // How the last self-update this agent reported ended (AGT-084).
  lastUpdate: AgentUpdateRecord | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentUpdateRecord {
  // The version the agent tried to move to.
  version: string;
  outcome: AgentUpdateOutcome;
  // Why it failed, in the agent's words; null once installed.
  reason: string | null;
  at: Date;
}
