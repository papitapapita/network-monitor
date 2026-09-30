import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { IAgentOutageQuery } from 'application/probe-agents/interfaces';
import { AgentOutageDTO } from 'application/probe-agents/dtos';

export class PrismaAgentOutageQuery implements IAgentOutageQuery {
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    agentId: AgentId,
    page: { limit: number; offset: number }
  ): Promise<Result<{ outages: AgentOutageDTO[]; total: number }>> {
    const where = { agentId: agentId.toString() };
    try {
      const [rows, total] = await Promise.all([
        this.prisma.probeAgentOutage.findMany({
          where,
          orderBy: { offlineSince: 'desc' },
          take: page.limit,
          skip: page.offset
        }),
        this.prisma.probeAgentOutage.count({ where })
      ]);
      return Result.ok({
        total,
        outages: rows.map((r) => ({
          id: r.id,
          silentSince: r.silentSince.toISOString(),
          offlineSince: r.offlineSince.toISOString(),
          endedAt: r.endedAt?.toISOString() ?? null,
          endReason: r.endReason as AgentOutageDTO['endReason']
        }))
      });
    } catch (error) {
      return Result.fail(
        `Database error listing agent outages: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
