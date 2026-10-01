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
            row.wirelessAlertRecordRetentionDays,
          // A group is saved all or nothing; one column answers for it.
          issuer:
            row.issuerName === null
              ? null
              : {
                  name: row.issuerName,
                  documentLabel: row.issuerDocumentLabel!,
                  document: row.issuerDocument!,
                  address: row.issuerAddress!,
                  city: row.issuerCity!,
                  contactPhone: row.issuerContactPhone!,
                  contactEmail: row.issuerContactEmail!,
                  accentColorHex: row.issuerAccentColorHex!
                },
          whatsApp:
            row.whatsAppPhoneNumberId === null
              ? null
              : {
                  phoneNumberId: row.whatsAppPhoneNumberId,
                  templateName: row.whatsAppTemplateName!,
                  templateLanguage: row.whatsAppTemplateLanguage!,
                  apiVersion: row.whatsAppApiVersion!
                },
          enforcementRouter:
            row.enforcementRouterDeviceId === null
              ? null
              : {
                  deviceId: row.enforcementRouterDeviceId,
                  apiPort: row.enforcementRouterApiPort!
                }
        })
      );
    } catch (error) {
      return Result.fail(
        `Database error reading vendor settings: ${(error as Error).message}`
      );
    }
  }

  async save(settings: VendorSettings): Promise<Result<void>> {
    const { issuer, whatsApp, enforcementRouter: router } = settings;
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
        settings.wirelessAlertRecordRetentionDays,
      issuerName: issuer?.name ?? null,
      issuerDocumentLabel: issuer?.documentLabel ?? null,
      issuerDocument: issuer?.document ?? null,
      issuerAddress: issuer?.address ?? null,
      issuerCity: issuer?.city ?? null,
      issuerContactPhone: issuer?.contactPhone ?? null,
      issuerContactEmail: issuer?.contactEmail ?? null,
      issuerAccentColorHex: issuer?.accentColorHex ?? null,
      whatsAppPhoneNumberId: whatsApp?.phoneNumberId ?? null,
      whatsAppTemplateName: whatsApp?.templateName ?? null,
      whatsAppTemplateLanguage: whatsApp?.templateLanguage ?? null,
      whatsAppApiVersion: whatsApp?.apiVersion ?? null,
      enforcementRouterDeviceId: router?.deviceId ?? null,
      enforcementRouterApiPort: router?.apiPort ?? null
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
