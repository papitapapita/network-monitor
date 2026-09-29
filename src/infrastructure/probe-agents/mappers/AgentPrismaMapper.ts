import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { Agent, AgentName, AgentStatus } from 'domain/probe-agents';
import {
  ProbeAgent,
  AgentStatus as PrismaAgentStatus
} from 'generated/prisma/client';

export class AgentPrismaMapper {
  public static toDomain(raw: ProbeAgent): Result<Agent> {
    const idResult = AgentId.parse(raw.id);
    if (idResult.isFailure) {
      return Result.fail(`Invalid agent id: ${idResult.error}`);
    }
    const nameResult = AgentName.create(raw.name);
    if (nameResult.isFailure) {
      return Result.fail(`Invalid agent name: ${nameResult.error}`);
    }

    return Result.ok(
      Agent.reconstitute(idResult.value, {
        name: nameResult.value,
        status: raw.status as AgentStatus,
        pairingCodeHash: raw.pairingCodeHash,
        pairingExpiresAt: raw.pairingExpiresAt,
        tokenHash: raw.tokenHash,
        enrolledAt: raw.enrolledAt,
        revokedAt: raw.revokedAt,
        lastSeenAt: raw.lastSeenAt,
        agentVersion: raw.agentVersion,
        clockOffsetMs: raw.clockOffsetMs,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt
      })
    );
  }

  public static toPersistence(agent: Agent): ProbeAgent {
    return {
      id: agent.id.toString(),
      name: agent.name.value,
      status: agent.status as PrismaAgentStatus,
      pairingCodeHash: agent.pairingCodeHash,
      pairingExpiresAt: agent.pairingExpiresAt,
      tokenHash: agent.tokenHash,
      enrolledAt: agent.enrolledAt,
      revokedAt: agent.revokedAt,
      lastSeenAt: agent.lastSeenAt,
      agentVersion: agent.agentVersion,
      clockOffsetMs: agent.clockOffsetMs,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt
    };
  }
}
