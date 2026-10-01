import { Result } from 'domain/shared/core';
import { IVendorSettingsRepository } from 'domain/shared/interfaces';
import { VendorSettings } from 'domain/shared/value-objects';
import { UseCase } from '../core';
import { ILogger } from '../interfaces';
import { VendorSettingsDTO } from '../dtos';

export function toVendorSettingsDTO(
  settings: VendorSettings
): VendorSettingsDTO {
  return {
    vendorTelegramChatId: settings.vendorTelegramChatId,
    subscriptionPaidUntil: settings.subscriptionPaidUntil,
    subscriptionGraceDays: settings.subscriptionGraceDays,
    subscriptionReadOnlyDays: settings.subscriptionReadOnlyDays,
    pingResultRetentionDays: settings.pingResultRetentionDays,
    alertRetentionDays: settings.alertRetentionDays,
    wirelessSnapshotRetentionDays:
      settings.wirelessSnapshotRetentionDays,
    wirelessAlertRecordRetentionDays:
      settings.wirelessAlertRecordRetentionDays,
    issuer: settings.issuer ? { ...settings.issuer } : null,
    whatsApp: settings.whatsApp ? { ...settings.whatsApp } : null,
    enforcementRouter: settings.enforcementRouter
      ? { ...settings.enforcementRouter }
      : null
  };
}

export class GetVendorSettingsUseCase extends UseCase<
  Record<string, never>,
  VendorSettingsDTO
> {
  constructor(
    private readonly repository: IVendorSettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetVendorSettingsUseCase');
  }

  protected async executeImpl(): Promise<Result<VendorSettingsDTO>> {
    const result = await this.repository.get();
    if (result.isFailure) {
      return this.fail(
        `Failed to load vendor settings: ${result.error}`
      );
    }
    return this.ok(toVendorSettingsDTO(result.value));
  }
}
