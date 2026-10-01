// Source: src/application/notifications/use-cases/SendTestNotificationUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import {
  SendTestNotificationUseCase,
  NO_TELEGRAM_CHAT
} from 'application/notifications/use-cases/SendTestNotificationUseCase';
import { PrismaNotificationSettingsRepository } from 'infrastructure/persistence/PrismaNotificationSettingsRepository';
import { NotificationSettings } from 'domain/notifications/value-objects';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';
import { FakeTestMessageSender } from '../../helpers/FakeTestMessageSender';

describe('[NOT-202] SendTestNotificationUseCase — integration', () => {
  let prisma: PrismaClient;
  let sender: FakeTestMessageSender;

  const build = (defaultChat: string | null) =>
    new SendTestNotificationUseCase(
      new PrismaNotificationSettingsRepository(
        prisma,
        NotificationSettings.reconstitute({
          telegramChatId: defaultChat,
          downAlertDelayMinutes: 60,
          wirelessAlertsEnabled: true
        })
      ),
      sender,
      new WinstonLogger()
    );

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notificationSettings.deleteMany();
    sender = new FakeTestMessageSender();
  });

  it('sends to the saved chat rather than the env default', async () => {
    await prisma.notificationSettings.create({
      data: {
        id: 1,
        telegramChatId: '-100333',
        downAlertDelayMinutes: 60,
        wirelessAlertsEnabled: true
      }
    });

    const result = await build('-100111').execute({});

    expect(result.value).toEqual({ telegramChatId: '-100333' });
    expect(sender.sent.map((m) => m.chatId)).toEqual(['-100333']);
  });

  it('tries a chat from the form without saving it', async () => {
    const result = await build('-100111').execute({
      telegramChatId: '-100444'
    });

    expect(result.isSuccess).toBe(true);
    expect(sender.sent[0].chatId).toBe('-100444');
    expect(await prisma.notificationSettings.count()).toBe(0);
  });

  it('fails with nothing to send to', async () => {
    const result = await build(null).execute({});

    expect(result.error).toBe(NO_TELEGRAM_CHAT);
    expect(sender.sent).toHaveLength(0);
  });

  it('passes on why Telegram refused the message', async () => {
    sender.failWith =
      'Telegram API error: Bad Request: chat not found';

    const result = await build('-100111').execute({});

    expect(result.error).toBe(
      'Test message not delivered: Telegram API error: Bad Request: chat not found'
    );
  });
});
