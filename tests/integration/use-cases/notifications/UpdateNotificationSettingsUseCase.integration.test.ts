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
  wirelessAlertsEnabled: true,
  alertTicketMode: 'SUGGEST',
  quietHours: null
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
    // The row would override the env defaults in every later suite.
    await prisma.notificationSettings.deleteMany();
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

  it('[NOT-205] stores the ticket mode, and an omitted mode keeps it', async () => {
    await useCase.execute({
      telegramChatId: '-100222',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: true,
      alertTicketMode: 'AUTOMATIC'
    });
    await useCase.execute({
      telegramChatId: '-100222',
      downAlertDelayMinutes: 20,
      wirelessAlertsEnabled: true
    });

    const row = await prisma.notificationSettings.findUnique({
      where: { id: 1 }
    });
    expect(row?.alertTicketMode).toBe('AUTOMATIC');
    expect(row?.downAlertDelayMinutes).toBe(20);
  });

  it('[NOT-205] an omitted mode on the first save takes the default', async () => {
    await useCase.execute({
      telegramChatId: '-100222',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: true
    });

    const read = await repo.get();
    expect(read.value.alertTicketMode).toBe('SUGGEST');
  });

  it('[NOT-207] stores the install quiet hours, and omitting them keeps them', async () => {
    await useCase.execute({
      telegramChatId: '-100222',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00'
    });
    await useCase.execute({
      telegramChatId: '-100222',
      downAlertDelayMinutes: 20,
      wirelessAlertsEnabled: true
    });

    const row = await prisma.notificationSettings.findUnique({
      where: { id: 1 }
    });
    expect(row?.quietHoursStart).toBe('22:00');
    expect(row?.quietHoursEnd).toBe('06:00');
    const read = await repo.get();
    expect(read.value.quietHours?.start.toString()).toBe('22:00');
  });

  it('[NOT-207] an omitted window on the first save means no install quiet hours', async () => {
    await useCase.execute({
      telegramChatId: '-100222',
      downAlertDelayMinutes: 10,
      wirelessAlertsEnabled: true
    });

    const read = await repo.get();
    expect(read.value.quietHours).toBeNull();
  });

  it('[NOT-207] refuses a one-sided window at the database too', async () => {
    await expect(
      prisma.notificationSettings.create({
        data: {
          id: 1,
          downAlertDelayMinutes: 1,
          wirelessAlertsEnabled: true,
          quietHoursStart: '22:00'
        }
      })
    ).rejects.toThrow(
      'notification_settings_quiet_hours_both_or_neither'
    );
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
