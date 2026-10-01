import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { IAgentStatusQuery } from 'application/shared/interfaces';

// Only an ACTIVE agent that is not offline is measuring its devices (R7).
const BEHIND_SILENT_AGENT: Prisma.DeviceWhereInput = {
  agentId: { not: null },
  NOT: { agent: { is: { status: 'ACTIVE', offlineSince: null } } }
};

// The devices nobody is measuring right now (MON-006): behind a silent agent,
// or — off site, where the server pings nothing (MON-023) — behind no agent.
// Shared with the device list, which filters on the same condition.
export function unmeasuredDevices(
  serverOnSite: boolean
): Prisma.DeviceWhereInput {
  return serverOnSite
    ? BEHIND_SILENT_AGENT
    : { OR: [{ agentId: null }, BEHIND_SILENT_AGENT] };
}

// The same test on a row already loaded with its agent.
export function isUnmeasured(
  device: {
    agentId: string | null;
    agent: { status: string; offlineSince: Date | null } | null;
  },
  serverOnSite: boolean
): boolean {
  if (!device.agentId) return !serverOnSite;
  return !(
    device.agent?.status === 'ACTIVE' &&
    device.agent.offlineSince === null
  );
}

export class PrismaAgentStatusQuery implements IAgentStatusQuery {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly serverOnSite = true
  ) {}

  async findUnmeasuredDevices(
    deviceIds: string[]
  ): Promise<Result<Set<string>>> {
    if (deviceIds.length === 0) return Result.ok(new Set());
    try {
      const rows = await this.prisma.device.findMany({
        where: {
          id: { in: deviceIds },
          ...unmeasuredDevices(this.serverOnSite)
        },
        select: { id: true }
      });
      return Result.ok(new Set(rows.map((r) => r.id)));
    } catch (error) {
      return Result.fail(
        `Database error reading agent status: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
