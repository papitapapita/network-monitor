import { Result } from 'domain/shared/core';
import { ITestMessageSender } from 'application/notifications/interfaces';
import { TelegramNotificationService } from './TelegramNotificationService';

export class TelegramTestMessageSender implements ITestMessageSender {
  constructor(
    private readonly telegram: TelegramNotificationService
  ) {}

  send(chatId: string, text: string): Promise<Result<void>> {
    return this.telegram.sendTo(chatId, text);
  }
}
