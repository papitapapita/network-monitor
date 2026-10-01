import { Agent } from 'domain/probe-agents';
import { AgentListResponseDTO, AgentResponseDTO } from '../dtos';

export class AgentMapper {
  // deviceCounts comes from IAgentDeviceCountQuery; an agent missing from it
  // has no devices.
  public static toDTO(
    agent: Agent,
    deviceCounts: ReadonlyMap<string, number>
  ): AgentResponseDTO {
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
      offlineSince: agent.offlineSince?.toISOString() ?? null,
      clockDriftSince: agent.clockDriftSince?.toISOString() ?? null,
      lastUpdate: agent.lastUpdate && {
        version: agent.lastUpdate.version,
        outcome: agent.lastUpdate.outcome,
        reason: agent.lastUpdate.reason,
        at: agent.lastUpdate.at.toISOString()
      },
      deviceCount: deviceCounts.get(agent.id.toString()) ?? 0,
      createdAt: agent.createdAt.toISOString(),
      updatedAt: agent.updatedAt.toISOString()
    };
  }

  public static toListDTO(
    agents: Agent[],
    deviceCounts: ReadonlyMap<string, number>
  ): AgentListResponseDTO {
    return { agents: agents.map((a) => this.toDTO(a, deviceCounts)) };
  }
}
