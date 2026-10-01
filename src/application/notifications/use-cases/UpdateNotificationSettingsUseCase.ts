import { Result } from 'domain/shared/core';
import { INotificationSettingsRepository } from 'domain/notifications/repository';
import { NotificationSettings } from 'domain/notifications/value-objects';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import { NotificationSettingsDTO } from '../dtos';
import { NotificationSettingsMapper } from '../mappers';

// Replaced as a whole: the screen shows every setting and saves them together.
// Takes effect on the next alert, with no restart (NOT-200).
export class UpdateNotificationSettingsUseCase extends UseCase<
  NotificationSettingsDTO,
  NotificationSettingsDTO
> {
  constructor(
    private readonly repository: INotificationSettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateNotificationSettingsUseCase');
  }

  protected async executeImpl(
    request: NotificationSettingsDTO
  ): Promise<Result<NotificationSettingsDTO>> {
    const settings = NotificationSettings.create({
      telegramChatId: request.telegramChatId,
      downAlertDelayMinutes: request.downAlertDelayMinutes,
      wirelessAlertsEnabled: request.wirelessAlertsEnabled
    });
    if (settings.isFailure) return this.fail(settings.error);

    const saved = await this.repository.save(settings.value);
    if (saved.isFailure) {
      return this.fail(
        `Failed to save notification settings: ${saved.error}`
      );
    }
    return this.ok(NotificationSettingsMapper.toDTO(settings.value));
  }
}
