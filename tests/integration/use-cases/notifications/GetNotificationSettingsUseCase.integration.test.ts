// Source: src/application/notifications/use-cases/GetNotificationSettingsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { GetNotificationSettingsUseCase } from 'application/notifications/use-cases/GetNotificationSettingsUseCase';
import { PrismaNotificationSettingsRepository } from 'infrastructure/persistence/PrismaNotificationSettingsRepository';
import { NotificationSettings } from 'domain/notifications/value-objects';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';

const DEFAULTS = NotificationSettings.reconstitute({
  telegramChatId: '-100111',
  downAlertDelayMinutes: 60,
  wirelessAlertsEnabled: true
});

describe('[NOT-201] GetNotificationSettingsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetNotificationSettingsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetNotificationSettingsUseCase(
      new PrismaNotificationSettingsRepository(prisma, DEFAULTS),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notificationSettings.deleteMany();
  });

  it('answers the defaults when nothing has been saved', async () => {
    const result = await useCase.execute({});

    expect(result.value).toEqual({
      telegramChatId: '-100111',
      downAlertDelayMinutes: 60,
      wirelessAlertsEnabled: true
    });
  });

  it('answers the saved row once there is one', async () => {
    await prisma.notificationSettings.create({
      data: {
        id: 1,
        telegramChatId: null,
        downAlertDelayMinutes: 5,
        wirelessAlertsEnabled: false
      }
    });

    const result = await useCase.execute({});

    expect(result.value).toEqual({
      telegramChatId: null,
      downAlertDelayMinutes: 5,
      wirelessAlertsEnabled: false
    });
  });
});
