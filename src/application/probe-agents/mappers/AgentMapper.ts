import { Agent } from 'domain/probe-agents';
import { AgentListResponseDTO, AgentResponseDTO } from '../dtos';

export class AgentMapper {
  public static toDTO(agent: Agent): AgentResponseDTO {
    return {
      id: agent.id.toString(),
      name: agent.name.value,
      status: agent.status,
      pairingExpiresAt: agent.pairingExpiresAt?.toISOString() ?? null,
      enrolledAt: agent.enrolledAt?.toISOString() ?? null,
      revokedAt: agent.revokedAt?.toISOString() ?? null,
      lastSeenAt: agent.lastSeenAt?.toISOString() ?? null,
      agentVersion: agent.agentVersion,
      clockOffsetMs: agent.clockOffsetMs,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString()
    };
  }

  public static toListDTO(agents: Agent[]): AgentListResponseDTO {
    return { agents: agents.map((a) => this.toDTO(a)) };
  }
}
