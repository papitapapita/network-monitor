import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import {
  IReportedApQuery,
  ReportedApRow
} from 'application/device-inventory/interfaces';

interface Row {
  station_id: string;
  collected_at: Date | null;
  mac_match: string | null;
  ip_match: string | null;
}

// DEV-190: the AP named by each station's latest reading — by the AP's MAC
// when the poll matched one, else by the IP the radio reports (resolved the
// same way as the identity suggestion, WLS-151).
export class PrismaReportedApQuery implements IReportedApQuery {
  constructor(private readonly prisma: PrismaClient) {}

  async findReportedAps(): Promise<Result<ReportedApRow[]>> {
    try {
      const rows = await this.prisma.$queryRaw<Row[]>`
        SELECT c.device_id::text AS station_id,
               s.collected_at,
               s.remote_ap_device_id::text AS mac_match,
               (SELECT d.id::text
                  FROM devices d
                 WHERE d.ip_address = s.remote_ap_ip
                   AND d.deleted_at IS NULL
                 LIMIT 1) AS ip_match
        FROM wireless_polling_configurations c
        JOIN devices sd ON sd.id = c.device_id AND sd.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT ws.collected_at, ws.remote_ap_device_id, ws.remote_ap_ip
          FROM wireless_snapshots ws
          WHERE ws.device_id = c.device_id
          ORDER BY ws.collected_at DESC
          LIMIT 1
        ) s ON TRUE
        WHERE c.device_type = 'STATION'
      `;
      return Result.ok(
        rows.map((r) => ({
          stationId: r.station_id,
          apDeviceId: r.mac_match ?? r.ip_match,
          matchedBy: r.mac_match ? 'MAC' : r.ip_match ? 'IP' : null,
          observedAt: r.collected_at
        }))
      );
    } catch (error) {
      return Result.fail(
        `Database error reading the APs stations report: ${(error as Error).message}`
      );
    }
  }
}
