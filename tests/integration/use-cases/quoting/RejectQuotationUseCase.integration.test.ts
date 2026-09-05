// Source: src/application/quoting/use-cases/RejectQuotationUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { RejectQuotationUseCase } from 'application/quoting/use-cases';
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

describe('RejectQuotationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: RejectQuotationUseCase;
  let deviceModelId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new RejectQuotationUseCase(
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

  it('transitions a SENT quotation to REJECTED with a reason', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId, {
      status: 'SENT'
    });

    const result = await useCase.execute({
      id: quotationId,
      reason: 'Too expensive'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('REJECTED');
    expect(result.value.rejectedAt).not.toBeNull();
    expect(result.value.rejectionReason).toBe('Too expensive');
  });

  it('fails when reason is blank', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId, {
      status: 'SENT'
    });

    const result = await useCase.execute({
      id: quotationId,
      reason: '   '
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/reason is required/i);
  });

  it('fails when the quotation is still DRAFT', async () => {
    const quotationId = await seedQuotation(prisma, deviceModelId);

    const result = await useCase.execute({
      id: quotationId,
      reason: 'Too expensive'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot reject a DRAFT quotation/i);
  });

  it('fails when the quotation does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      reason: 'Too expensive'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Quotation not found/i);
  });
});
