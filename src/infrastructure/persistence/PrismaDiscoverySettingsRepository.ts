import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DiscoverySegment } from 'domain/device-inventory/props';
import { DiscoverySettings } from 'domain/device-inventory/value-objects';
import { IDiscoverySettingsRepository } from 'domain/device-inventory/repository';

const ROW_ID = 1;

// Read on every check rather than cached: a save from the dashboard must
// reach the next scheduled run with no restart.
export class PrismaDiscoverySettingsRepository
  implements IDiscoverySettingsRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<Result<DiscoverySettings>> {
    try {
      const row = await this.prisma.discoverySettings.findUnique({
        where: { id: ROW_ID }
      });
      if (!row) return Result.ok(DiscoverySettings.defaults());
      return Result.ok(
        DiscoverySettings.reconstitute({
          enabled: row.enabled,
          intervalHours: row.intervalHours,
          segments: row.segments as unknown as DiscoverySegment[]
        })
      );
    } catch (error) {
      return Result.fail(
        `Database error reading discovery settings: ${(error as Error).message}`
      );
    }
  }

  async save(settings: DiscoverySettings): Promise<Result<void>> {
    const data = {
      enabled: settings.enabled,
      intervalHours: settings.intervalHours,
      segments: settings.segments.map((s) => ({
        cidr: s.cidr,
        agentId: s.agentId
      }))
    };
    try {
      await this.prisma.discoverySettings.upsert({
        where: { id: ROW_ID },
        create: { id: ROW_ID, ...data },
        update: data
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving discovery settings: ${(error as Error).message}`
      );
    }
  }

  async lastRunAt(): Promise<Result<Date | null>> {
    try {
      const row = await this.prisma.discoverySettings.findUnique({
        where: { id: ROW_ID },
        select: { lastRunAt: true }
      });
      return Result.ok(row?.lastRunAt ?? null);
    } catch (error) {
      return Result.fail(
        `Database error reading the last discovery run: ${(error as Error).message}`
      );
    }
  }

  async recordRun(startedAt: Date): Promise<Result<void>> {
    try {
      await this.prisma.discoverySettings.updateMany({
        where: { id: ROW_ID },
        data: { lastRunAt: startedAt }
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error recording the discovery run: ${(error as Error).message}`
      );
    }
  }
}
