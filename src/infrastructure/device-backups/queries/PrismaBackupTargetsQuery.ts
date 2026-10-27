import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  BackupCandidate,
  BackupDeviceKind,
  BackupReach,
  IBackupTargetsQuery
} from 'application/device-backups/interfaces';
import { CredentialsEncryption } from '../../crypto';

interface CandidateRow {
  device_id: string;
  device_name: string;
  agent_id: string | null;
  ip_address: string | null;
  vendor_slug: string | null;
  kind: BackupDeviceKind | null;
  http_username: string | null;
  http_password: string | null;
  http_port: number | null;
  ssh_port: number | null;
}

export class PrismaBackupTargetsQuery implements IBackupTargetsQuery {
  constructor(
    private readonly prisma: PrismaClient,
    // Off site the server reaches no device itself, only through the agent
    // a device sits behind (BKP-015).
    private readonly serverOnSite: boolean
  ) {}

  // BKP-010: the company's own antennas, access points and stations, and
  // its routerboards and switches, in service. Off site, only those behind
  // an agent (BKP-015).
  async listScheduled(): Promise<Result<BackupCandidate[]>> {
    const reachable = this.serverOnSite
      ? Prisma.empty
      : Prisma.sql`AND d.agent_id IS NOT NULL`;
    return this.select(
      Prisma.sql`
        d.owner = 'COMPANY'
        AND (
          wpc.enabled = true
          OR (
            wpc.device_id IS NULL
            AND d.category IN ('ACCESS_POINT', 'WIRELESS_CPE')
          )
          OR dm.device_type IN ('ROUTERBOARD', 'SWITCH')
        )
        AND d.status IN ('ACTIVE', 'COMMISSIONING')
        ${reachable}
      `,
      'Database error listing backup targets'
    );
  }

  async findByDevice(
    deviceId: DeviceId
  ): Promise<Result<BackupCandidate | null>> {
    const found = await this.select(
      Prisma.sql`d.id = ${deviceId.toString()}::uuid`,
      'Database error finding backup target'
    );
    return found.isFailure
      ? Result.fail(found.error)
      : Result.ok(found.value[0] ?? null);
  }

  private async select(
    where: Prisma.Sql,
    errorPrefix: string
  ): Promise<Result<BackupCandidate[]>> {
    try {
      const rows = await this.prisma.$queryRaw<CandidateRow[]>`
        SELECT d.id AS device_id,
               d.name AS device_name,
               d.agent_id::text AS agent_id,
               COALESCE(wpc.ip_address, d.ip_address) AS ip_address,
               v.slug AS vendor_slug,
               -- A polling configuration says what the radio is; without
               -- one, the device's category does. A customer's own
               -- equipment is never backed up (BKP-010).
               CASE
                 WHEN d.owner IS DISTINCT FROM 'COMPANY' THEN NULL
                 WHEN wpc.device_type = 'ACCESS_POINT' THEN 'ACCESS_POINT'
                 WHEN wpc.device_type = 'STATION' THEN 'STATION'
                 WHEN wpc.device_id IS NULL
                   AND d.category = 'ACCESS_POINT' THEN 'ACCESS_POINT'
                 WHEN wpc.device_id IS NULL
                   AND d.category = 'WIRELESS_CPE' THEN 'STATION'
                 WHEN dm.device_type = 'ROUTERBOARD' THEN 'ROUTER'
                 WHEN dm.device_type = 'SWITCH' THEN 'SWITCH'
               END AS kind,
               dc.http_username,
               dc.http_password,
               dc.http_port,
               dc.ssh_port
        FROM devices d
        JOIN device_models dm ON dm.id = d.device_model_id
        JOIN vendors v ON v.id = dm.vendor_id
        LEFT JOIN wireless_polling_configurations wpc
          ON wpc.device_id = d.id
        LEFT JOIN device_credentials dc ON dc.device_id = d.id
        WHERE d.deleted_at IS NULL
          AND ${where}
        ORDER BY d.name, d.id
      `;
      return Result.ok(rows.map((r) => this.toCandidate(r)));
    } catch (error) {
      return Result.fail(
        `${errorPrefix}: ${(error as Error).message}`
      );
    }
  }

  // On site the server reads every device itself, behind an agent or not,
  // as wireless polling does (WLS-029).
  private reachOf(row: CandidateRow): BackupReach {
    if (this.serverOnSite) return { by: 'server' };
    return row.agent_id
      ? { by: 'agent', agentId: row.agent_id }
      : { by: 'none' };
  }

  private toCandidate(row: CandidateRow): BackupCandidate {
    const hasLogin =
      row.http_username !== null && row.http_password !== null;
    return {
      deviceId: row.device_id,
      deviceName: row.device_name,
      ipAddress: row.ip_address,
      vendorSlug: row.vendor_slug,
      kind: row.kind,
      reach: this.reachOf(row),
      credentials: hasLogin
        ? {
            username: row.http_username!,
            password: CredentialsEncryption.decrypt(
              row.http_password!
            ),
            httpPort: row.http_port ?? 443,
            sshPort: row.ssh_port ?? 22
          }
        : null
    };
  }
}
