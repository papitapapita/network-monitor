import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { BillingMode } from 'domain/billing/enums';
import { BillingSettings } from 'domain/billing/value-objects';
import { IBillingSettingsRepository } from 'domain/billing/repository';

const ROW_ID = 1;

// Read on every run rather than cached: a save from the dashboard must reach
// the next daily run with no restart.
export class PrismaBillingSettingsRepository
  implements IBillingSettingsRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  async get(): Promise<Result<BillingSettings>> {
    try {
      const row = await this.prisma.billingSettings.findUnique({
        where: { id: ROW_ID }
      });
      if (!row) return Result.ok(BillingSettings.defaults());
      return Result.ok(
        BillingSettings.reconstitute({
          automaticBillingEnabled: row.automaticBillingEnabled,
          billingMode: row.billingMode as BillingMode,
          issueLeadDays: row.issueLeadDays,
          graceDays: row.graceDays,
          automaticCutEnabled: row.automaticCutEnabled
        })
      );
    } catch (error) {
      return Result.fail(
        `Database error reading billing settings: ${(error as Error).message}`
      );
    }
  }

  async save(settings: BillingSettings): Promise<Result<void>> {
    const data = {
      automaticBillingEnabled: settings.automaticBillingEnabled,
      billingMode: settings.billingMode,
      issueLeadDays: settings.issueLeadDays,
      graceDays: settings.graceDays,
      automaticCutEnabled: settings.automaticCutEnabled
    };
    try {
      await this.prisma.billingSettings.upsert({
        where: { id: ROW_ID },
        create: { id: ROW_ID, ...data },
        update: data
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving billing settings: ${(error as Error).message}`
      );
    }
  }
}
