import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DiscoverySource } from 'domain/device-inventory/enums';
import { DiscoveredDeviceDTO } from 'application/device-inventory/dtos';
import { IDiscoveredDeviceListQuery } from 'application/device-inventory/interfaces';

type Row = {
  id: string;
  mac_address: string;
  ip_address: string | null;
  manufacturer: string | null;
  source: DiscoverySource;
  segment: string | null;
  first_seen_at: Date;
  last_seen_at: Date;
  ignored_at: Date | null;
};

export class PrismaDiscoveredDeviceListQuery
  implements IDiscoveredDeviceListQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async list(
    ignored: boolean
  ): Promise<Result<DiscoveredDeviceDTO[]>> {
    try {
      const rows = await this.prisma.$queryRaw<Row[]>`
        SELECT dd.id::text, dd.mac_address, dd.ip_address, dd.manufacturer,
               dd.source::text AS source, dd.segment, dd.first_seen_at,
               dd.last_seen_at, dd.ignored_at
        FROM discovered_devices dd
        WHERE (dd.ignored_at IS NOT NULL) = ${ignored}
          AND NOT EXISTS (
            SELECT 1 FROM devices d
            WHERE d.deleted_at IS NULL
              AND (d.mac_address = dd.mac_address
                   OR (dd.ip_address IS NOT NULL
                       AND d.ip_address = dd.ip_address))
          )
        ORDER BY dd.last_seen_at DESC, dd.mac_address
      `;
      return Result.ok(
        rows.map((r) => ({
          id: r.id,
          macAddress: r.mac_address,
          ipAddress: r.ip_address,
          manufacturer: r.manufacturer,
          source: r.source,
          segment: r.segment,
          firstSeenAt: r.first_seen_at.toISOString(),
          lastSeenAt: r.last_seen_at.toISOString(),
          ignoredAt: r.ignored_at?.toISOString() ?? null
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error listing discovered devices: ${(error as Error).message}`
      );
    }
  }
}
