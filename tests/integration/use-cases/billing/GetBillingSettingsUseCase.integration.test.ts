// Source: src/application/billing/use-cases/GetBillingSettingsUseCase.ts

import { PrismaClient } from 'generated/prisma/client';
import { GetBillingSettingsUseCase } from 'application/billing/use-cases';
import { PrismaBillingSettingsRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import { createTestPrisma } from '../../helpers/db';

describe('[BIL-281] GetBillingSettingsUseCase — integration', () => {
  let prisma: PrismaClient;
  let useCase: GetBillingSettingsUseCase;

  beforeAll(() => {
    prisma = createTestPrisma();
    useCase = new GetBillingSettingsUseCase(
      new PrismaBillingSettingsRepository(prisma),
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

  it('answers the defaults, billing off, when nothing has been saved', async () => {
    const result = await useCase.execute({});

    expect(result.value).toEqual({
      automaticBillingEnabled: false,
      billingMode: 'ADVANCE',
      issueLeadDays: 5,
      graceDays: 3,
      automaticCutEnabled: false,
      reminderWhatsAppTemplate: null,
      billWhatsAppTemplate: null
    });
  });

  it('answers the saved row once there is one', async () => {
    await prisma.billingSettings.create({
      data: {
        automaticBillingEnabled: true,
        billingMode: 'ARREARS',
        issueLeadDays: 10,
        graceDays: 0,
        automaticCutEnabled: false,
        reminderWhatsAppTemplate: null,
        billWhatsAppTemplate: null
      }
    });

    const result = await useCase.execute({});

    expect(result.value).toEqual({
      automaticBillingEnabled: true,
      billingMode: 'ARREARS',
      issueLeadDays: 10,
      graceDays: 0,
      automaticCutEnabled: false,
      reminderWhatsAppTemplate: null,
      billWhatsAppTemplate: null
    });
  });
});
