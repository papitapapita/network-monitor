import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { IAgentStatusQuery } from 'application/shared/interfaces';

// Only an ACTIVE agent that is not offline is measuring its devices (R7).
// Shared with the device list, which filters on the same condition.
export const DEVICE_BEHIND_SILENT_AGENT: Prisma.DeviceWhereInput = {
  agentId: { not: null },
  NOT: { agent: { is: { status: 'ACTIVE', offlineSince: null } } }
};

// The same test on a row already loaded with its agent.
export function isBehindSilentAgent(device: {
  agentId: string | null;
  agent: { status: string; offlineSince: Date | null } | null;
}): boolean {
  if (!device.agentId) return false;
  return !(
    device.agent?.status === 'ACTIVE' &&
    device.agent.offlineSince === null
  );
}

export class PrismaAgentStatusQuery implements IAgentStatusQuery {
  constructor(private readonly prisma: PrismaClient) {}

  async findUnmeasuredDevices(
    deviceIds: string[]
  ): Promise<Result<Set<string>>> {
    if (deviceIds.length === 0) return Result.ok(new Set());
    try {
      const rows = await this.prisma.device.findMany({
        where: {
          id: { in: deviceIds },
          ...DEVICE_BEHIND_SILENT_AGENT
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
