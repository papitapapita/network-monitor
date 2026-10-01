// Source: src/application/shared/use-cases/UpdateVendorSettingsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { UpdateVendorSettingsUseCase } from 'application/shared/use-cases/UpdateVendorSettingsUseCase';
import { PrismaVendorSettingsRepository } from 'infrastructure/persistence/PrismaVendorSettingsRepository';
import { loadVendorSettingsDefaults } from 'infrastructure/di/vendorSettingsDefaults';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';
import { ISSUER, WHATSAPP } from '../../../fixtures/vendorSettings';

const SETTINGS = {
  vendorTelegramChatId: '@isp_vendor',
  subscriptionPaidUntil: '2026-12-31',
  subscriptionGraceDays: 3,
  subscriptionReadOnlyDays: 7,
  pingResultRetentionDays: 30,
  alertRetentionDays: 90,
  wirelessSnapshotRetentionDays: 30,
  wirelessAlertRecordRetentionDays: 90,
  issuer: null,
  whatsApp: null,
  enforcementRouter: null
};

describe('[INS-028] UpdateVendorSettingsUseCase — integration', () => {
  let prisma: PrismaClient;
  let repo: PrismaVendorSettingsRepository;
  let useCase: UpdateVendorSettingsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    repo = new PrismaVendorSettingsRepository(
      prisma,
      loadVendorSettingsDefaults({})
    );
    useCase = new UpdateVendorSettingsUseCase(
      repo,
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    // The row would override the env defaults in every later suite.
    await prisma.vendorSettings.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.vendorSettings.deleteMany();
  });

  it('stores one row and the next read answers it, the date intact', async () => {
    await useCase.execute(SETTINGS);

    expect(await prisma.vendorSettings.count()).toBe(1);
    const read = await repo.get();
    expect(read.value.subscriptionPaidUntil).toBe('2026-12-31');
    expect(read.value.vendorTelegramChatId).toBe('@isp_vendor');
  });

  it('replaces the row on a second save, never adding one', async () => {
    await useCase.execute(SETTINGS);
    await useCase.execute({
      ...SETTINGS,
      subscriptionPaidUntil: null
    });

    const rows = await prisma.vendorSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].subscriptionPaidUntil).toBeNull();
  });

  it('round-trips the issuer, WhatsApp and router groups', async () => {
    const groups = {
      issuer: ISSUER,
      whatsApp: WHATSAPP,
      enforcementRouter: {
        deviceId: '550e8400-e29b-41d4-a716-446655440000',
        apiPort: 8729
      }
    };

    await useCase.execute({ ...SETTINGS, ...groups });
    const read = await repo.get();

    expect(read.value.issuer).toEqual(ISSUER);
    expect(read.value.whatsApp).toEqual(WHATSAPP);
    expect(read.value.enforcementRouter).toEqual(
      groups.enforcementRouter
    );
  });

  it('writes nothing when a value is refused', async () => {
    const result = await useCase.execute({
      ...SETTINGS,
      subscriptionPaidUntil: '2026-02-30'
    });

    expect(result.isFailure).toBe(true);
    expect(await prisma.vendorSettings.count()).toBe(0);
  });
});
