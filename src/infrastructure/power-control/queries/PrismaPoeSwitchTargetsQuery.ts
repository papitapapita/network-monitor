import { Prisma, PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { InventoryDevice } from 'domain/power-control';
import {
  IPoeSwitchTargetsQuery,
  PoePoweredDevice,
  PoeSite,
  PoeSwitchCandidate,
  PoeSwitchFirmware,
  PoeSwitchReach
} from 'application/power-control/interfaces';
import { CredentialsEncryption } from '../../crypto';

interface SwitchRow {
  device_id: string;
  device_name: string;
  ip_address: string | null;
  firmware: PoeSwitchFirmware;
  agent_id: string | null;
  http_username: string | null;
  http_password: string | null;
  api_port: number | null;
  http_port: number | null;
}

interface DeviceRow {
  device_id: string;
  device_name: string;
  ip_address: string | null;
  location_id: string | null;
  location_name: string | null;
}

export class PrismaPoeSwitchTargetsQuery
  implements IPoeSwitchTargetsQuery
{
  constructor(
    private readonly prisma: PrismaClient,
    // Off site the server reaches no switch itself (PWR-013).
    private readonly serverOnSite: boolean
  ) {}

  async findSite(
    locationId: string
  ): Promise<Result<PoeSite | null>> {
    try {
      const location = await this.prisma.location.findUnique({
        where: { id: locationId },
        select: { id: true, name: true }
      });
      return Result.ok(
        location
          ? { locationId: location.id, locationName: location.name }
          : null
      );
    } catch (error) {
      return Result.fail(
        `Database error finding location: ${(error as Error).message}`
      );
    }
  }

  async listSwitchSites(): Promise<Result<string[]>> {
    try {
      const rows = await this.prisma.$queryRaw<
        { location_id: string }[]
      >`
        SELECT DISTINCT d.location_id::text AS location_id
        FROM devices d
        JOIN device_models dm ON dm.id = d.device_model_id
        WHERE d.deleted_at IS NULL
          AND d.location_id IS NOT NULL
          AND dm.poe_switch_os IS NOT NULL
          AND d.status IN ('ACTIVE', 'COMMISSIONING')
        ORDER BY location_id
      `;
      return Result.ok(rows.map((r) => r.location_id));
    } catch (error) {
      return Result.fail(
        `Database error listing PoE switch sites: ${(error as Error).message}`
      );
    }
  }

  // PWR-010: devices whose model is marked as a PoE switch, in service.
  async listSwitchesAtSite(
    locationId: string
  ): Promise<Result<PoeSwitchCandidate[]>> {
    try {
      const rows = await this.prisma.$queryRaw<SwitchRow[]>`
        SELECT d.id AS device_id,
               d.name AS device_name,
               d.ip_address,
               dm.poe_switch_os::text AS firmware,
               d.agent_id::text AS agent_id,
               dc.http_username,
               dc.http_password,
               dc.api_port,
               dc.http_port
        FROM devices d
        JOIN device_models dm ON dm.id = d.device_model_id
        LEFT JOIN device_credentials dc ON dc.device_id = d.id
        WHERE d.deleted_at IS NULL
          AND d.location_id = ${locationId}::uuid
          AND dm.poe_switch_os IS NOT NULL
          AND d.status IN ('ACTIVE', 'COMMISSIONING')
        ORDER BY d.name, d.id
      `;
      return Result.ok(rows.map((r) => this.toCandidate(r)));
    } catch (error) {
      return Result.fail(
        `Database error listing PoE switches: ${(error as Error).message}`
      );
    }
  }

  async findDevice(
    deviceId: string
  ): Promise<Result<PoePoweredDevice | null>> {
    try {
      const rows = await this.selectDevices(
        Prisma.sql`d.id = ${deviceId}::uuid`
      );
      const row = rows[0];
      return Result.ok(
        row
          ? {
              deviceId: row.device_id,
              deviceName: row.device_name,
              ipAddress: row.ip_address,
              locationId: row.location_id
            }
          : null
      );
    } catch (error) {
      return Result.fail(
        `Database error finding device: ${(error as Error).message}`
      );
    }
  }

  async findDevicesByIps(
    ips: string[]
  ): Promise<Result<InventoryDevice[]>> {
    if (ips.length === 0) return Result.ok([]);
    try {
      const rows = await this.selectDevices(
        Prisma.sql`d.ip_address IN (${Prisma.join(ips)})`
      );
      return Result.ok(
        rows.map((r) => ({
          deviceId: r.device_id,
          deviceName: r.device_name,
          ipAddress: r.ip_address!,
          locationId: r.location_id,
          locationName: r.location_name
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error finding devices by IP: ${(error as Error).message}`
      );
    }
  }

  private selectDevices(where: Prisma.Sql): Promise<DeviceRow[]> {
    return this.prisma.$queryRaw<DeviceRow[]>`
      SELECT d.id AS device_id,
             d.name AS device_name,
             d.ip_address,
             d.location_id::text AS location_id,
             l.name AS location_name
      FROM devices d
      LEFT JOIN locations l ON l.id = d.location_id
      WHERE d.deleted_at IS NULL
        AND ${where}
      ORDER BY d.name, d.id
    `;
  }

  // On site the server reads every switch itself, behind an agent or not,
  // as backups do (BKP-015).
  private reachOf(row: SwitchRow): PoeSwitchReach {
    if (this.serverOnSite) return { by: 'server' };
    return row.agent_id
      ? { by: 'agent', agentId: row.agent_id }
      : { by: 'none' };
  }

  private toCandidate(row: SwitchRow): PoeSwitchCandidate {
    const hasLogin =
      row.http_username !== null && row.http_password !== null;
    return {
      deviceId: row.device_id,
      deviceName: row.device_name,
      ipAddress: row.ip_address,
      firmware: row.firmware,
      reach: this.reachOf(row),
      login: hasLogin
        ? {
            username: row.http_username!,
            password: CredentialsEncryption.decrypt(
              row.http_password!
            ),
            apiPort: row.api_port ?? 8728,
            httpPort: row.http_port ?? 443
          }
        : null
    };
  }
}
