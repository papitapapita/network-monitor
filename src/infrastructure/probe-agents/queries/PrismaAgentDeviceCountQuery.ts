import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { IAgentDeviceCountQuery } from 'application/probe-agents/interfaces';

export class PrismaAgentDeviceCountQuery
  implements IAgentDeviceCountQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async countByAgent(
    agentIds: AgentId[]
  ): Promise<Result<Map<string, number>>> {
    if (agentIds.length === 0) return Result.ok(new Map());
    try {
      const rows = await this.prisma.device.groupBy({
        by: ['agentId'],
        where: {
          agentId: { in: agentIds.map((id) => id.toString()) },
          deletedAt: null
        },
        _count: { _all: true }
      });
      return Result.ok(
        new Map(rows.map((r) => [r.agentId!, r._count._all]))
      );
    } catch (error) {
      return Result.fail(
        `Database error counting agent devices: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
