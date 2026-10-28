import { Result } from 'domain/shared/core';
import { IDiscoverySettingsRepository } from 'domain/device-inventory/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { DiscoverySettingsDTO } from '../dtos';
import { DiscoverySettingsMapper } from '../mappers';

export class GetDiscoverySettingsUseCase extends UseCase<
  Record<string, never>,
  DiscoverySettingsDTO
> {
  constructor(
    private readonly repository: IDiscoverySettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetDiscoverySettingsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<DiscoverySettingsDTO>
  > {
    const settings = await this.repository.get();
    if (settings.isFailure) {
      return this.fail(
        `Failed to load discovery settings: ${settings.error}`
      );
    }
    const lastRunAt = await this.repository.lastRunAt();
    if (lastRunAt.isFailure) {
      return this.fail(
        `Failed to load discovery settings: ${lastRunAt.error}`
      );
    }
    return this.ok(
      DiscoverySettingsMapper.toDTO(settings.value, lastRunAt.value)
    );
  }
}
