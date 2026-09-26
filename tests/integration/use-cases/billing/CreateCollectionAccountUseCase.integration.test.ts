// Source: src/application/billing/use-cases/CreateCollectionAccountUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateCollectionAccountUseCase } from 'application/billing/use-cases';
import { PrismaCollectionAccountRepository } from 'infrastructure/billing/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { PrismaCustomerRepository } from 'infrastructure/customers';
import {
  cleanCollectionAccounts,
  cleanBills,
  cleanCustomers,
  seedCustomer,
  GHOST_ID
} from '../../helpers/db';

describe('CreateCollectionAccountUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateCollectionAccountUseCase;

  const lineItems = [
    { description: 'Cámara IP 4MP', unitPrice: 185000, quantity: 4 },
    { description: 'Instalación', unitPrice: 350000, quantity: 1 }
  ];

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new CreateCollectionAccountUseCase(
      new PrismaCollectionAccountRepository(prisma),
      new PrismaCustomerRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCollectionAccounts(prisma);
    await cleanBills(prisma);
    await cleanCustomers(prisma);
  });

  it('[BIL-201] persists a walk-in account with its line items', async () => {
    const result = await useCase.execute({
      customerName: 'María López',
      customerDocument: '1098765432',
      lineItems
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.collectionAccount.findUniqueOrThrow({
      where: { id: result.value.id },
      include: { lineItems: true }
    });
    expect(row.status).toBe('PENDING');
    expect(row.customerId).toBeNull();
    expect(row.customerDocument).toBe('1098765432');
    expect(row.lineItems).toHaveLength(2);
    expect(result.value.total).toBe(1090000);
  });

  it('[BIL-206] assigns increasing sequence numbers', async () => {
    const first = await useCase.execute({
      customerName: 'A',
      lineItems
    });
    const second = await useCase.execute({
      customerName: 'B',
      lineItems
    });

    expect(first.value.code).not.toBeNull();
    expect(second.value.code).toBeGreaterThan(first.value.code!);
    expect(second.value.number).toMatch(/^CC-\d{4,}$/);
  });

  it('[BIL-201] snapshots a linked customer from the database', async () => {
    const customerId = await seedCustomer(prisma, {
      fullName: 'Juan Pérez',
      cedula: '1234567890'
    });

    const result = await useCase.execute({ customerId, lineItems });

    expect(result.isSuccess).toBe(true);
    expect(result.value.customerId).toBe(customerId);
    expect(result.value.customerName).toBe('Juan Pérez');
    expect(result.value.customerDocument).toBe('1234567890');
  });

  it('[BIL-201] fails for a customer that does not exist', async () => {
    const result = await useCase.execute({
      customerId: GHOST_ID,
      lineItems
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/Customer not found/);
    expect(await prisma.collectionAccount.count()).toBe(0);
  });

  it('[BIL-251] survives the linked customer being deleted', async () => {
    const customerId = await seedCustomer(prisma);
    const created = await useCase.execute({ customerId, lineItems });

    await prisma.customer.delete({ where: { id: customerId } });

    const row = await prisma.collectionAccount.findUniqueOrThrow({
      where: { id: created.value.id }
    });
    expect(row.customerId).toBeNull();
    expect(row.customerName).toBe('Test Customer');
  });
});
