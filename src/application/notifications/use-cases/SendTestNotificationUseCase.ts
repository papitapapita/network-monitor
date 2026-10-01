import { Result } from 'domain/shared/core';
import { INotificationSettingsRepository } from 'domain/notifications/repository';
import { NotificationSettings } from 'domain/notifications/value-objects';
import { UseCase } from 'application/shared/core';
import { ILogger } from 'application/shared/interfaces';
import {
  SendTestNotificationDTO,
  SendTestNotificationResponseDTO
} from '../dtos';
import { ITestMessageSender } from '../interfaces';
import { TelegramFormatting } from '../shared';

export const NO_TELEGRAM_CHAT =
  'No Telegram chat is configured for this install';
export const TEST_MESSAGE_NOT_DELIVERED =
  'Test message not delivered';

// NOT-202: lets the administrator see a message arrive before relying on the
// chat for real alerts. Nothing is stored.
export class SendTestNotificationUseCase extends UseCase<
  SendTestNotificationDTO,
  SendTestNotificationResponseDTO
> {
  constructor(
    private readonly repository: INotificationSettingsRepository,
    private readonly sender: ITestMessageSender,
    logger: ILogger
  ) {
    super(logger, 'SendTestNotificationUseCase');
  }

  protected async executeImpl(
    request: SendTestNotificationDTO
  ): Promise<Result<SendTestNotificationResponseDTO>> {
    const current = await this.repository.get();
    if (current.isFailure) {
      return this.fail(
        `Failed to load notification settings: ${current.error}`
      );
    }

    let chatId = current.value.telegramChatId;
    if (request.telegramChatId !== undefined) {
      // Same check as saving it, so a chat that passes the test also saves.
      const candidate = NotificationSettings.create({
        telegramChatId: request.telegramChatId,
        downAlertDelayMinutes: current.value.downAlertDelayMinutes,
        wirelessAlertsEnabled: current.value.wirelessAlertsEnabled
      });
      if (candidate.isFailure) return this.fail(candidate.error);
      chatId = candidate.value.telegramChatId;
    }
    if (chatId === null) return this.fail(NO_TELEGRAM_CHAT);

    const text = TelegramFormatting.escapeMd(
      '✅ Mensaje de prueba: las alertas de la red llegarán a este chat.'
    );
    const sent = await this.sender.send(chatId, text);
    if (sent.isFailure) {
      return this.fail(
        `${TEST_MESSAGE_NOT_DELIVERED}: ${sent.error}`
      );
    }
    return this.ok({ telegramChatId: chatId });
  }
}
