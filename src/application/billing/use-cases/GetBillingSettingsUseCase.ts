import { Result } from 'domain/shared/core';
import { IBillingSettingsRepository } from 'domain/billing/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { BillingSettingsDTO } from '../dtos';
import { BillingSettingsMapper } from '../mappers';

export class GetBillingSettingsUseCase extends UseCase<
  Record<string, never>,
  BillingSettingsDTO
> {
  constructor(
    private readonly repository: IBillingSettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetBillingSettingsUseCase');
  }

  protected async executeImpl(): Promise<Result<BillingSettingsDTO>> {
    const result = await this.repository.get();
    if (result.isFailure) {
      return this.fail(
        `Failed to load billing settings: ${result.error}`
      );
    }
    return this.ok(BillingSettingsMapper.toDTO(result.value));
  }
}
