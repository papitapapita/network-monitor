import { Result } from 'domain/shared/core';

// Sends one message to a chat chosen by the caller rather than the install's
// configured one, so an administrator can try a chat id before saving it.
export interface ITestMessageSender {
  send(chatId: string, text: string): Promise<Result<void>>;
}
