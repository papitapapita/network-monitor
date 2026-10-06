// Source: src/application/billing/use-cases/UpdateBillingSettingsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { UpdateBillingSettingsUseCase } from 'application/billing/use-cases';
import { PrismaBillingSettingsRepository } from 'infrastructure/billing/repositories';
import { BillingMode } from 'domain/billing/enums';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';

const SAVED = {
  automaticBillingEnabled: true,
  billingMode: BillingMode.ARREARS,
  issueLeadDays: 7,
  graceDays: 2,
  automaticCutEnabled: false
};

describe('[BIL-280] UpdateBillingSettingsUseCase — integration', () => {
  let prisma: PrismaClient;
  let repo: PrismaBillingSettingsRepository;
  let useCase: UpdateBillingSettingsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    repo = new PrismaBillingSettingsRepository(prisma);
    useCase = new UpdateBillingSettingsUseCase(
      repo,
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await prisma.billingSettings.deleteMany();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.billingSettings.deleteMany();
  });

  it('stores one row and the next read answers it', async () => {
    await useCase.execute(SAVED);

    expect(await prisma.billingSettings.count()).toBe(1);
    const read = await repo.get();
    expect(read.value.automaticBillingEnabled).toBe(true);
    expect(read.value.billingMode).toBe(BillingMode.ARREARS);
    expect(read.value.issueLeadDays).toBe(7);
    expect(read.value.graceDays).toBe(2);
  });

  it('replaces the row on a second save, never adding one', async () => {
    await useCase.execute(SAVED);
    await useCase.execute({
      ...SAVED,
      automaticBillingEnabled: false,
      issueLeadDays: 3
    });

    const rows = await prisma.billingSettings.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].automaticBillingEnabled).toBe(false);
    expect(rows[0].issueLeadDays).toBe(3);
  });

  it('writes nothing when a value is refused', async () => {
    const result = await useCase.execute({
      ...SAVED,
      issueLeadDays: 0
    });

    expect(result.isFailure).toBe(true);
    expect(await prisma.billingSettings.count()).toBe(0);
  });

  it('keeps the table to a single row at the database too', async () => {
    await expect(
      prisma.billingSettings.create({
        data: { id: 2, ...SAVED }
      })
    ).rejects.toThrow();
  });
});
