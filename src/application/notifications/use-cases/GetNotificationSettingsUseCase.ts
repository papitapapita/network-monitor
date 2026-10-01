import { Result } from 'domain/shared/core';
import { INotificationSettingsRepository } from 'domain/notifications/repository';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { NotificationSettingsDTO } from '../dtos';
import { NotificationSettingsMapper } from '../mappers';

export class GetNotificationSettingsUseCase extends UseCase<
  Record<string, never>,
  NotificationSettingsDTO
> {
  constructor(
    private readonly repository: INotificationSettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'GetNotificationSettingsUseCase');
  }

  protected async executeImpl(): Promise<
    Result<NotificationSettingsDTO>
  > {
    const result = await this.repository.get();
    if (result.isFailure) {
      return this.fail(
        `Failed to load notification settings: ${result.error}`
      );
    }
    return this.ok(NotificationSettingsMapper.toDTO(result.value));
  }
}
