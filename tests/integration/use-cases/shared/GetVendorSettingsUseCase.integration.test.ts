// Source: src/application/shared/use-cases/GetVendorSettingsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { GetVendorSettingsUseCase } from 'application/shared/use-cases/GetVendorSettingsUseCase';
import { PrismaVendorSettingsRepository } from 'infrastructure/persistence/PrismaVendorSettingsRepository';
import { loadVendorSettingsDefaults } from 'infrastructure/di/vendorSettingsDefaults';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';

describe('[INS-029] GetVendorSettingsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetVendorSettingsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetVendorSettingsUseCase(
      new PrismaVendorSettingsRepository(
        prisma,
        loadVendorSettingsDefaults({
          TELEGRAM_VENDOR_CHAT_ID: '8468052749',
          SUBSCRIPTION_PAID_UNTIL: '2026-12-31'
        })
      ),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.vendorSettings.deleteMany();
  });

  it('answers the env defaults when nothing has been saved', async () => {
    const result = await useCase.execute({});

    expect(result.value.vendorTelegramChatId).toBe('8468052749');
    expect(result.value.subscriptionPaidUntil).toBe('2026-12-31');
  });

  it('answers the saved row, its date unshifted by time zones', async () => {
    await prisma.vendorSettings.create({
      data: {
        id: 1,
        vendorTelegramChatId: null,
        subscriptionPaidUntil: new Date('2027-01-15T00:00:00Z'),
        subscriptionGraceDays: 1,
        subscriptionReadOnlyDays: 2,
        pingResultRetentionDays: 3,
        alertRetentionDays: 4,
        wirelessSnapshotRetentionDays: 5,
        wirelessAlertRecordRetentionDays: 6
      }
    });

    const result = await useCase.execute({});

    expect(result.value).toEqual({
      vendorTelegramChatId: null,
      subscriptionPaidUntil: '2027-01-15',
      subscriptionGraceDays: 1,
      subscriptionReadOnlyDays: 2,
      pingResultRetentionDays: 3,
      alertRetentionDays: 4,
      wirelessSnapshotRetentionDays: 5,
      wirelessAlertRecordRetentionDays: 6
    });
  });
});
