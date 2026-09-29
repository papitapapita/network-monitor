import { AgentId } from 'domain/shared/ids';
import { Result } from 'domain/shared/core';
import { Agent } from '../aggregates';

export interface IAgentRepository {
  save(agent: Agent): Promise<Result<Agent>>;
  // Persists an enrollment only if the pairing code is still the one that was
  // presented, so two installers racing on one key cannot both succeed.
  // Resolves null when the code was consumed or replaced in the meantime.
  saveEnrollment(
    agent: Agent,
    consumedPairingCodeHash: string
  ): Promise<Result<Agent | null>>;
  findById(id: AgentId): Promise<Result<Agent | null>>;
  findByPairingCodeHash(hash: string): Promise<Result<Agent | null>>;
  findAll(): Promise<Result<Agent[]>>;
}
