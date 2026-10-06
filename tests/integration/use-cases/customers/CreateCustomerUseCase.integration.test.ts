// Source: src/application/customers/use-cases/CreateCustomerUseCase.ts

import { PrismaClient } from '../../../../src/generated/prisma/client';
import { CreateCustomerUseCase } from 'application/customers/use-cases';
import { PrismaCustomerRepository } from 'infrastructure/customers/repositories';
import { WinstonLogger } from 'infrastructure/logging/WinstonLogger';
import {
  setupDependencies,
  DependencyContainer
} from 'infrastructure/di/container';
import { cleanCustomers, seedCustomer } from '../../helpers/db';

describe('CreateCustomerUseCase — integration', () => {
  let container: DependencyContainer;
  let prisma: PrismaClient;
  let useCase: CreateCustomerUseCase;

  beforeAll(async () => {
    container = await setupDependencies();
    prisma = container.getPrisma();
    useCase = new CreateCustomerUseCase(
      new PrismaCustomerRepository(prisma),
      new WinstonLogger()
    );
  });

  afterAll(async () => {
    await container.disconnect();
  });

  beforeEach(async () => {
    await cleanCustomers(prisma);
  });

  it('persists a new customer', async () => {
    const result = await useCase.execute({
      fullName: 'Juan Perez',
      phone: '3001234567',
      email: 'juan@example.com'
    });

    expect(result.isSuccess).toBe(true);
    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: result.value.id }
    });
    expect(row.fullName).toBe('Juan Perez');
    expect(row.email).toBe('juan@example.com');
  });

  it('[CUS-025] stores the 30th when no payment day is given', async () => {
    const result = await useCase.execute({
      fullName: 'Juan Perez',
      phone: '3001234567'
    });

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: result.value.id }
    });
    expect(row.paymentDay).toBe(30);
  });

  it('[CUS-024] stores the 15th group', async () => {
    const result = await useCase.execute({
      fullName: 'Juan Perez',
      phone: '3001234567',
      paymentDay: 15
    });

    const row = await prisma.customer.findUniqueOrThrow({
      where: { id: result.value.id }
    });
    expect(row.paymentDay).toBe(15);
  });

  it('[CUS-024] the database refuses a payment day outside 15 and 30', async () => {
    await expect(
      prisma.customer.create({
        data: {
          fullName: 'Juan Perez',
          phone: '3001234567',
          paymentDay: 20
        }
      })
    ).rejects.toThrow(/customers_payment_day_check/);
  });

  it('[CUS-016] refuses a phone that is already registered', async () => {
    await seedCustomer(prisma, { phone: '3001234567' });

    const result = await useCase.execute({
      fullName: 'Otro',
      phone: '3001234567'
    });

    expect(result.isFailure).toBe(true);
    expect(result.error).toMatch(/already exists/);
    expect(await prisma.customer.count()).toBe(1);
  });
});
