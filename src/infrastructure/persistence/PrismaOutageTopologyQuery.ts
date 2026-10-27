import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IOutageTopologyQuery,
  OutageDeviceDTO
} from 'application/notifications/interfaces';

// Every walk is capped: loops are refused when a link is made (DEV-182), but
// two concurrent edits can still close one, and these must terminate anyway.
const MAX_DEPTH = 64;

export class PrismaOutageTopologyQuery
  implements IOutageTopologyQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  public async findUpstreamIds(
    deviceId: string
  ): Promise<Result<string[]>> {
    try {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE chain(id, upstream_device_id, depth) AS (
          SELECT d.id, d.upstream_device_id, 0
          FROM devices d
          WHERE d.id = ${deviceId}::uuid
          UNION ALL
          SELECT u.id, u.upstream_device_id, c.depth + 1
          FROM chain c
          JOIN devices u ON u.id = c.upstream_device_id
          WHERE u.deleted_at IS NULL AND c.depth < ${MAX_DEPTH}
        )
        SELECT id::text AS id FROM chain WHERE depth > 0 ORDER BY depth
      `;
      return Result.ok(rows.map((r) => r.id));
    } catch (error) {
      return Result.fail(
        `Database error reading the upstream chain: ${(error as Error).message}`
      );
    }
  }

  public async findDownstream(
    deviceId: string
  ): Promise<Result<OutageDeviceDTO[]>> {
    try {
      const rows = await this.prisma.$queryRaw<
        {
          id: string;
          name: string;
          ip_address: string | null;
          upstream_device_id: string | null;
        }[]
      >`
        WITH RECURSIVE subtree(id, depth, path) AS (
          SELECT d.id, 1, ARRAY[${deviceId}::uuid, d.id]
          FROM devices d
          WHERE d.upstream_device_id = ${deviceId}::uuid
            AND d.deleted_at IS NULL
          UNION ALL
          SELECT d.id, s.depth + 1, s.path || d.id
          FROM subtree s
          JOIN devices d ON d.upstream_device_id = s.id
          WHERE d.deleted_at IS NULL
            AND s.depth < ${MAX_DEPTH}
            AND NOT d.id = ANY(s.path)
        )
        SELECT DISTINCT d.id::text AS id, d.name, d.ip_address,
               d.upstream_device_id::text AS upstream_device_id
        FROM subtree s
        JOIN devices d ON d.id = s.id
      `;
      return Result.ok(rows.map(toDTO));
    } catch (error) {
      return Result.fail(
        `Database error reading the downstream devices: ${(error as Error).message}`
      );
    }
  }

  public async findByIds(
    deviceIds: string[]
  ): Promise<Result<OutageDeviceDTO[]>> {
    if (deviceIds.length === 0) return Result.ok([]);
    try {
      const records = await this.prisma.device.findMany({
        where: { id: { in: deviceIds } },
        select: {
          id: true,
          name: true,
          ipAddress: true,
          upstreamDeviceId: true
        }
      });
      return Result.ok(
        records.map((r) => ({
          deviceId: r.id,
          name: r.name,
          ipAddress: r.ipAddress,
          upstreamDeviceId: r.upstreamDeviceId
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error reading devices: ${(error as Error).message}`
      );
    }
  }
}

function toDTO(row: {
  id: string;
  name: string;
  ip_address: string | null;
  upstream_device_id: string | null;
}): OutageDeviceDTO {
  return {
    deviceId: row.id,
    name: row.name,
    ipAddress: row.ip_address,
    upstreamDeviceId: row.upstream_device_id
  };
}
