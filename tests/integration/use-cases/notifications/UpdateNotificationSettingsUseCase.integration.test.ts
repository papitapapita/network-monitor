// Source: src/application/notifications/use-cases/UpdateNotificationSettingsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { UpdateNotificationSettingsUseCase } from 'application/notifications/use-cases/UpdateNotificationSettingsUseCase';
import { PrismaNotificationSettingsRepository } from 'infrastructure/persistence/PrismaNotificationSettingsRepository';
import { NotificationSettings } from 'domain/notifications/value-objects';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';

const DEFAULTS = NotificationSettings.reconstitute({
  telegramChatId: '-100111',
  downAlertDelayMinutes: 60,
  wirelessAlertsEnabled: true
});

describe('[NOT-200] UpdateNotificationSettingsUseCase — integration', () => {
  let prisma: PrismaClient;
  let repo: PrismaNotificationSettingsRepository;
  let useCase: UpdateNotificationSettingsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    repo = new PrismaNotificationSettingsRepository(prisma, DEFAULTS);
    useCase = new UpdateNotificationSettingsUseCase(
      repo,
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.notificationSettings.deleteMany();
  });

  it('stores one row and the next read answers it', async () => {
    await useCase.execute({
      telegramChatId: '-100222',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: false
    });

    expect(await prisma.notificationSettings.count()).toBe(1);
    const read = await repo.get();
    expect(read.value.telegramChatId).toBe('-100222');
    expect(read.value.downAlertDelayMinutes).toBe(10);
    expect(read.value.wirelessAlertsEnabled).toBe(false);
  });

  it('replaces the row on a second save, never adding one', async () => {
    await useCase.execute({
      telegramChatId: '-100222',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: false
    });
    await useCase.execute({
      telegramChatId: '@isp_alertas',
      downAlertDelayMinutes: 0,
      wirelessAlertsEnabled: true
    });

    const rows = await prisma.notificationSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].telegramChatId).toBe('@isp_alertas');
    expect(rows[0].downAlertDelayMinutes).toBe(0);
  });

  it('writes nothing when a value is refused', async () => {
    const result = await useCase.execute({
      telegramChatId: 'my-group',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: true
    });

    expect(result.isFailure).toBe(true);
    expect(await prisma.notificationSettings.count()).toBe(0);
  });

  it('keeps the table to a single row at the database too', async () => {
    await expect(
      prisma.notificationSettings.create({
        data: {
          id: 2,
          downAlertDelayMinutes: 1,
          wirelessAlertsEnabled: true
        }
      })
    ).rejects.toThrow();
  });
});
