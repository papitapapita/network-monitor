import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { IRouterHealthThresholdsRepository } from 'domain/device-monitoring/repository';
import { RouterHealthThresholds } from 'domain/device-monitoring/value-objects';

const ROW_ID = 1;

// Read on every check rather than cached, so a save from the dashboard
// reaches the next check with no restart.
export class PrismaRouterHealthThresholdsRepository
  implements IRouterHealthThresholdsRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<Result<RouterHealthThresholds>> {
    try {
      const row = await this.prisma.routerHealthThresholds.findUnique(
        {
          where: { id: ROW_ID }
        }
      );
      if (!row) return Result.ok(RouterHealthThresholds.defaults());
      return Result.ok(
        RouterHealthThresholds.reconstitute({
          cpuPercent: row.cpuPercent,
          minFreeMemoryPercent: row.minFreeMemoryPercent,
          minFreeDiskPercent: row.minFreeDiskPercent,
          maxTemperatureC: row.maxTemperatureC,
          minVoltage: row.minVoltage,
          flapLinkDowns: row.flapLinkDowns,
          minSfpRxPowerDbm: row.minSfpRxPowerDbm
        })
      );
    } catch (error) {
      return Result.fail(
        `Database error reading router health thresholds: ${(error as Error).message}`
      );
    }
  }

  async save(
    thresholds: RouterHealthThresholds
  ): Promise<Result<void>> {
    const data = thresholds.values;
    try {
      await this.prisma.routerHealthThresholds.upsert({
        where: { id: ROW_ID },
        create: { id: ROW_ID, ...data },
        update: data
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving router health thresholds: ${(error as Error).message}`
      );
    }
  }
}
