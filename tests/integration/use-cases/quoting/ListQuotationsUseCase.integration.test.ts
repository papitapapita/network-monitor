// Source: src/application/quoting/use-cases/ListQuotationsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { ListQuotationsUseCase } from 'application/quoting/use-cases';
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
  seedCustomer,
  seedDeviceModel,
  seedQuotation
} from '../../helpers/db';

describe('ListQuotationsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: ListQuotationsUseCase;
  let deviceModelId: string;
  let customerId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new ListQuotationsUseCase(
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
    customerId = await seedCustomer(prisma, { phone: '3001234567' });
  });

  it('lists all quotations', async () => {
    await seedQuotation(prisma, deviceModelId);
    await seedQuotation(prisma, deviceModelId, { status: 'SENT' });

    const result = await useCase.execute({});

    expect(result.isSuccess).toBe(true);
    expect(result.value.total).toBeGreaterThanOrEqual(2);
  });

  it('filters by status', async () => {
    await seedQuotation(prisma, deviceModelId);
    const sentId = await seedQuotation(prisma, deviceModelId, {
      status: 'SENT'
    });

    const result = await useCase.execute({ status: 'SENT' });

    expect(result.isSuccess).toBe(true);
    expect(
      result.value.quotations.every((q) => q.status === 'SENT')
    ).toBe(true);
    expect(result.value.quotations.some((q) => q.id === sentId)).toBe(
      true
    );
  });

  it('filters by customerId', async () => {
    const linkedId = await seedQuotation(prisma, deviceModelId, {
      customerId
    });
    await seedQuotation(prisma, deviceModelId);

    const result = await useCase.execute({ customerId });

    expect(result.isSuccess).toBe(true);
    expect(
      result.value.quotations.every(
        (q) => q.customerId === customerId
      )
    ).toBe(true);
    expect(
      result.value.quotations.some((q) => q.id === linkedId)
    ).toBe(true);
  });

  it('fails on an invalid status filter', async () => {
    const result = await useCase.execute({ status: 'BOGUS' });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Invalid status/i);
  });
});
