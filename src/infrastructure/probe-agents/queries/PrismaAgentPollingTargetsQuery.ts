import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { AgentId } from 'domain/shared/ids';
import {
  AgentPollingTarget,
  IAgentPollingTargetsQuery
} from 'application/probe-agents/interfaces';

export class PrismaAgentPollingTargetsQuery
  implements IAgentPollingTargetsQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  // Same eligibility as PrismaPollingConfigurationRepository.findAllDue
  // (DEV-086): the two decide between them who polls a device, so they must
  // agree on which devices are pollable at all.
  async listForAgent(
    agentId: AgentId
  ): Promise<Result<AgentPollingTarget[]>> {
    try {
      const rows = await this.prisma.$queryRaw<
        Array<{
          device_id: string;
          ip_address: string;
          interval_seconds: number;
          failures_before_down: number;
        }>
      >`
        SELECT pc.device_id, pc.ip_address, pc.interval_seconds,
               pc.failures_before_down
        FROM polling_configurations pc
        JOIN devices d ON d.id = pc.device_id
        WHERE d.agent_id = ${agentId.toString()}::uuid
          AND pc.enabled = true
          AND pc.ip_address IS NOT NULL
          AND d.deleted_at IS NULL
          AND d.status IN ('ACTIVE', 'COMMISSIONING')
        ORDER BY pc.device_id
      `;
      return Result.ok(
        rows.map((r) => ({
          deviceId: r.device_id,
          ipAddress: r.ip_address,
          intervalSeconds: r.interval_seconds,
          failuresBeforeDown: r.failures_before_down
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error listing agent polling targets: ${(error as Error).message}`
      );
    }
  }
}
