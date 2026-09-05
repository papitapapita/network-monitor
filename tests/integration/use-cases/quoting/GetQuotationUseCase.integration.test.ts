// Source: src/application/quoting/use-cases/GetQuotationUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { GetQuotationUseCase } from 'application/quoting/use-cases';
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
  GHOST_ID,
  INVALID_ID
} from '../../helpers/db';

describe('GetQuotationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: GetQuotationUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new GetQuotationUseCase(
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

  it('returns a quotation by id', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId);

    const result = await useCase.execute({ id: quotationId });

    expect(result.isSuccess).toBe(true);
    expect(result.value.id).toBe(quotationId);
  });

  it('fails with a malformed id', async () => {
    const result = await useCase.execute({ id: INVALID_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid quotation ID/i);
  });

  it('fails when the quotation does not exist', async () => {
    const result = await useCase.execute({ id: GHOST_ID });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Quotation not found/i);
  });
});
