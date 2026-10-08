import { PrismaClient, Prisma } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { DeviceId } from 'domain/shared/ids';
import { IAlertThresholdsRepository } from 'domain/wireless-monitoring/repository';
import {
  AlertThresholds,
  AlertThresholdOverrides
} from 'domain/wireless-monitoring/value-objects';
import {
  AlertThresholdsProps,
  AlertThresholdOverridesProps
} from 'domain/wireless-monitoring/props';

const ROW_ID = 1;

// Read on every poll rather than cached: a primary-key lookup, and a save
// from the dashboard must reach the next poll with no restart.
export class PrismaAlertThresholdsRepository
  implements IAlertThresholdsRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async getGlobal(): Promise<Result<AlertThresholds>> {
    try {
      const row =
        await this.prisma.wirelessAlertThresholds.findUnique({
          where: { id: ROW_ID }
        });
      const defaults = AlertThresholds.defaults();
      if (!row) return Result.ok(defaults);
      // Spread per group, not withOverrides: a width the operator removed
      // from a table must stay removed.
      return Result.ok(
        AlertThresholds.reconstitute({
          ...defaults.values,
          ...(row.thresholds as Partial<AlertThresholdsProps>)
        })
      );
    } catch (error) {
      return Result.fail(
        `Database error reading alert thresholds: ${(error as Error).message}`
      );
    }
  }

  async saveGlobal(
    thresholds: AlertThresholds
  ): Promise<Result<void>> {
    const data = {
      thresholds:
        thresholds.values as unknown as Prisma.InputJsonValue
    };
    try {
      await this.prisma.wirelessAlertThresholds.upsert({
        where: { id: ROW_ID },
        create: { id: ROW_ID, ...data },
        update: data
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving alert thresholds: ${(error as Error).message}`
      );
    }
  }

  async findOverrides(
    deviceId: DeviceId
  ): Promise<Result<AlertThresholdOverrides>> {
    try {
      const row =
        await this.prisma.wirelessAlertThresholdOverride.findUnique({
          where: { deviceId: deviceId.toString() }
        });
      if (!row) return Result.ok(AlertThresholdOverrides.none());
      return Result.ok(
        AlertThresholdOverrides.reconstitute(
          row.overrides as AlertThresholdOverridesProps
        )
      );
    } catch (error) {
      return Result.fail(
        `Database error reading alert threshold overrides: ${(error as Error).message}`
      );
    }
  }

  async saveOverrides(
    deviceId: DeviceId,
    overrides: AlertThresholdOverrides
  ): Promise<Result<void>> {
    const id = deviceId.toString();
    try {
      if (overrides.isEmpty) {
        await this.prisma.wirelessAlertThresholdOverride.deleteMany({
          where: { deviceId: id }
        });
        return Result.ok();
      }
      const data = {
        overrides:
          overrides.values as unknown as Prisma.InputJsonValue
      };
      await this.prisma.wirelessAlertThresholdOverride.upsert({
        where: { deviceId: id },
        create: { deviceId: id, ...data },
        update: data
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving alert threshold overrides: ${(error as Error).message}`
      );
    }
  }
}
