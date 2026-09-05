// Source: src/application/quoting/use-cases/AcceptQuotationUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { AcceptQuotationUseCase } from 'application/quoting/use-cases';
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

describe('AcceptQuotationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: AcceptQuotationUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new AcceptQuotationUseCase(
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

  it('transitions a SENT quotation to ACCEPTED and sets acceptedAt', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId, {
      status: 'SENT'
    });

    const result = await useCase.execute({ id: quotationId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('ACCEPTED');
    expect(result.value.acceptedAt).not.toBeNull();
  });

  it('fails when the quotation is still DRAFT', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId);

    const result = await useCase.execute({ id: quotationId });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot accept a DRAFT quotation/i);
  });

  it('fails when the quotation does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Quotation not found/i);
  });
});
