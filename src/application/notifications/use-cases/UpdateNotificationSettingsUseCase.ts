import { Result } from 'domain/shared/core';
import { INotificationSettingsRepository } from 'domain/notifications/repository';
import {
  NotificationSettings,
  QuietHours
} from 'domain/notifications/value-objects';
import { AlertTicketMode } from 'domain/notifications/props';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  NotificationSettingsDTO,
  UpdateNotificationSettingsDTO
} from '../dtos';
import { NotificationSettingsMapper } from '../mappers';

// Replaced as a whole: the screen shows every setting and saves them together.
// Takes effect on the next alert, with no restart (NOT-200).
export class UpdateNotificationSettingsUseCase extends UseCase<
  UpdateNotificationSettingsDTO,
  NotificationSettingsDTO
> {
  constructor(
    private readonly repository: INotificationSettingsRepository,
    logger: ILogger
  ) {
    super(logger, 'UpdateNotificationSettingsUseCase');
  }

  protected async beforeExecute(
    request: UpdateNotificationSettingsDTO
  ): Promise<Result<void> | null> {
    const startOmitted = request.quietHoursStart === undefined;
    const endOmitted = request.quietHoursEnd === undefined;
    if (startOmitted !== endOmitted) {
      return Result.fail(
        'quietHoursStart and quietHoursEnd must be sent together'
      );
    }
    const hasStart = (request.quietHoursStart ?? null) !== null;
    const hasEnd = (request.quietHoursEnd ?? null) !== null;
    if (hasStart !== hasEnd) {
      return Result.fail(
        'quietHoursStart and quietHoursEnd must both be set, or both be null'
      );
    }
    return null;
  }

  protected async executeImpl(
    request: UpdateNotificationSettingsDTO
  ): Promise<Result<NotificationSettingsDTO>> {
    let alertTicketMode = request.alertTicketMode;
    let quietHours: QuietHours | null = null;
    if (
      alertTicketMode === undefined ||
      request.quietHoursStart === undefined
    ) {
      const current = await this.repository.get();
      if (current.isFailure) {
        return this.fail(
          `Failed to load notification settings: ${current.error}`
        );
      }
      alertTicketMode ??= current.value.alertTicketMode;
      quietHours = current.value.quietHours;
    }

    // beforeExecute guarantees start and end arrive, and are set, together.
    if (request.quietHoursStart !== undefined) {
      quietHours = null;
      if (request.quietHoursStart !== null) {
        const window = QuietHours.fromHHmm(
          request.quietHoursStart,
          request.quietHoursEnd!
        );
        if (window.isFailure) return this.fail(window.error);
        quietHours = window.value;
      }
    }

    const settings = NotificationSettings.create({
      telegramChatId: request.telegramChatId,
      downAlertDelayMinutes: request.downAlertDelayMinutes,
      wirelessAlertsEnabled: request.wirelessAlertsEnabled,
      // An unknown string is refused by NotificationSettings.validate.
      alertTicketMode: alertTicketMode as AlertTicketMode,
      quietHours
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
