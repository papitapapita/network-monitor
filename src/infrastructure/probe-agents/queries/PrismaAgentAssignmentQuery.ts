import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import {
  AgentAssignability,
  IAgentAssignmentQuery
} from 'application/device-inventory/interfaces';

export class PrismaAgentAssignmentQuery
  implements IAgentAssignmentQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async check(agentId: AgentId): Promise<Result<AgentAssignability>> {
    try {
      const row = await this.prisma.probeAgent.findUnique({
        where: { id: agentId.toString() },
        select: { status: true }
      });
      if (!row) return Result.ok('NOT_FOUND');
      return Result.ok(
        row.status === 'REVOKED' ? 'REVOKED' : 'ASSIGNABLE'
      );
    } catch (error) {
      return Result.fail(
        `Database error checking agent: ${this.message(error)}`
      );
    }
  }

  async listAssignable(): Promise<Result<AgentId[]>> {
    try {
      const rows = await this.prisma.probeAgent.findMany({
        where: { status: { not: 'REVOKED' } },
        select: { id: true },
        orderBy: { createdAt: 'asc' }
      });
      const ids: AgentId[] = [];
      for (const row of rows) {
        const parsed = AgentId.parse(row.id);
        if (parsed.isFailure) {
          return Result.fail(`Invalid agent id: ${parsed.error}`);
        }
        ids.push(parsed.value);
      }
      return Result.ok(ids);
    } catch (error) {
      return Result.fail(
        `Database error listing agents: ${this.message(error)}`
      );
    }
  }

  private message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
