import { Result } from 'domain/shared/core';
import { IBillingSettingsRepository } from 'domain/billing/repository';
import { BillingSettings } from 'domain/billing/value-objects';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BillingSettingsDTO } from '../dtos';
import { BillingSettingsMapper } from '../mappers';

// Replaced as a whole; the next daily run reads it (BIL-280).
export class UpdateBillingSettingsUseCase extends UseCase<
  BillingSettingsDTO,
  BillingSettingsDTO
> {
  constructor(
    private readonly repository: IBillingSettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateBillingSettingsUseCase');
  }

  protected async executeImpl(
    request: BillingSettingsDTO
  ): Promise<Result<BillingSettingsDTO>> {
    const settings = BillingSettings.create({
      automaticBillingEnabled: request.automaticBillingEnabled,
      billingMode: request.billingMode,
      issueLeadDays: request.issueLeadDays,
      graceDays: request.graceDays,
      automaticCutEnabled: request.automaticCutEnabled,
      reminderWhatsAppTemplate: request.reminderWhatsAppTemplate
    });
    if (settings.isFailure) return this.fail(settings.error);

    const saved = await this.repository.save(settings.value);
    if (saved.isFailure) {
      return this.fail(
        `Failed to save billing settings: ${saved.error}`
      );
    }
    return this.ok(BillingSettingsMapper.toDTO(settings.value));
  }
}
