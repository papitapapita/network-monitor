import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IRouterTrafficTargetsQuery,
  RouterTrafficCandidate
} from 'application/device-monitoring/interfaces';
import { CredentialsEncryption } from '../../crypto';

interface CandidateRow {
  device_id: string;
  device_name: string;
  ip_address: string | null;
  vendor_slug: string | null;
  agent_id: string | null;
  http_username: string | null;
  http_password: string | null;
  api_port: number | null;
}

export class PrismaRouterTrafficTargetsQuery
  implements IRouterTrafficTargetsQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async listMainRouters(): Promise<Result<RouterTrafficCandidate[]>> {
    try {
      const rows = await this.prisma.$queryRaw<CandidateRow[]>`
        SELECT d.id AS device_id,
               d.name AS device_name,
               d.ip_address,
               v.slug AS vendor_slug,
               d.agent_id::text AS agent_id,
               dc.http_username,
               dc.http_password,
               dc.api_port
        FROM devices d
        LEFT JOIN device_models dm ON dm.id = d.device_model_id
        LEFT JOIN vendors v ON v.id = dm.vendor_id
        LEFT JOIN device_credentials dc ON dc.device_id = d.id
        WHERE d.deleted_at IS NULL
          AND d.category = 'GATEWAY'
          AND d.status IN ('ACTIVE', 'COMMISSIONING')
        ORDER BY d.name, d.id
      `;
      return Result.ok(rows.map(toCandidate));
    } catch (error) {
      return Result.fail(
        `Database error listing main routers: ${(error as Error).message}`
      );
    }
  }
}

function toCandidate(row: CandidateRow): RouterTrafficCandidate {
  const hasLogin =
    row.http_username !== null && row.http_password !== null;
  return {
    deviceId: row.device_id,
    deviceName: row.device_name,
    ipAddress: row.ip_address,
    vendorSlug: row.vendor_slug,
    agentId: row.agent_id,
    login: hasLogin
      ? {
          username: row.http_username!,
          password: CredentialsEncryption.decrypt(row.http_password!),
          apiPort: row.api_port ?? 8728
        }
      : null
  };
}
