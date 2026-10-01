import { Result } from 'domain/shared/core';
import {
  INotificationService,
  NotificationMessage
} from 'application/notifications/interfaces';

// Looked up on every send, so a chat changed from the dashboard (NOT-200)
// takes effect on the next alert. null means no chat is configured.
export type TelegramChatSource = () => Promise<string | null>;

export const NO_TELEGRAM_CHAT_CONFIGURED =
  'Telegram chat is not configured';

export class TelegramNotificationService
  implements INotificationService
{
  private readonly botToken: string;
  private readonly chatSource: TelegramChatSource;

  // A fixed chat id other than the install's own is the vendor chat (ADR
  // 0002, R6), which may be reached through the vendor's own bot (AGT-023).
  constructor(
    chat: string | TelegramChatSource | undefined = process.env
      .TELEGRAM_CHAT_ID,
    token: string | undefined = process.env.TELEGRAM_BOT_TOKEN
  ) {
    if (!token || !chat) {
      throw new Error(
        'TelegramNotificationService: a bot token and a chat id must be set in environment'
      );
    }

    this.botToken = token;
    this.chatSource =
      typeof chat === 'string' ? async () => chat : chat;
  }

  async send(message: NotificationMessage): Promise<Result<void>> {
    const chatId = await this.chatSource();
    if (!chatId) return Result.fail(NO_TELEGRAM_CHAT_CONFIGURED);
    return this.sendTo(chatId, message.body);
  }

  // Also behind the dashboard's test message (NOT-202), which names its chat.
  async sendTo(chatId: string, text: string): Promise<Result<void>> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'MarkdownV2'
        }),
        signal: AbortSignal.timeout(10_000)
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const description =
          (body as { description?: string }).description ??
          response.statusText;
        return Result.fail(`Telegram API error: ${description}`);
      }

      return Result.ok<void>();
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return Result.fail(
          'Telegram API error: request timed out after 10s'
        );
      }
      return Result.fail(
        `Network error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
