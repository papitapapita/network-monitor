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
