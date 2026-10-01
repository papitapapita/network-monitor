// Source: src/application/shared/use-cases/GetSubscriptionStatusUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { GetSubscriptionStatusUseCase } from 'application/shared/use-cases/GetSubscriptionStatusUseCase';
import { loadVendorSettingsDefaults } from 'infrastructure/di/vendorSettingsDefaults';
import { PrismaVendorSettingsRepository } from 'infrastructure/persistence/PrismaVendorSettingsRepository';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';

// The terms are the env defaults until the vendor saves them (INS-029), then
// the saved row, read on every call (INS-028).
describe('GetSubscriptionStatusUseCase — integration', () => {
  const logger = new WinstonLogger();
  let prisma: PrismaClient;

  const build = (env: NodeJS.ProcessEnv) =>
    new GetSubscriptionStatusUseCase(
      new PrismaVendorSettingsRepository(
        prisma,
        loadVendorSettingsDefaults(env)
      ),
      logger
    );

  const savePaidUntil = (date: string | null) =>
    prisma.vendorSettings.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        subscriptionPaidUntil: date
          ? new Date(`${date}T00:00:00Z`)
          : null,
        subscriptionGraceDays: 3,
        subscriptionReadOnlyDays: 7,
        pingResultRetentionDays: 30,
        alertRetentionDays: 90,
        wirelessSnapshotRetentionDays: 30,
        wirelessAlertRecordRetentionDays: 90
      },
      update: {
        subscriptionPaidUntil: date
          ? new Date(`${date}T00:00:00Z`)
          : null
      }
    });

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  afterAll(async () => {
    // The row would override the env defaults in every later suite.
    await prisma.vendorSettings.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.vendorSettings.deleteMany();
  });

  it('[INS-020] is NOT_ENFORCED when the install sets no terms', async () => {
    const result = await build({}).execute();

    expect(result.value.state).toBe('NOT_ENFORCED');
    expect(result.value.readOnly).toBe(false);
  });

  it('[INS-020] is ACTIVE for a date far ahead, with the default stages', async () => {
    const result = await build({
      SUBSCRIPTION_PAID_UNTIL: '2099-12-31'
    }).execute();

    expect(result.value).toEqual({
      state: 'ACTIVE',
      paidThrough: '2100-01-01T05:00:00.000Z',
      graceEndsAt: '2100-01-04T05:00:00.000Z',
      lockedAt: '2100-01-11T05:00:00.000Z',
      readOnly: false,
      locked: false
    });
  });

  it('[INS-020] is LOCKED long after the last paid day', async () => {
    const result = await build({
      SUBSCRIPTION_PAID_UNTIL: '2020-01-31'
    }).execute();

    expect(result.value.state).toBe('LOCKED');
  });

  it('[INS-028] a payment saved by the vendor unlocks at once, over the env date', async () => {
    const useCase = build({ SUBSCRIPTION_PAID_UNTIL: '2020-01-31' });
    expect((await useCase.execute()).value.state).toBe('LOCKED');

    await savePaidUntil('2099-12-31');

    expect((await useCase.execute()).value.state).toBe('ACTIVE');
  });

  it('[INS-028] a saved row with no date stops enforcing, over the env date', async () => {
    await savePaidUntil(null);

    const result = await build({
      SUBSCRIPTION_PAID_UNTIL: '2020-01-31'
    }).execute();

    expect(result.value.state).toBe('NOT_ENFORCED');
  });
});
