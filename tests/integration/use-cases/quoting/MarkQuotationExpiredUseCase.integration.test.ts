// Source: src/application/quoting/use-cases/MarkQuotationExpiredUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { MarkQuotationExpiredUseCase } from 'application/quoting/use-cases';
import { PrismaQuotationRepository } from 'infrastructure/quoting/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import {
  cleanQuotations,
  cleanBills,
  cleanCustomers,
  cleanCatalog,
  seedDeviceModel,
  seedQuotation,
  GHOST_ID
} from '../../helpers/db';

const PAST_DATE = new Date('2020-01-01T00:00:00.000Z');

describe('MarkQuotationExpiredUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: MarkQuotationExpiredUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new MarkQuotationExpiredUseCase(
      new PrismaQuotationRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanQuotations(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);
    await cleanCatalog(prisma);

    deviceModelId = await seedDeviceModel(prisma);
  });

  it('transitions a SENT quotation past its validUntil to EXPIRED', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId, {
      status: 'SENT',
      validUntil: PAST_DATE
    });

    const result = await useCase.execute({ id: quotationId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('EXPIRED');
    expect(result.value.expiredAt).not.toBeNull();
  });

  it('fails when the quotation is not yet past its validity date', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId, {
      status: 'SENT'
    });

    const result = await useCase.execute({ id: quotationId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/not past its validity date/i);
  });

  it('fails when the quotation is still DRAFT', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId, {
      validUntil: PAST_DATE
    });

    const result = await useCase.execute({ id: quotationId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot expire a DRAFT quotation/i);
  });

  it('fails when the quotation does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Quotation not found/i);
  });
});
