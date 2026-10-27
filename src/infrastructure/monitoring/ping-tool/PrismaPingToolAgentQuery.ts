import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IPingToolAgentQuery,
  PingToolAgent
} from 'application/device-monitoring/interfaces';

export class PrismaPingToolAgentQuery implements IPingToolAgentQuery {
  constructor(private readonly prisma: PrismaClient) {}

  async findActive(
    agentId: string
  ): Promise<Result<PingToolAgent | null>> {
    try {
      const agent = await this.prisma.probeAgent.findFirst({
        where: { id: agentId, status: 'ACTIVE' },
        select: { id: true, name: true }
      });
      return Result.ok(agent);
    } catch (error) {
      return Result.fail(
        `Database error loading agent: ${(error as Error).message}`
      );
    }
  }
}
