// Source: src/application/quoting/use-cases/CreateQuotationUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateQuotationUseCase } from 'application/quoting/use-cases';
import { PrismaQuotationRepository } from 'infrastructure/quoting/repositories';
import { PrismaCustomerRepository } from 'infrastructure/customers';
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
  seedCustomer,
  seedDeviceModel,
  GHOST_ID
} from '../../helpers/db';

describe('CreateQuotationUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateQuotationUseCase;
  let customerId: string;
  let deviceModelId: string;

  const VALID_UNTIL = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();

    useCase = new CreateQuotationUseCase(
      new PrismaQuotationRepository(prisma),
      new PrismaCustomerRepository(prisma),
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

    customerId = await seedCustomer(prisma, { phone: '3001234567' });
    deviceModelId = await seedDeviceModel(prisma, {
      imageUrl: 'https://example.com/router.jpg'
    });
  });

  const validRequest = () => ({
    customerId,
    validUntil: VALID_UNTIL,
    lineItems: [{ deviceModelId, unitPrice: 199.99, quantity: 2 }]
  });

  it('writes a DRAFT quotation with a database-assigned code', async () => {
    const result = await useCase.execute(validRequest());

    expect(result.isSuccess).toBe(true);
    expect(result.value.status).toBe('DRAFT');
    expect(typeof result.value.code).toBe('number');
  });

  it('gives consecutive quotations distinct codes', async () => {
    const first = await useCase.execute(validRequest());
    const second = await useCase.execute(validRequest());

    expect(second.value.code).not.toBe(first.value.code);
  });

  it('snapshots the resolved customer name, phone, and email', async () => {
    const customerWithEmail = await seedCustomer(prisma, {
      phone: '3009999991',
      fullName: 'Jane Buyer',
      email: 'jane@example.com'
    });

    const result = await useCase.execute({
      ...validRequest(),
      customerId: customerWithEmail
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerName).toBe('Jane Buyer');
    expect(result.value.customerPhone).toBe('3009999991');
    expect(result.value.customerEmail).toBe('jane@example.com');
  });

  it('accepts a free-text customer with no customerId', async () => {
    const result = await useCase.execute({
      validUntil: VALID_UNTIL,
      customerName: 'Prospect Corp',
      customerPhone: '555-0000',
      lineItems: [{ deviceModelId, unitPrice: 50, quantity: 1 }]
    });

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerId).toBeNull();
    expect(result.value.customerName).toBe('Prospect Corp');
  });

  it('snapshots the device model name, vendor, type, and image at add-time', async () => {
    const result = await useCase.execute(validRequest());

    expect(result.isSuccess).toBe(true);
    const item = result.value.lineItems[0];
    expect(item.deviceModelName).toBe('MikroTik RB4011iGS+');
    expect(item.vendorName).toBe('MikroTik');
    expect(item.deviceType).toBe('ROUTERBOARD');
    expect(item.imageUrl).toBe('https://example.com/router.jpg');
  });

  it('computes the total across line items', async () => {
    const result = await useCase.execute(validRequest());

    // 199.99 * 2 = 399.98
    expect(result.value.total).toBeCloseTo(399.98);
    expect(result.value.subtotal).toBeCloseTo(399.98);
  });

  it('fails when neither customerId nor customerName is given', async () => {
    const result = await useCase.execute({
      validUntil: VALID_UNTIL,
      lineItems: [{ deviceModelId, unitPrice: 50, quantity: 1 }]
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/customerId or customerName/i);
  });

  it('fails when lineItems is empty', async () => {
    const result = await useCase.execute({
      customerId,
      validUntil: VALID_UNTIL,
      lineItems: []
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/at least one line item/i);
  });

  it('fails when the customer does not exist', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      customerId: GHOST_ID
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Customer not found/i);
  });

  it('fails when a device model does not exist', async () => {
    const result = await useCase.execute({
      customerId,
      validUntil: VALID_UNTIL,
      lineItems: [
        { deviceModelId: GHOST_ID, unitPrice: 50, quantity: 1 }
      ]
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Device model not found/i);
  });

  it('fails when validUntil is not a valid date', async () => {
    const result = await useCase.execute({
      ...validRequest(),
      validUntil: 'not-a-date'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/valid date/i);
  });

  it('fails when quantity is not a positive integer', async () => {
    const result = await useCase.execute({
      customerId,
      validUntil: VALID_UNTIL,
      lineItems: [{ deviceModelId, unitPrice: 50, quantity: 0 }]
    });

    expect(result.isFailure).toBe(true);
  });
});
