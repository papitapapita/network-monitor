import { Result } from 'domain/shared/core';
import { IVendorSettingsRepository } from 'domain/shared/interfaces';
import { VendorSettings } from 'domain/shared/value-objects';
import { UseCase } from '../core';
import { ILogger } from '../interfaces';
import { VendorSettingsDTO } from '../dtos';
import { toVendorSettingsDTO } from './GetVendorSettingsUseCase';

// Replaced as a whole; applies from the next request, alert or purge with no
// restart (INS-028).
export class UpdateVendorSettingsUseCase extends UseCase<
  VendorSettingsDTO,
  VendorSettingsDTO
> {
  constructor(
    private readonly repository: IVendorSettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateVendorSettingsUseCase');
  }

  protected async executeImpl(
    request: VendorSettingsDTO
  ): Promise<Result<VendorSettingsDTO>> {
    const settings = VendorSettings.create({
      vendorTelegramChatId: request.vendorTelegramChatId,
      subscriptionPaidUntil: request.subscriptionPaidUntil,
      subscriptionGraceDays: request.subscriptionGraceDays,
      subscriptionReadOnlyDays: request.subscriptionReadOnlyDays,
      pingResultRetentionDays: request.pingResultRetentionDays,
      alertRetentionDays: request.alertRetentionDays,
      wirelessSnapshotRetentionDays:
        request.wirelessSnapshotRetentionDays,
      wirelessAlertRecordRetentionDays:
        request.wirelessAlertRecordRetentionDays
    });
    if (settings.isFailure) return this.fail(settings.error);

    const saved = await this.repository.save(settings.value);
    if (saved.isFailure) {
      return this.fail(
        `Failed to save vendor settings: ${saved.error}`
      );
    }
    return this.ok(toVendorSettingsDTO(settings.value));
  }
}
