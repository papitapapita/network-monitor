import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { IReportedOutageQuery } from 'application/device-monitoring/interfaces';

const DOWN_ALERT_TYPE = 'device_unreachable';

export class PrismaReportedOutageQuery
  implements IReportedOutageQuery
{
  constructor(private readonly prisma: PrismaClient) {}

  async wasReportedDown(
    deviceId: string,
    from: Date,
    to: Date
  ): Promise<Result<boolean>> {
    try {
      const rows = await this.prisma.$queryRaw<
        { reported: boolean }[]
      >`
        SELECT EXISTS (
          SELECT 1
          FROM alert_events a
          LEFT JOIN alert_events root ON root.id = a.caused_by_alert_id
          WHERE a.device_id = ${deviceId}::uuid
            AND a.type = ${DOWN_ALERT_TYPE}
            AND a.started_at <= ${to}
            AND (a.resolved_at IS NULL OR a.resolved_at >= ${from})
            AND (a.notified_at IS NOT NULL OR root.notified_at IS NOT NULL)
        ) AS reported
      `;
      return Result.ok(rows[0]?.reported === true);
    } catch (error) {
      return Result.fail(
        `Database error reading down alerts: ${(error as Error).message}`
      );
    }
  }
}
