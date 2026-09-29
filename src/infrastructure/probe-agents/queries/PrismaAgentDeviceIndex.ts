import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import { IAgentDeviceIndex } from 'application/probe-agents/interfaces';

export class PrismaAgentDeviceIndex implements IAgentDeviceIndex {
  constructor(private readonly prisma: PrismaClient) {}

  async indexesFor(
    agentId: AgentId,
    deviceIds: string[]
  ): Promise<Result<Map<string, number>>> {
    if (deviceIds.length === 0) return Result.ok(new Map());
    const agent = agentId.toString();
    try {
      const existing = await this.read(agent, deviceIds);
      const missing = deviceIds.filter((id) => !existing.has(id));
      if (missing.length === 0) return Result.ok(existing);

      // Reserve a block from the agent's counter, then claim it. A second
      // snapshot racing on the same device loses on the primary key and is
      // skipped; the re-read below returns whichever index won. The losing
      // numbers are simply never used — gaps are harmless, reuse is not.
      await this.prisma.$transaction(async (tx) => {
        const { nextDeviceIndex } = await tx.probeAgent.update({
          where: { id: agent },
          data: { nextDeviceIndex: { increment: missing.length } },
          select: { nextDeviceIndex: true }
        });
        const first = nextDeviceIndex - missing.length;
        await tx.probeAgentDeviceIndex.createMany({
          data: missing.map((deviceId, offset) => ({
            agentId: agent,
            deviceId,
            deviceIndex: first + offset
          })),
          skipDuplicates: true
        });
      });

      return Result.ok(await this.read(agent, deviceIds));
    } catch (error) {
      return Result.fail(
        `Database error assigning device indexes: ${(error as Error).message}`
      );
    }
  }

  async resolveAssigned(
    agentId: AgentId,
    indexes: number[]
  ): Promise<Result<Map<number, string>>> {
    if (indexes.length === 0) return Result.ok(new Map());
    try {
      const rows = await this.prisma.probeAgentDeviceIndex.findMany({
        where: {
          agentId: agentId.toString(),
          deviceIndex: { in: indexes },
          device: { agentId: agentId.toString(), deletedAt: null }
        },
        select: { deviceIndex: true, deviceId: true }
      });
      return Result.ok(
        new Map(rows.map((r) => [r.deviceIndex, r.deviceId]))
      );
    } catch (error) {
      return Result.fail(
        `Database error resolving device indexes: ${(error as Error).message}`
      );
    }
  }

  private async read(
    agentId: string,
    deviceIds: string[]
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.probeAgentDeviceIndex.findMany({
      where: { agentId, deviceId: { in: deviceIds } },
      select: { deviceId: true, deviceIndex: true }
    });
    return new Map(rows.map((r) => [r.deviceId, r.deviceIndex]));
  }
}
