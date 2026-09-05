// Source: src/application/quoting/use-cases/UpdateQuotationDetailsUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { UpdateQuotationDetailsUseCase } from 'application/quoting/use-cases';
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

describe('UpdateQuotationDetailsUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: UpdateQuotationDetailsUseCase;
  let deviceModelId: string;
  let quotationId: string;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new UpdateQuotationDetailsUseCase(
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
    quotationId = await seedQuotation(prisma, deviceModelId);
  });

  it('updates the given fields of a DRAFT quotation', async () => {
    const result = await useCase.execute({
      id: quotationId,
      customerName: 'Updated Name',
      notes: 'Installation included'
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerName).toBe('Updated Name');
    expect(result.value.notes).toBe('Installation included');
  });

  it('leaves fields not provided unchanged', async () => {
    const before = await useCase.execute({
      id: quotationId,
      customerPhone: '555-1234'
    });
    expect(before.isSuccess).toBe(true);

    const after = await useCase.execute({
      id: quotationId,
      customerName: 'Another Name'
    });

    expect(after.isSuccess).toBe(true);
    expect(after.value.customerPhone).toBe('555-1234');
  });

  it('fails when the quotation is not DRAFT', async () => {
    const sentId = await seedQuotation(prisma, deviceModelId, {
      status: 'SENT'
    });

    const result = await useCase.execute({
      id: sentId,
      customerName: 'Updated Name'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Cannot update details/i);
  });

  it('fails when validUntil is not a valid date', async () => {
    const result = await useCase.execute({
      id: quotationId,
      validUntil: 'not-a-date'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/valid date/i);
  });

  it('fails when the quotation does not exist', async () => {
    const result = await useCase.execute({
      id: GHOST_ID,
      customerName: 'Updated Name'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Quotation not found/i);
  });

  it('fails when customerName becomes empty', async () => {
    const result = await useCase.execute({
      id: quotationId,
      customerName: '   '
    });

    expect(result.isFailure).toBe(true);
  });
});
