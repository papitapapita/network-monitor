import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import {
  BackupCandidate,
  BackupDeviceKind,
  IBackupTargetsQuery
} from 'application/device-backups/interfaces';
import { CredentialsEncryption } from '../../crypto';

interface CandidateRow {
  device_id: string;
  device_name: string;
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
    // Off site the server reaches no device itself; agents come in phase 2.
    private readonly serverOnSite: boolean
  ) {}

  // BKP-010: the access points wireless monitoring polls, and the routers
  // and switches, in service.
  async listScheduled(): Promise<Result<BackupCandidate[]>> {
    if (!this.serverOnSite) return Result.ok([]);
    return this.select(
      Prisma.sql`
        (
          (wpc.device_type = 'ACCESS_POINT' AND wpc.enabled = true)
          OR dm.device_type IN ('ROUTER', 'ROUTERBOARD', 'SWITCH')
        )
        AND d.status IN ('ACTIVE', 'COMMISSIONING')
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
               COALESCE(wpc.ip_address, d.ip_address) AS ip_address,
               v.slug AS vendor_slug,
               CASE
                 WHEN wpc.device_type = 'ACCESS_POINT' THEN 'ACCESS_POINT'
                 WHEN dm.device_type IN ('ROUTER', 'ROUTERBOARD')
                   THEN 'ROUTER'
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

  private toCandidate(row: CandidateRow): BackupCandidate {
    const hasLogin =
      row.http_username !== null && row.http_password !== null;
    return {
      deviceId: row.device_id,
      deviceName: row.device_name,
      ipAddress: row.ip_address,
      vendorSlug: row.vendor_slug,
      kind: row.kind,
      reachable: this.serverOnSite,
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
