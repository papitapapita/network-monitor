import { PrismaClient } from 'generated/prisma/client';
import { Result } from 'domain/shared/core';
import { IVendorSettingsRepository } from 'domain/shared/interfaces';
import { VendorSettings } from 'domain/shared/value-objects';

const ROW_ID = 1;

// Read on every use rather than cached: a single-row primary-key lookup, and a
// payment recorded from the dashboard must unlock the install at once.
export class PrismaVendorSettingsRepository
  implements IVendorSettingsRepository
{
  constructor(
    private readonly prisma: PrismaClient,
    private readonly defaults: VendorSettings
  ) {}

  async get(): Promise<Result<VendorSettings>> {
    try {
      const row = await this.prisma.vendorSettings.findUnique({
        where: { id: ROW_ID }
      });
      if (!row) return Result.ok(this.defaults);
      return Result.ok(
        VendorSettings.reconstitute({
          vendorTelegramChatId: row.vendorTelegramChatId,
          // A DATE column comes back as UTC midnight of that day.
          subscriptionPaidUntil:
            row.subscriptionPaidUntil?.toISOString().slice(0, 10) ??
            null,
          subscriptionGraceDays: row.subscriptionGraceDays,
          subscriptionReadOnlyDays: row.subscriptionReadOnlyDays,
          pingResultRetentionDays: row.pingResultRetentionDays,
          alertRetentionDays: row.alertRetentionDays,
          wirelessSnapshotRetentionDays:
            row.wirelessSnapshotRetentionDays,
          wirelessAlertRecordRetentionDays:
            row.wirelessAlertRecordRetentionDays
        })
      );
    } catch (error) {
      return Result.fail(
        `Database error reading vendor settings: ${(error as Error).message}`
      );
    }
  }

  async save(settings: VendorSettings): Promise<Result<void>> {
    const data = {
      vendorTelegramChatId: settings.vendorTelegramChatId,
      subscriptionPaidUntil: settings.subscriptionPaidUntil
        ? new Date(`${settings.subscriptionPaidUntil}T00:00:00.000Z`)
        : null,
      subscriptionGraceDays: settings.subscriptionGraceDays,
      subscriptionReadOnlyDays: settings.subscriptionReadOnlyDays,
      pingResultRetentionDays: settings.pingResultRetentionDays,
      alertRetentionDays: settings.alertRetentionDays,
      wirelessSnapshotRetentionDays:
        settings.wirelessSnapshotRetentionDays,
      wirelessAlertRecordRetentionDays:
        settings.wirelessAlertRecordRetentionDays
    };
    try {
      await this.prisma.vendorSettings.upsert({
        where: { id: ROW_ID },
        create: { id: ROW_ID, ...data },
        update: data
      });
      return Result.ok();
    } catch (error) {
      return Result.fail(
        `Database error saving vendor settings: ${(error as Error).message}`
      );
    }
  }
}
