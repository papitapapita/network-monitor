// Source: src/application/quoting/use-cases/UpdateQuotationLineItemsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateQuotationLineItemsUseCase } from 'application/quoting/use-cases';
import { PrismaQuotationRepository } from 'infrastructure/quoting/repositories';
import { PrismaDeviceModelRepository } from 'infrastructure/persistence/PrismaDeviceModelRepository';
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

describe('UpdateQuotationLineItemsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateQuotationLineItemsUseCase;
  let deviceModelId: string;
  let quotationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new UpdateQuotationLineItemsUseCase(
      new PrismaQuotationRepository(prisma),
      new PrismaDeviceModelRepository(prisma),
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
    quotationId = await seedQuotation(prisma, deviceModelId);
  });

  it('replaces the line items of a DRAFT quotation', async () => {
    const result = await useCase.execute({
      id: quotationId,
      lineItems: [
        {
          deviceModelId,
          description: 'Updated item',
          unitPrice: 75,
          quantity: 3
        }
      ]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.lineItems).toHaveLength(1);
    expect(result.value.lineItems[0].description).toBe(
      'Updated item'
    );
    expect(result.value.total).toBeCloseTo(225);
  });

  it('fails when the quotation is not DRAFT', async () => {
    const sentId = await seedQuotation(prisma, deviceModelId, {
      status: 'SENT'
    });

    const result = await useCase.execute({
      id: sentId,
      lineItems: [{ deviceModelId, unitPrice: 10, quantity: 1 }]
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot modify line items/i);
  });

  it('fails when lineItems is empty', async () => {
    const result = await useCase.execute({
      id: quotationId,
      lineItems: []
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/at least one line item/i);
  });

  it('fails when the quotation does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      lineItems: [{ deviceModelId, unitPrice: 10, quantity: 1 }]
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Quotation not found/i);
  });

  it('fails when a device model does not exist', async () => {
    const result = await useCase.execute({
      id: quotationId,
      lineItems: [
        { deviceModelId: GHOST_ID, unitPrice: 10, quantity: 1 }
      ]
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Device model not found/i);
  });
});
