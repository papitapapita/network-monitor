import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IPortSpeedTargetsQuery,
  PortSpeedReach,
  PortSpeedRouterCandidate
} from 'application/device-monitoring/interfaces';
import { CredentialsEncryption } from '../../crypto';

interface CandidateRow {
  device_id: string;
  device_name: string;
  ip_address: string | null;
  agent_id: string | null;
  http_username: string | null;
  http_password: string | null;
  api_port: number | null;
}

export class PrismaPortSpeedTargetsQuery
  implements IPortSpeedTargetsQuery
{
  constructor(
    private readonly prisma: PrismaClient,
    // Off site the server reaches no device itself (MON-145).
    private readonly serverOnSite: boolean
  ) {}

  async listRouters(): Promise<Result<PortSpeedRouterCandidate[]>> {
    return this.select(
      Prisma.empty,
      'Database error listing MikroTik routers'
    );
  }

  async findRouter(
    deviceId: string
  ): Promise<Result<PortSpeedRouterCandidate | null>> {
    const found = await this.select(
      Prisma.sql`AND d.id = ${deviceId}::uuid`,
      'Database error finding MikroTik router'
    );
    return found.isFailure
      ? Result.fail(found.error)
      : Result.ok(found.value[0] ?? null);
  }

  // MON-140: the company's MikroTik routerboards, routers and switches in
  // service. A switch running SwOS has no RouterOS API.
  private async select(
    where: Prisma.Sql,
    errorPrefix: string
  ): Promise<Result<PortSpeedRouterCandidate[]>> {
    try {
      const rows = await this.prisma.$queryRaw<CandidateRow[]>`
        SELECT d.id AS device_id,
               d.name AS device_name,
               d.ip_address,
               d.agent_id::text AS agent_id,
               dc.http_username,
               dc.http_password,
               dc.api_port
        FROM devices d
        JOIN device_models dm ON dm.id = d.device_model_id
        JOIN vendors v ON v.id = dm.vendor_id
        LEFT JOIN device_credentials dc ON dc.device_id = d.id
        WHERE d.deleted_at IS NULL
          AND v.slug = 'mikrotik'
          AND d.owner = 'COMPANY'
          AND d.status IN ('ACTIVE', 'COMMISSIONING')
          AND (
            dm.device_type IN ('ROUTERBOARD', 'ROUTER', 'SWITCH')
            OR d.category IN ('GATEWAY', 'AGGREGATION_SWITCH')
          )
          AND dm.poe_switch_os IS DISTINCT FROM 'SWOS'
          ${where}
        ORDER BY d.name, d.id
      `;
      return Result.ok(rows.map((r) => this.toCandidate(r)));
    } catch (error) {
      return Result.fail(
        `${errorPrefix}: ${(error as Error).message}`
      );
    }
  }

  private toCandidate(row: CandidateRow): PortSpeedRouterCandidate {
    const hasLogin =
      row.http_username !== null && row.http_password !== null;
    return {
      deviceId: row.device_id,
      deviceName: row.device_name,
      ipAddress: row.ip_address,
      reach: this.reachOf(row),
      login: hasLogin
        ? {
            username: row.http_username!,
            password: CredentialsEncryption.decrypt(
              row.http_password!
            ),
            apiPort: row.api_port ?? 8728
          }
        : null
    };
  }

  // On site the server reads every router itself, behind an agent or not,
  // as wireless polling does (WLS-029).
  private reachOf(row: CandidateRow): PortSpeedReach {
    if (this.serverOnSite) return { by: 'server' };
    return row.agent_id
      ? { by: 'agent', agentId: row.agent_id }
      : { by: 'none' };
  }
}
